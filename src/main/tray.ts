import { Menu, Tray, nativeImage, type NativeImage } from "electron";
import { Resvg } from "@resvg/resvg-js";
import type { CalendarConfig } from "../shared/types";

interface TrayMenuState {
  config: CalendarConfig;
  isWindowVisible: boolean;
  lastWallpaperPath?: string;
  onShowWindow: () => void;
  onHideWindow: () => void;
  onSyncNow: () => void;
  onApplyWallpaper: () => void;
  onOpenWallpaperFolder: () => void;
  onQuit: () => void;
}

function formatLastSync(value?: string): string {
  if (!value) {
    return "Last sync: not yet";
  }

  const label = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

  return `Last sync: ${label}`;
}

export function createTrayIcon(config: CalendarConfig): NativeImage {
  const accent = config.theme.accentColor || "#8bd9ff";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="tray-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0c1523" />
          <stop offset="100%" stop-color="#1f3244" />
        </linearGradient>
        <linearGradient id="tray-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#tray-bg)" />
      <rect x="13" y="14" width="38" height="10" rx="5" fill="url(#tray-accent)" />
      <rect x="13" y="22" width="38" height="28" rx="10" fill="#122235" stroke="rgba(255,255,255,0.14)" />
      <circle cx="22" cy="33" r="3.3" fill="${accent}" />
      <circle cx="32" cy="33" r="3.3" fill="rgba(255,255,255,0.72)" />
      <circle cx="42" cy="33" r="3.3" fill="rgba(255,255,255,0.4)" />
      <circle cx="22" cy="43" r="3.3" fill="rgba(255,255,255,0.4)" />
      <circle cx="32" cy="43" r="3.3" fill="${accent}" />
      <circle cx="42" cy="43" r="3.3" fill="rgba(255,255,255,0.72)" />
    </svg>
  `;

  const png = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 64
    }
  }).render().asPng();

  return nativeImage.createFromBuffer(png).resize({
    width: 20,
    height: 20
  });
}

export function updateTray(
  tray: Tray,
  state: TrayMenuState
): void {
  tray.setImage(createTrayIcon(state.config));
  tray.setToolTip("Calendar Canvas");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Calendar Canvas",
        enabled: false
      },
      {
        label: formatLastSync(state.config.lastSyncedAt),
        enabled: false
      },
      {
        type: "separator"
      },
      {
        label: state.isWindowVisible ? "Hide studio" : "Open studio",
        click: () => {
          if (state.isWindowVisible) {
            state.onHideWindow();
          } else {
            state.onShowWindow();
          }
        }
      },
      {
        label: "Sync now",
        click: () => state.onSyncNow()
      },
      {
        label: "Apply wallpaper",
        click: () => state.onApplyWallpaper()
      },
      {
        label: "Open wallpaper folder",
        click: () => state.onOpenWallpaperFolder()
      },
      {
        type: "separator"
      },
      {
        label: "Quit",
        click: () => state.onQuit()
      }
    ])
  );
}
