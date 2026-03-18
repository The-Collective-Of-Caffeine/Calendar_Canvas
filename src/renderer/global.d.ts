import type { CalendarConfig, DashboardState } from "../shared/types";

declare global {
  interface Window {
    calendarApi: {
      getDashboard: () => Promise<DashboardState>;
      updateConfig: (config: CalendarConfig) => Promise<DashboardState>;
      syncNow: () => Promise<DashboardState>;
      applyWallpaper: () => Promise<DashboardState>;
      openWallpaperFolder: () => Promise<void>;
    };
  }
}

export {};
