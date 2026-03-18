import { promises as fs } from "fs";
import Holidays from "date-holidays";
import * as ical from "node-ical";
import type {
  CalendarConfig,
  CalendarEvent,
  CountryOption,
  CustomEntry,
  SyncSource
} from "../shared/types";
import { addDays, sortEvents, startOfDay } from "../shared/calendar";

interface SyncResponse {
  events: CalendarEvent[];
  warnings: string[];
}

interface ICalEventShape {
  type?: string;
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date;
  end?: Date;
  datetype?: string;
  rrule?: {
    between: (after: Date, before: Date, includeLimits: boolean) => Date[];
  };
}

function buildWindow(config: CalendarConfig): { start: Date; end: Date } {
  const start = addDays(startOfDay(new Date()), -7);
  const end = addDays(start, Math.max(config.sync.lookAheadDays, 21) + 60);

  return { start, end };
}

function createEventFromSource(
  source: SyncSource,
  input: {
    id: string;
    title: string;
    start: Date;
    end?: Date;
    allDay: boolean;
    notes?: string;
  }
): CalendarEvent {
  return {
    id: `${source.id}:${input.id}:${input.start.toISOString()}`,
    title: input.title,
    start: input.start.toISOString(),
    end: input.end?.toISOString(),
    allDay: input.allDay,
    type: "synced",
    sourceId: source.id,
    sourceName: source.name,
    notes: input.notes,
    color: source.color,
    badge: source.name
  };
}

async function readIcsPayload(source: SyncSource): Promise<string> {
  if (source.type === "ics-file") {
    return fs.readFile(source.value, "utf-8");
  }

  const response = await fetch(source.value);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.text();
}

function extractNotes(event: ICalEventShape): string {
  return [event.location, event.description].filter(Boolean).join("\n");
}

function isAllDayEvent(event: ICalEventShape): boolean {
  if (event.datetype === "date") {
    return true;
  }

  if (!event.start || !event.end) {
    return false;
  }

  return (
    event.start.getHours() === 0 &&
    event.start.getMinutes() === 0 &&
    event.end.getHours() === 0 &&
    event.end.getMinutes() === 0
  );
}

function extractEventsFromIcs(
  source: SyncSource,
  payload: string,
  config: CalendarConfig
): CalendarEvent[] {
  const parsed = ical.sync.parseICS(payload) as Record<string, ICalEventShape>;
  const windowRange = buildWindow(config);
  const events: CalendarEvent[] = [];

  Object.entries(parsed).forEach(([key, item]) => {
    if (!item || item.type !== "VEVENT" || !item.start) {
      return;
    }

    const baseId = item.uid || key;
    const baseTitle = item.summary?.trim() || "Calendar event";
    const baseStart = new Date(item.start);
    const baseEnd = item.end ? new Date(item.end) : undefined;
    const notes = extractNotes(item);
    const allDay = isAllDayEvent(item);

    if (item.rrule) {
      const durationMs = baseEnd
        ? Math.max(baseEnd.getTime() - baseStart.getTime(), 0)
        : 0;

      item.rrule
        .between(windowRange.start, windowRange.end, true)
        .forEach((occurrence, index) => {
          if (occurrence < windowRange.start || occurrence > windowRange.end) {
            return;
          }

          events.push(
            createEventFromSource(source, {
              id: `${baseId}-rrule-${index}`,
              title: baseTitle,
              start: occurrence,
              end: durationMs
                ? new Date(occurrence.getTime() + durationMs)
                : undefined,
              allDay,
              notes
            })
          );
        });

      return;
    }

    if (baseStart < windowRange.start || baseStart > windowRange.end) {
      return;
    }

    events.push(
      createEventFromSource(source, {
        id: baseId,
        title: baseTitle,
        start: baseStart,
        end: baseEnd,
        allDay,
        notes
      })
    );
  });

  return events;
}

function customEntryToEvent(entry: CustomEntry): CalendarEvent | null {
  const start = entry.startTime
    ? new Date(`${entry.date}T${entry.startTime}:00`)
    : new Date(`${entry.date}T00:00:00`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end =
    entry.startTime && entry.endTime
      ? new Date(`${entry.date}T${entry.endTime}:00`)
      : undefined;

  return {
    id: entry.id,
    title: entry.title,
    start: start.toISOString(),
    end:
      end && !Number.isNaN(end.getTime()) && end > start
        ? end.toISOString()
        : undefined,
    allDay: !entry.startTime,
    type: "custom",
    sourceId: "custom",
    sourceName: "Custom entries",
    notes: entry.notes,
    color: entry.color,
    badge:
      entry.kind === "deadline"
        ? "Deadline"
        : entry.kind === "birthday"
          ? "Birthday"
          : entry.kind === "anniversary"
            ? "Anniversary"
            : "Custom"
  };
}

function holidayEvents(config: CalendarConfig): CalendarEvent[] {
  if (!config.holidays.enabled) {
    return [];
  }

  const engine = config.holidays.subdivision
    ? new Holidays(config.holidays.countryCode, config.holidays.subdivision)
    : new Holidays(config.holidays.countryCode);
  const { start, end } = buildWindow(config);
  const years = new Set<number>([start.getFullYear(), end.getFullYear()]);
  const items: CalendarEvent[] = [];

  years.forEach((year) => {
    engine.getHolidays(year).forEach((holiday) => {
      const holidayDate = new Date(`${holiday.date.slice(0, 10)}T00:00:00`);

      if (holidayDate < start || holidayDate > end) {
        return;
      }

      items.push({
        id: `holiday:${config.holidays.countryCode}:${holiday.date}:${holiday.name}`,
        title: holiday.name,
        start: holidayDate.toISOString(),
        allDay: true,
        type: "holiday",
        sourceId: "holidays",
        sourceName: "Public holidays",
        color: "#ffd166",
        badge: "Holiday"
      });
    });
  });

  return items;
}

export async function listHolidayCountries(): Promise<CountryOption[]> {
  const engine = new Holidays();
  const countries = engine.getCountries();

  return Object.entries(countries)
    .map(([code, name]) => ({
      code,
      name
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function collectCalendarEvents(
  config: CalendarConfig
): Promise<SyncResponse> {
  const warnings: string[] = [];
  const events: CalendarEvent[] = [];

  for (const source of config.syncSources.filter(
    (item) => item.enabled && item.value.trim()
  )) {
    try {
      const payload = await readIcsPayload(source);
      events.push(...extractEventsFromIcs(source, payload, config));
    } catch (error) {
      warnings.push(
        `${source.name}: ${(error as Error).message || "Sync failed"}`
      );
    }
  }

  config.customEntries.forEach((entry) => {
    const event = customEntryToEvent(entry);

    if (event) {
      events.push(event);
    }
  });

  try {
    events.push(...holidayEvents(config));
  } catch (error) {
    warnings.push(
      `Public holidays: ${(error as Error).message || "Holiday lookup failed"}`
    );
  }

  return {
    events: sortEvents(events),
    warnings
  };
}
