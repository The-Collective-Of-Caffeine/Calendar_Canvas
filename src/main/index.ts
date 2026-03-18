import path from "path";
import { app, BrowserWindow, ipcMain, shell, Tray } from "electron";
import type { DashboardState, CalendarConfig, CountryOption } from "../shared/types";
import { loadConfig, resolveAppPaths, saveConfig, type AppPaths } from "./config";
import { collectCalendarEvents, listHolidayCountries } from "./sync";
import { applyWallpaper, renderWallpaper } from "./wallpaper";
import { createTrayIcon, updateTray } from "./tray";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appPaths: AppPaths;
let countries: CountryOption[] = [];
let config: CalendarConfig;
let events: DashboardState["events"] = [];
let warnings: string[] = [];
let previewDataUrl = "";
let renderedAt = "";
let lastWallpaperPath: string | undefined;
let syncTimer: NodeJS.Timeout | null = null;
let isQuitting = false;
let hasShownTrayHint = false;

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const SHOULD_OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === "1";

function buildDashboardState(): DashboardState {
  return {
    config,
    events,
    warnings,
    previewDataUrl,
    countries,
    lastWallpaperPath,
    renderedAt
  };
}

async function refreshDashboard(shouldApplyWallpaper = false): Promise<DashboardState> {
  const syncResponse = await collectCalendarEvents(config);
  const renderResponse = renderWallpaper(config, syncResponse.events);

  events = syncResponse.events;
  warnings = syncResponse.warnings;
  previewDataUrl = renderResponse.previewDataUrl;
  renderedAt = renderResponse.renderedAt;
  config = {
    ...config,
    lastSyncedAt: new Date().toISOString()
  };

  await saveConfig(appPaths, config);

  if (shouldApplyWallpaper) {
    try {
      lastWallpaperPath = await applyWallpaper(config, renderResponse.svg);
    } catch (error) {
      warnings = [
        ...warnings,
        `Wallpaper apply: ${(error as Error).message || "Wallpaper update failed"}`
      ];
    }
  }

  refreshTrayMenu();
  return buildDashboardState();
}

function scheduleBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  const intervalMs = config.sync.refreshIntervalMinutes * 60_000;

  syncTimer = setInterval(() => {
    void refreshDashboard(config.wallpaper.autoApplyOnSync);
  }, intervalMs);
}

function hideMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

async function showMainWindow(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function refreshTrayMenu(): void {
  if (!tray) {
    return;
  }

  updateTray(tray, {
    config,
    isWindowVisible: Boolean(mainWindow && mainWindow.isVisible()),
    lastWallpaperPath,
    onShowWindow: () => {
      void showMainWindow();
    },
    onHideWindow: () => hideMainWindow(),
    onSyncNow: () => {
      void refreshDashboard(config.wallpaper.autoApplyOnSync);
    },
    onApplyWallpaper: () => {
      void refreshDashboard(true);
    },
    onOpenWallpaperFolder: () => {
      const target = lastWallpaperPath || config.wallpaper.outputPath;
      shell.showItemInFolder(target);
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });
}

function createTray(): void {
  if (tray) {
    refreshTrayMenu();
    return;
  }

  tray = new Tray(createTrayIcon(config));
  tray.on("click", () => {
    void showMainWindow();
  });
  tray.on("double-click", () => {
    void showMainWindow();
  });
  refreshTrayMenu();
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 1020,
    minWidth: 1260,
    minHeight: 860,
    title: "Calendar Canvas",
    backgroundColor: "#0f1522",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();

    if (
      tray &&
      !hasShownTrayHint &&
      process.platform === "win32"
    ) {
      tray.displayBalloon({
        iconType: "info",
        title: "Calendar Canvas",
        content: "Still running in the tray. Click the icon to reopen or quit."
      });
      hasShownTrayHint = true;
    }
  });

  mainWindow.on("show", () => {
    refreshTrayMenu();
  });

  mainWindow.on("hide", () => {
    refreshTrayMenu();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    refreshTrayMenu();
  });

  if (DEV_SERVER_URL) {
    if (SHOULD_OPEN_DEVTOOLS) {
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow?.webContents.openDevTools({ mode: "detach" });
      });
    }

    void mainWindow.loadURL(DEV_SERVER_URL).catch((error: Error & { code?: string }) => {
      if (error.code === "ERR_ABORTED") {
        return;
      }

      console.error("Failed to load dev server.", error);
    });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("calendar:get-dashboard", async () => {
    if (!renderedAt) {
      return refreshDashboard(false);
    }

    return buildDashboardState();
  });

  ipcMain.handle("calendar:update-config", async (_, incoming: CalendarConfig) => {
    config = await saveConfig(appPaths, incoming);
    scheduleBackgroundSync();
    refreshTrayMenu();
    return refreshDashboard(false);
  });

  ipcMain.handle("calendar:sync-now", async () =>
    refreshDashboard(config.wallpaper.autoApplyOnSync)
  );

  ipcMain.handle("calendar:apply-wallpaper", async () =>
    refreshDashboard(true)
  );

  ipcMain.handle("calendar:open-wallpaper-folder", async () => {
    const target = lastWallpaperPath || config.wallpaper.outputPath;
    shell.showItemInFolder(target);
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  app.setAppUserModelId("CalendarCanvas");

  appPaths = resolveAppPaths(app);
  countries = await listHolidayCountries();
  config = await loadConfig(appPaths);
  registerIpcHandlers();
  await refreshDashboard(false);
  scheduleBackgroundSync();
  createTray();
  await createWindow();

  app.on("activate", () => {
    void showMainWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

bootstrap().catch((error) => {
  console.error("Calendar Canvas failed to start.", error);
  app.quit();
});
