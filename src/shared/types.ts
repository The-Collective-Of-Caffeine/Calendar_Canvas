export type SyncSourceType = "ics-url" | "ics-file";
export type EventType = "synced" | "custom" | "holiday";
export type ThemePalette = "aurora" | "sunset" | "forest" | "ink";
export type ThemeDensity = "comfortable" | "compact";

export interface SyncSettings {
  refreshIntervalMinutes: number;
  lookAheadDays: number;
}

export interface SyncSource {
  id: string;
  name: string;
  type: SyncSourceType;
  value: string;
  enabled: boolean;
  color: string;
}

export interface CustomEntry {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  notes: string;
  kind: "custom" | "birthday" | "deadline" | "anniversary";
  color: string;
}

export interface HolidaySettings {
  enabled: boolean;
  countryCode: string;
  subdivision: string;
}

export interface ThemeSettings {
  palette: ThemePalette;
  accentColor: string;
  showMiniMonth: boolean;
  density: ThemeDensity;
}

export interface WallpaperSettings {
  autoApplyOnSync: boolean;
  outputPath: string;
  resolutionWidth: number;
  resolutionHeight: number;
}

export interface CalendarConfig {
  sync: SyncSettings;
  syncSources: SyncSource[];
  customEntries: CustomEntry[];
  holidays: HolidaySettings;
  theme: ThemeSettings;
  wallpaper: WallpaperSettings;
  lastSyncedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  type: EventType;
  sourceId: string;
  sourceName: string;
  notes?: string;
  color: string;
  badge: string;
}

export interface CountryOption {
  code: string;
  name: string;
}

export interface DashboardState {
  config: CalendarConfig;
  events: CalendarEvent[];
  previewDataUrl: string;
  warnings: string[];
  countries: CountryOption[];
  lastWallpaperPath?: string;
  renderedAt: string;
}
