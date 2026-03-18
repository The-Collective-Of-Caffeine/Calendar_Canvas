import { contextBridge, ipcRenderer } from "electron";
import type { CalendarConfig } from "../shared/types";

contextBridge.exposeInMainWorld("calendarApi", {
  getDashboard: () => ipcRenderer.invoke("calendar:get-dashboard"),
  updateConfig: (config: CalendarConfig) =>
    ipcRenderer.invoke("calendar:update-config", config),
  syncNow: () => ipcRenderer.invoke("calendar:sync-now"),
  applyWallpaper: () => ipcRenderer.invoke("calendar:apply-wallpaper"),
  openWallpaperFolder: () => ipcRenderer.invoke("calendar:open-wallpaper-folder")
});
