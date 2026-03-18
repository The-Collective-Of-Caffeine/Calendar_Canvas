import type {
  CalendarEvent,
  CalendarConfig,
  ThemePalette
} from "./types";

export interface PaletteDefinition {
  backgroundStart: string;
  backgroundEnd: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  accent: string;
}

const paletteMap: Record<ThemePalette, Omit<PaletteDefinition, "accent">> = {
  aurora: {
    backgroundStart: "#0d1220",
    backgroundEnd: "#21384f",
    surface: "rgba(14, 26, 42, 0.72)",
    surfaceAlt: "rgba(21, 36, 59, 0.86)",
    textPrimary: "#f4f7fb",
    textMuted: "#b0c2d9",
    border: "rgba(255, 255, 255, 0.12)"
  },
  sunset: {
    backgroundStart: "#26131a",
    backgroundEnd: "#754a39",
    surface: "rgba(40, 21, 24, 0.68)",
    surfaceAlt: "rgba(75, 40, 31, 0.78)",
    textPrimary: "#fff6eb",
    textMuted: "#f2d6c3",
    border: "rgba(255, 240, 228, 0.12)"
  },
  forest: {
    backgroundStart: "#10231a",
    backgroundEnd: "#355a38",
    surface: "rgba(18, 34, 24, 0.72)",
    surfaceAlt: "rgba(36, 61, 43, 0.84)",
    textPrimary: "#f4faef",
    textMuted: "#bfd5c0",
    border: "rgba(244, 250, 239, 0.12)"
  },
  ink: {
    backgroundStart: "#11131b",
    backgroundEnd: "#36394a",
    surface: "rgba(17, 19, 27, 0.75)",
    surfaceAlt: "rgba(38, 41, 54, 0.86)",
    textPrimary: "#f6f6f8",
    textMuted: "#c2c5d1",
    border: "rgba(255, 255, 255, 0.12)"
  }
};

export const DEFAULT_ACCENT = "#8bd9ff";

export function getPalette(config: CalendarConfig): PaletteDefinition {
  const selected = paletteMap[config.theme.palette];

  return {
    ...selected,
    accent: config.theme.accentColor || DEFAULT_ACCENT
  };
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((left, right) => {
    const leftStart = new Date(left.start).getTime();
    const rightStart = new Date(right.start).getTime();

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return left.title.localeCompare(right.title);
  });
}

export function toLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function filterUpcomingEvents(
  events: CalendarEvent[],
  lookAheadDays: number
): CalendarEvent[] {
  const today = startOfDay(new Date());
  const end = addDays(today, lookAheadDays);

  return sortEvents(events).filter((event) => {
    const startsAt = new Date(event.start);
    return startsAt >= today && startsAt <= end;
  });
}

export function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatTimeLabel(event: CalendarEvent): string {
  if (event.allDay) {
    return "All day";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });

  const startLabel = formatter.format(new Date(event.start));

  if (!event.end) {
    return startLabel;
  }

  const endLabel = formatter.format(new Date(event.end));
  return `${startLabel} - ${endLabel}`;
}

export function buildMonthMatrix(anchor: Date): Date[][] {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const weeks: Date[][] = [];

  let cursor = new Date(firstDay);
  cursor.setDate(cursor.getDate() - startOffset);

  while (weeks.length < 6) {
    const week: Date[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);

    const reachedEnd =
      cursor.getMonth() !== anchor.getMonth() &&
      cursor.getDate() >= 7 &&
      weeks.length >= Math.ceil((totalDays + startOffset) / 7);

    if (reachedEnd) {
      break;
    }
  }

  return weeks;
}

export function summarizeCounts(events: CalendarEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    const key = toLocalDateKey(event.start);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
