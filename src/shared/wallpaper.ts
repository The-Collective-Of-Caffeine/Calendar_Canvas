import type { CalendarConfig, CalendarEvent } from "./types";
import {
  buildMonthMatrix,
  escapeXml,
  filterUpcomingEvents,
  formatDateLabel,
  formatTimeLabel,
  getPalette,
  summarizeCounts,
  svgToDataUrl,
  toLocalDateKey
} from "./calendar";

export interface WallpaperRenderResult {
  svg: string;
  previewDataUrl: string;
  renderedAt: string;
}

function fitFontSize(
  value: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
  widthFactor: number
): number {
  const estimatedWidth = value.length * preferredSize * widthFactor;

  if (estimatedWidth <= maxWidth) {
    return preferredSize;
  }

  const scaled = Math.floor(maxWidth / (Math.max(value.length, 1) * widthFactor));
  return Math.max(minimumSize, Math.min(preferredSize, scaled));
}

function truncate(value: string, max = 34): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 3)}...`;
}

function buildAgendaRows(
  events: CalendarEvent[],
  density: string,
  startY: number
): string {
  const maxItems = density === "compact" ? 7 : 5;
  const visible = events.slice(0, maxItems);

  return visible
    .map((event, index) => {
      const top = startY + index * (density === "compact" ? 94 : 112);
      const title = escapeXml(
        truncate(event.title, density === "compact" ? 30 : 36)
      );
      const meta = escapeXml(
        `${formatDateLabel(event.start)}  |  ${formatTimeLabel(event)}`
      );
      const badge = escapeXml(event.badge);
      const notes = event.notes ? escapeXml(truncate(event.notes, 62)) : "";

      return `
        <g transform="translate(88 ${top})">
          <rect width="700" height="${density === "compact" ? 76 : 92}" rx="26" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
          <rect x="24" y="22" width="10" height="${density === "compact" ? 32 : 44}" rx="5" fill="${event.color}" />
          <text x="56" y="34" fill="#f8fbff" font-family="Aptos, Segoe UI, sans-serif" font-size="28" font-weight="700">${title}</text>
          <text x="56" y="63" fill="rgba(248,251,255,0.72)" font-family="Aptos, Segoe UI, sans-serif" font-size="18">${meta}</text>
          ${
            notes
              ? `<text x="56" y="84" fill="rgba(248,251,255,0.56)" font-family="Aptos, Segoe UI, sans-serif" font-size="16">${notes}</text>`
              : ""
          }
          <rect x="564" y="18" width="112" height="34" rx="17" fill="rgba(255,255,255,0.09)" />
          <text x="620" y="40" text-anchor="middle" fill="#f8fbff" font-family="Aptos, Segoe UI, sans-serif" font-size="16" font-weight="700">${badge}</text>
        </g>
      `;
    })
    .join("");
}

function buildMonthCells(config: CalendarConfig, events: CalendarEvent[]): string {
  if (!config.theme.showMiniMonth) {
    return "";
  }

  const anchor = new Date();
  const weeks = buildMonthMatrix(anchor);
  const todayKey = toLocalDateKey(anchor);
  const eventCounts = summarizeCounts(events);
  const cellWidth = 96;
  const cellHeight = 82;

  const header = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((label, index) => {
      const x = 1022 + index * cellWidth;
      return `<text x="${x + 48}" y="274" text-anchor="middle" fill="rgba(248,251,255,0.65)" font-family="Aptos, Segoe UI, sans-serif" font-size="18" font-weight="600">${label}</text>`;
    })
    .join("");

  const rows = weeks
    .map((week, weekIndex) =>
      week
        .map((date, dayIndex) => {
          const x = 1022 + dayIndex * cellWidth;
          const y = 300 + weekIndex * cellHeight;
          const key = toLocalDateKey(date);
          const inMonth = date.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const count = eventCounts[key] ?? 0;

          return `
            <g transform="translate(${x} ${y})">
              <rect width="84" height="70" rx="20" fill="${
                isToday ? "rgba(139, 217, 255, 0.18)" : "rgba(255,255,255,0.04)"
              }" stroke="${isToday ? "rgba(139, 217, 255, 0.55)" : "rgba(255,255,255,0.08)"}" />
              <text x="20" y="28" fill="${
                inMonth ? "rgba(248,251,255,0.95)" : "rgba(248,251,255,0.34)"
              }" font-family="Aptos, Segoe UI, sans-serif" font-size="20" font-weight="${
                isToday ? "700" : "600"
              }">${date.getDate()}</text>
              ${
                count
                  ? `<circle cx="60" cy="46" r="10" fill="${count > 3 ? "#ffd166" : "#8bd9ff"}" />
                     <text x="60" y="50" text-anchor="middle" fill="#07111e" font-family="Aptos, Segoe UI, sans-serif" font-size="12" font-weight="800">${Math.min(count, 9)}</text>`
                  : ""
              }
            </g>
          `;
        })
        .join("")
    )
    .join("");

  return `${header}${rows}`;
}

export function renderWallpaper(
  config: CalendarConfig,
  events: CalendarEvent[]
): WallpaperRenderResult {
  const palette = getPalette(config);
  const now = new Date();
  const weekdayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long"
  }).format(now);
  const dateHeadline = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(now);
  const upcoming = filterUpcomingEvents(events, config.sync.lookAheadDays);
  const syncedCount = events.filter((event) => event.type === "synced").length;
  const holidayCount = events.filter((event) => event.type === "holiday").length;
  const customCount = events.filter((event) => event.type === "custom").length;
  const width = config.wallpaper.resolutionWidth;
  const height = config.wallpaper.resolutionHeight;
  const leftTitleFontSize = fitFontSize(weekdayLabel, 590, 78, 54, 0.58);
  const dateHeadlineFontSize = fitFontSize(dateHeadline, 590, 44, 30, 0.5);
  const monthTitleFontSize = fitFontSize(monthLabel, 340, 50, 36, 0.54);
  const markedDays = Object.keys(summarizeCounts(events)).length;
  const agendaStartY = 348;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.backgroundStart}" />
          <stop offset="100%" stop-color="${palette.backgroundEnd}" />
        </linearGradient>
        <radialGradient id="orbOne" cx="10%" cy="10%" r="70%">
          <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.42" />
          <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="orbTwo" cx="100%" cy="15%" r="70%">
          <stop offset="0%" stop-color="#ffbf7a" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#ffbf7a" stop-opacity="0" />
        </radialGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="32" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <circle cx="240" cy="120" r="280" fill="url(#orbOne)" filter="url(#blur)" />
      <circle cx="${width - 180}" cy="160" r="220" fill="url(#orbTwo)" filter="url(#blur)" />
      <rect x="54" y="48" width="${width - 108}" height="${height - 96}" rx="40" fill="${palette.surface}" stroke="${palette.border}" />
      <rect x="72" y="66" width="734" height="${height - 132}" rx="34" fill="${palette.surfaceAlt}" stroke="rgba(255,255,255,0.05)" />
      <rect x="840" y="66" width="${width - 912}" height="${height - 132}" rx="34" fill="rgba(11,17,28,0.36)" stroke="rgba(255,255,255,0.05)" />

      <text x="88" y="136" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="20" letter-spacing="2.5">CALENDAR CANVAS</text>
      <g transform="translate(626 108)">
        <rect width="146" height="54" rx="27" fill="rgba(255,255,255,0.08)" />
        <circle cx="30" cy="27" r="14" fill="${palette.accent}" />
        <text x="30" y="32" text-anchor="middle" fill="#07111e" font-family="Aptos, Segoe UI, sans-serif" font-size="14" font-weight="800">${upcoming.length}</text>
        <text x="56" y="32" fill="${palette.textPrimary}" font-family="Aptos, Segoe UI, sans-serif" font-size="17" font-weight="700">Up next</text>
      </g>
      <text x="88" y="196" fill="${palette.textPrimary}" font-family="Georgia, Aptos, serif" font-size="${leftTitleFontSize}" font-weight="700">${escapeXml(weekdayLabel)}</text>
      <text x="88" y="246" fill="${palette.textPrimary}" font-family="Georgia, Aptos, serif" font-size="${dateHeadlineFontSize}" font-weight="700">${escapeXml(dateHeadline)}</text>
      <text x="88" y="284" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="24">Updated ${escapeXml(timeLabel)}  |  ${upcoming.length} upcoming items</text>

      <text x="88" y="324" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="18" letter-spacing="1.5">UP NEXT</text>
      ${buildAgendaRows(upcoming, config.theme.density, agendaStartY)}

      <g transform="translate(88 ${height - 170})">
        <rect width="200" height="92" rx="28" fill="rgba(255,255,255,0.05)" />
        <text x="26" y="38" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="16">Synced feeds</text>
        <text x="26" y="72" fill="${palette.textPrimary}" font-family="Aptos, Segoe UI, sans-serif" font-size="32" font-weight="700">${syncedCount}</text>
      </g>
      <g transform="translate(304 ${height - 170})">
        <rect width="200" height="92" rx="28" fill="rgba(255,255,255,0.05)" />
        <text x="26" y="38" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="16">Custom entries</text>
        <text x="26" y="72" fill="${palette.textPrimary}" font-family="Aptos, Segoe UI, sans-serif" font-size="32" font-weight="700">${customCount}</text>
      </g>
      <g transform="translate(520 ${height - 170})">
        <rect width="200" height="92" rx="28" fill="rgba(255,255,255,0.05)" />
        <text x="26" y="38" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="16">Public holidays</text>
        <text x="26" y="72" fill="${palette.textPrimary}" font-family="Aptos, Segoe UI, sans-serif" font-size="32" font-weight="700">${holidayCount}</text>
      </g>

      <text x="874" y="136" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="20" letter-spacing="2.5">THIS MONTH</text>
      <text x="874" y="194" fill="${palette.textPrimary}" font-family="Georgia, Aptos, serif" font-size="${monthTitleFontSize}" font-weight="700">${escapeXml(monthLabel)}</text>
      <text x="874" y="232" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="22">Dots show days with something on the board.</text>
      <text x="874" y="262" fill="${palette.textMuted}" font-family="Aptos, Segoe UI, sans-serif" font-size="18">${markedDays} days carry events or holidays in this view.</text>
      ${buildMonthCells(config, events)}
    </svg>
  `;

  return {
    svg,
    previewDataUrl: svgToDataUrl(svg),
    renderedAt: new Date().toISOString()
  };
}
