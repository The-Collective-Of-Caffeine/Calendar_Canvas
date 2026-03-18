import path from "path";
import { promises as fs } from "fs";
import type { App } from "electron";
import type {
  CalendarConfig,
  CustomEntry,
  SyncSource
} from "../shared/types";
import { DEFAULT_ACCENT } from "../shared/calendar";

export interface AppPaths {
  userDataDir: string;
  configFile: string;
  picturesDir: string;
  defaultWallpaperFile: string;
}

export function resolveAppPaths(app: App): AppPaths {
  const userDataDir = path.join(app.getPath("userData"), "calendar-canvas");
  const picturesDir = path.join(app.getPath("pictures"), "Calendar Canvas");

  return {
    userDataDir,
    configFile: path.join(userDataDir, "config.json"),
    picturesDir,
    defaultWallpaperFile: path.join(
      picturesDir,
      "calendar-canvas-wallpaper.png"
    )
  };
}

export function createDefaultConfig(paths: AppPaths): CalendarConfig {
  return {
    sync: {
      refreshIntervalMinutes: 30,
      lookAheadDays: 21
    },
    syncSources: [],
    customEntries: [],
    holidays: {
      enabled: true,
      countryCode: "ZA",
      subdivision: ""
    },
    theme: {
      palette: "aurora",
      accentColor: DEFAULT_ACCENT,
      showMiniMonth: true,
      density: "comfortable"
    },
    wallpaper: {
      autoApplyOnSync: true,
      outputPath: paths.defaultWallpaperFile,
      resolutionWidth: 1920,
      resolutionHeight: 1080
    }
  };
}

function parsePositiveNumber(
  value: unknown,
  fallback: number,
  minimum = 1
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.round(parsed));
}

function normalizeSource(source: Partial<SyncSource>): SyncSource {
  return {
    id: source.id || crypto.randomUUID(),
    name: source.name?.trim() || "Calendar Feed",
    type: source.type === "ics-file" ? "ics-file" : "ics-url",
    value: source.value?.trim() || "",
    enabled: source.enabled ?? true,
    color: source.color?.trim() || "#8bd9ff"
  };
}

function normalizeEntry(entry: Partial<CustomEntry>): CustomEntry {
  return {
    id: entry.id || crypto.randomUUID(),
    title: entry.title?.trim() || "Custom entry",
    date: entry.date?.trim() || new Date().toISOString().slice(0, 10),
    startTime: entry.startTime?.trim() || "",
    endTime: entry.endTime?.trim() || "",
    notes: entry.notes?.trim() || "",
    kind:
      entry.kind === "birthday" ||
      entry.kind === "deadline" ||
      entry.kind === "anniversary"
        ? entry.kind
        : "custom",
    color: entry.color?.trim() || "#ffd166"
  };
}

export function normalizeConfig(
  config: Partial<CalendarConfig> | undefined,
  paths: AppPaths
): CalendarConfig {
  const defaults = createDefaultConfig(paths);

  return {
    sync: {
      refreshIntervalMinutes: parsePositiveNumber(
        config?.sync?.refreshIntervalMinutes,
        defaults.sync.refreshIntervalMinutes,
        5
      ),
      lookAheadDays: parsePositiveNumber(
        config?.sync?.lookAheadDays,
        defaults.sync.lookAheadDays,
        7
      )
    },
    syncSources: Array.isArray(config?.syncSources)
      ? config.syncSources.map((source) => normalizeSource(source))
      : defaults.syncSources,
    customEntries: Array.isArray(config?.customEntries)
      ? config.customEntries.map((entry) => normalizeEntry(entry))
      : defaults.customEntries,
    holidays: {
      enabled: config?.holidays?.enabled ?? defaults.holidays.enabled,
      countryCode:
        config?.holidays?.countryCode?.trim().toUpperCase() ||
        defaults.holidays.countryCode,
      subdivision: config?.holidays?.subdivision?.trim() || ""
    },
    theme: {
      palette: config?.theme?.palette || defaults.theme.palette,
      accentColor:
        config?.theme?.accentColor?.trim() || defaults.theme.accentColor,
      showMiniMonth:
        config?.theme?.showMiniMonth ?? defaults.theme.showMiniMonth,
      density: config?.theme?.density || defaults.theme.density
    },
    wallpaper: {
      autoApplyOnSync:
        config?.wallpaper?.autoApplyOnSync ??
        defaults.wallpaper.autoApplyOnSync,
      outputPath:
        config?.wallpaper?.outputPath?.trim() ||
        defaults.wallpaper.outputPath,
      resolutionWidth: parsePositiveNumber(
        config?.wallpaper?.resolutionWidth,
        defaults.wallpaper.resolutionWidth,
        1280
      ),
      resolutionHeight: parsePositiveNumber(
        config?.wallpaper?.resolutionHeight,
        defaults.wallpaper.resolutionHeight,
        720
      )
    },
    lastSyncedAt: config?.lastSyncedAt
  };
}

export async function loadConfig(paths: AppPaths): Promise<CalendarConfig> {
  await fs.mkdir(paths.userDataDir, { recursive: true });

  try {
    const raw = await fs.readFile(paths.configFile, "utf-8");
    return normalizeConfig(JSON.parse(raw) as Partial<CalendarConfig>, paths);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to read config, using defaults instead.", error);
    }

    const defaults = createDefaultConfig(paths);
    await saveConfig(paths, defaults);
    return defaults;
  }
}

export async function saveConfig(
  paths: AppPaths,
  config: CalendarConfig
): Promise<CalendarConfig> {
  const normalized = normalizeConfig(config, paths);

  await fs.mkdir(path.dirname(paths.configFile), { recursive: true });
  await fs.writeFile(
    paths.configFile,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );

  return normalized;
}
