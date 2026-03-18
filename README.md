# Calendar Canvas

Calendar Canvas is a Windows-friendly desktop utility that turns your calendar into the wallpaper itself.

It syncs ICS feeds, layers on custom entries, adds public holidays, renders a styled wallpaper preview, and can automatically apply the generated wallpaper after each refresh.

## What It Supports

- Remote ICS subscription URLs from services like Google Calendar, Outlook, and Apple Calendar
- Local `.ics` files for offline or exported calendar feeds
- Custom entries for birthdays, reminders, deadlines, or one-off notes
- Public holidays by country, with optional subdivision or state code
- Theme palettes with live in-app preview updates
- Tray icon with quick actions for opening the studio, syncing, applying the wallpaper, and quitting
- Automatic wallpaper regeneration and application after sync
- Local persistence for settings and output path

## Quick Start

```bash
npm install
npm run dev
```

If your workspace drive blocks `node_modules` installs, `npm run dev` will automatically fall back to a shadow dev folder under `%LOCALAPPDATA%\CalendarCanvasDev`.

For a production build:

```bash
npm run build
npm start
```

## Tray Behavior

- Closing the main window hides the app to the system tray instead of fully exiting.
- Click the tray icon to reopen the studio.
- Use the tray menu for `Sync now`, `Apply wallpaper`, `Open wallpaper folder`, or `Quit`.

## Suggested First Setup

1. Add at least one ICS source.
2. Choose your holiday country.
3. Add any local custom entries you want blended into the wallpaper.
4. Save settings.
5. Click `Sync now`.
6. Click `Apply wallpaper` if auto-apply is disabled.

## Notes

- The app stores its config inside Electron's user data folder.
- The default wallpaper output file is written into your Pictures folder under `Calendar Canvas`.
- The wallpaper header now keeps the date hierarchy simpler so the month and year are not repeated across both panels.
- If an ICS source fails, the error is surfaced in the warnings panel instead of crashing the app.
