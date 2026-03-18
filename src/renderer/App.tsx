import { useEffect, useState, type CSSProperties } from "react";
import type {
  CalendarConfig,
  CustomEntry,
  DashboardState,
  SyncSource
} from "../shared/types";
import {
  filterUpcomingEvents,
  formatDateLabel,
  formatTimeLabel,
  getPalette
} from "../shared/calendar";
import { renderWallpaper } from "../shared/wallpaper";

const sourceColors = ["#8bd9ff", "#ffd166", "#ff9f7f", "#7ce0a3", "#e0b0ff"];

function createSyncSource(): SyncSource {
  return {
    id: crypto.randomUUID(),
    name: "New feed",
    type: "ics-url",
    value: "",
    enabled: true,
    color: sourceColors[Math.floor(Math.random() * sourceColors.length)]
  };
}

function createCustomEntry(): CustomEntry {
  return {
    id: crypto.randomUUID(),
    title: "Custom event",
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    notes: "",
    kind: "custom",
    color: "#ffd166"
  };
}

function formatSyncStamp(value?: string): string {
  if (!value) {
    return "Not synced yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function App(): JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    window.calendarApi
      .getDashboard()
      .then((state) => {
        if (!cancelled) {
          setDashboard(state);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage((error as Error).message || "Failed to load app.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateConfig(mutator: (draft: CalendarConfig) => void): void {
    setDashboard((current) => {
      if (!current) {
        return current;
      }

      const nextConfig = structuredClone(current.config);
      mutator(nextConfig);
      return {
        ...current,
        config: nextConfig
      };
    });
    setDirty(true);
  }

  async function persistConfig(): Promise<DashboardState | null> {
    if (!dashboard) {
      return null;
    }

    setBusyLabel("Saving settings");
    setErrorMessage("");

    try {
      const next = await window.calendarApi.updateConfig(dashboard.config);
      setDashboard(next);
      setDirty(false);
      return next;
    } catch (error) {
      setErrorMessage((error as Error).message || "Unable to save settings.");
      return null;
    } finally {
      setBusyLabel("");
    }
  }

  async function runAction(
    label: string,
    action: () => Promise<DashboardState>
  ): Promise<void> {
    if (!dashboard) {
      return;
    }

    setBusyLabel(label);
    setErrorMessage("");

    try {
      if (dirty) {
        const saved = await window.calendarApi.updateConfig(dashboard.config);
        setDashboard(saved);
        setDirty(false);
      }

      const next = await action();
      setDashboard(next);
    } catch (error) {
      setErrorMessage((error as Error).message || "Action failed.");
    } finally {
      setBusyLabel("");
    }
  }

  if (!dashboard) {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">Calendar Canvas</p>
          <h1>Preparing your desktop calendar studio...</h1>
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </div>
      </main>
    );
  }

  const upcoming = filterUpcomingEvents(
    dashboard.events,
    dashboard.config.sync.lookAheadDays
  ).slice(0, 9);
  const liveRender = renderWallpaper(dashboard.config, dashboard.events);
  const palette = getPalette(dashboard.config);
  const themeStyle = {
    "--app-bg-start": palette.backgroundStart,
    "--app-bg-end": palette.backgroundEnd,
    "--app-surface": palette.surface,
    "--app-surface-alt": palette.surfaceAlt,
    "--app-text": palette.textPrimary,
    "--app-muted": palette.textMuted,
    "--app-border": palette.border,
    "--app-accent": palette.accent,
    "--app-accent-soft": `${palette.accent}1f`
  } as CSSProperties;

  return (
    <main className="app-shell" style={themeStyle}>
      <div className="hero-grid">
        <section className="hero-card panel">
          <p className="eyebrow">Dynamic calendar wallpaper</p>
          <h1>Turn your desktop into a live agenda that can sync, adapt, and re-apply itself.</h1>
          <p className="hero-copy">
            Feed it ICS links from Google, Outlook, or Apple Calendar, layer in
            your own entries, then blend in public holidays before the wallpaper
            is rendered and pushed to Windows.
          </p>

          <div className="action-row">
            <button
              className="primary-button"
              disabled={Boolean(busyLabel)}
              onClick={() => void persistConfig()}
            >
              {busyLabel === "Saving settings" ? "Saving..." : dirty ? "Save settings" : "Saved"}
            </button>
            <button
              className="secondary-button"
              disabled={Boolean(busyLabel)}
              onClick={() =>
                void runAction("Syncing calendars", window.calendarApi.syncNow)
              }
            >
              {busyLabel === "Syncing calendars" ? "Syncing..." : "Sync now"}
            </button>
            <button
              className="secondary-button"
              disabled={Boolean(busyLabel)}
              onClick={() =>
                void runAction(
                  "Rendering and applying wallpaper",
                  window.calendarApi.applyWallpaper
                )
              }
            >
              {busyLabel === "Rendering and applying wallpaper"
                ? "Applying..."
                : "Apply wallpaper"}
            </button>
            <button
              className="ghost-button"
              disabled={Boolean(busyLabel)}
              onClick={() => void window.calendarApi.openWallpaperFolder()}
            >
              Open output folder
            </button>
          </div>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="stat-grid">
            <article className="stat-card">
              <span>Last sync</span>
              <strong>{formatSyncStamp(dashboard.config.lastSyncedAt)}</strong>
            </article>
            <article className="stat-card">
              <span>Feeds</span>
              <strong>{dashboard.config.syncSources.length}</strong>
            </article>
            <article className="stat-card">
              <span>Custom items</span>
              <strong>{dashboard.config.customEntries.length}</strong>
            </article>
            <article className="stat-card">
              <span>Events in preview</span>
              <strong>{dashboard.events.length}</strong>
            </article>
          </div>
        </section>

        <section className="preview-card panel">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">Wallpaper Preview</p>
              <h2>What your desktop will look like</h2>
            </div>
            <p className="preview-note">
              {dirty
                ? "Live preview for unsaved theme changes"
                : `Rendered ${formatSyncStamp(dashboard.renderedAt)}`}
            </p>
          </div>
          <div className="preview-frame">
            <img
              src={dirty ? liveRender.previewDataUrl : liveRender.previewDataUrl}
              alt="Rendered calendar wallpaper preview"
            />
          </div>
        </section>
      </div>

      <div className="workspace-grid">
        <section className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sync Sources</p>
              <h2>Remote calendar feeds</h2>
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                updateConfig((draft) => {
                  draft.syncSources.push(createSyncSource());
                })
              }
            >
              Add ICS source
            </button>
          </div>

          <div className="split-fields">
            <label className="field">
              <span>Refresh every (minutes)</span>
              <input
                type="number"
                min={5}
                value={dashboard.config.sync.refreshIntervalMinutes}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.sync.refreshIntervalMinutes = Number(
                      event.target.value
                    );
                  })
                }
              />
            </label>
            <label className="field">
              <span>Look ahead window (days)</span>
              <input
                type="number"
                min={7}
                value={dashboard.config.sync.lookAheadDays}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.sync.lookAheadDays = Number(event.target.value);
                  })
                }
              />
            </label>
          </div>

          <div className="stack-list">
            {dashboard.config.syncSources.length === 0 ? (
              <div className="empty-state">
                Add a Google, Outlook, or Apple Calendar ICS subscription URL,
                or point to a local `.ics` file for offline sync.
              </div>
            ) : null}

            {dashboard.config.syncSources.map((source) => (
              <article className="collection-card" key={source.id}>
                <div className="triple-grid">
                  <label className="field">
                    <span>Feed name</span>
                    <input
                      type="text"
                      value={source.name}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.syncSources.find(
                            (item) => item.id === source.id
                          );
                          if (target) {
                            target.name = event.target.value;
                          }
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Source type</span>
                    <select
                      value={source.type}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.syncSources.find(
                            (item) => item.id === source.id
                          );
                          if (target) {
                            target.type =
                              event.target.value === "ics-file"
                                ? "ics-file"
                                : "ics-url";
                          }
                        })
                      }
                    >
                      <option value="ics-url">Remote ICS URL</option>
                      <option value="ics-file">Local ICS file</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Accent color</span>
                    <input
                      type="color"
                      value={source.color}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.syncSources.find(
                            (item) => item.id === source.id
                          );
                          if (target) {
                            target.color = event.target.value;
                          }
                        })
                      }
                    />
                  </label>
                </div>

                <div className="quad-grid">
                  <label className="field field-span-3">
                    <span>
                      {source.type === "ics-url"
                        ? "Subscription URL"
                        : "Local file path"}
                    </span>
                    <input
                      type="text"
                      placeholder={
                        source.type === "ics-url"
                          ? "https://calendar.example.com/feed.ics"
                          : "C:\\Calendars\\team.ics"
                      }
                      value={source.value}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.syncSources.find(
                            (item) => item.id === source.id
                          );
                          if (target) {
                            target.value = event.target.value;
                          }
                        })
                      }
                    />
                  </label>
                  <label className="field checkbox-field">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.syncSources.find(
                            (item) => item.id === source.id
                          );
                          if (target) {
                            target.enabled = event.target.checked;
                          }
                        })
                      }
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <button
                    className="danger-button"
                    onClick={() =>
                      updateConfig((draft) => {
                        draft.syncSources = draft.syncSources.filter(
                          (item) => item.id !== source.id
                        );
                      })
                    }
                  >
                    Remove feed
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Wallpaper Settings</p>
              <h2>Render and apply behavior</h2>
            </div>
          </div>

          <div className="stack-list">
            <label className="field checkbox-row">
              <span>Auto-apply wallpaper after sync</span>
              <input
                type="checkbox"
                checked={dashboard.config.wallpaper.autoApplyOnSync}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.wallpaper.autoApplyOnSync = event.target.checked;
                  })
                }
              />
            </label>

            <label className="field">
              <span>Output file path</span>
              <input
                type="text"
                value={dashboard.config.wallpaper.outputPath}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.wallpaper.outputPath = event.target.value;
                  })
                }
              />
            </label>

            <div className="split-fields">
              <label className="field">
                <span>Width</span>
                <input
                  type="number"
                  min={1280}
                  step={1}
                  value={dashboard.config.wallpaper.resolutionWidth}
                  onChange={(event) =>
                    updateConfig((draft) => {
                      draft.wallpaper.resolutionWidth = Number(
                        event.target.value
                      );
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Height</span>
                <input
                  type="number"
                  min={720}
                  step={1}
                  value={dashboard.config.wallpaper.resolutionHeight}
                  onChange={(event) =>
                    updateConfig((draft) => {
                      draft.wallpaper.resolutionHeight = Number(
                        event.target.value
                      );
                    })
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Theme And Holidays</p>
              <h2>Visual direction and country calendar</h2>
            </div>
          </div>

          <div className="stack-list">
            <label className="field">
              <span>Theme palette</span>
              <select
                value={dashboard.config.theme.palette}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.theme.palette = event.target.value as
                      | "aurora"
                      | "sunset"
                      | "forest"
                      | "ink";
                  })
                }
              >
                <option value="aurora">Aurora</option>
                <option value="sunset">Sunset</option>
                <option value="forest">Forest</option>
                <option value="ink">Ink</option>
              </select>
            </label>

            <label className="field">
              <span>Accent color</span>
              <input
                type="color"
                value={dashboard.config.theme.accentColor}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.theme.accentColor = event.target.value;
                  })
                }
              />
            </label>

            <label className="field">
              <span>Layout density</span>
              <select
                value={dashboard.config.theme.density}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.theme.density =
                      event.target.value === "compact"
                        ? "compact"
                        : "comfortable";
                  })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>

            <label className="field checkbox-row">
              <span>Show mini month panel</span>
              <input
                type="checkbox"
                checked={dashboard.config.theme.showMiniMonth}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.theme.showMiniMonth = event.target.checked;
                  })
                }
              />
            </label>

            <label className="field checkbox-row">
              <span>Public holidays enabled</span>
              <input
                type="checkbox"
                checked={dashboard.config.holidays.enabled}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.holidays.enabled = event.target.checked;
                  })
                }
              />
            </label>

            <label className="field">
              <span>Country</span>
              <select
                value={dashboard.config.holidays.countryCode}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.holidays.countryCode = event.target.value;
                  })
                }
              >
                {dashboard.countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Subdivision / state code</span>
              <input
                type="text"
                placeholder="Optional, for example CA or GP"
                value={dashboard.config.holidays.subdivision}
                onChange={(event) =>
                  updateConfig((draft) => {
                    draft.holidays.subdivision = event.target.value;
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Custom Entries</p>
              <h2>Local items that live beside synced events</h2>
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                updateConfig((draft) => {
                  draft.customEntries.push(createCustomEntry());
                })
              }
            >
              Add custom entry
            </button>
          </div>

          <div className="stack-list">
            {dashboard.config.customEntries.length === 0 ? (
              <div className="empty-state">
                Use custom entries for birthdays, deadlines, one-off reminders,
                or anything you do not want to source from a synced calendar.
              </div>
            ) : null}

            {dashboard.config.customEntries.map((entry) => (
              <article className="collection-card" key={entry.id}>
                <div className="triple-grid">
                  <label className="field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.title = event.target.value;
                          }
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Kind</span>
                    <select
                      value={entry.kind}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.kind = event.target.value as CustomEntry["kind"];
                          }
                        })
                      }
                    >
                      <option value="custom">Custom</option>
                      <option value="birthday">Birthday</option>
                      <option value="deadline">Deadline</option>
                      <option value="anniversary">Anniversary</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Color</span>
                    <input
                      type="color"
                      value={entry.color}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.color = event.target.value;
                          }
                        })
                      }
                    />
                  </label>
                </div>

                <div className="quad-grid">
                  <label className="field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.date = event.target.value;
                          }
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Start time</span>
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.startTime = event.target.value;
                          }
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>End time</span>
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(event) =>
                        updateConfig((draft) => {
                          const target = draft.customEntries.find(
                            (item) => item.id === entry.id
                          );
                          if (target) {
                            target.endTime = event.target.value;
                          }
                        })
                      }
                    />
                  </label>

                  <button
                    className="danger-button align-end"
                    onClick={() =>
                      updateConfig((draft) => {
                        draft.customEntries = draft.customEntries.filter(
                          (item) => item.id !== entry.id
                        );
                      })
                    }
                  >
                    Remove
                  </button>
                </div>

                <label className="field">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={entry.notes}
                    onChange={(event) =>
                      updateConfig((draft) => {
                        const target = draft.customEntries.find(
                          (item) => item.id === entry.id
                        );
                        if (target) {
                          target.notes = event.target.value;
                        }
                      })
                    }
                  />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Upcoming</p>
              <h2>What will appear next</h2>
            </div>
          </div>

          <div className="agenda-list">
            {upcoming.length === 0 ? (
              <div className="empty-state">
                No upcoming items in the current look-ahead window.
              </div>
            ) : null}

            {upcoming.map((event) => (
              <article className="agenda-item" key={event.id}>
                <span
                  className="agenda-dot"
                  style={{ backgroundColor: event.color }}
                />
                <div>
                  <strong>{event.title}</strong>
                  <p>
                    {formatDateLabel(event.start)} | {formatTimeLabel(event)}
                  </p>
                </div>
                <span className="badge">{event.badge}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Warnings</p>
              <h2>Sync issues and notes</h2>
            </div>
          </div>

          <div className="warning-list">
            {dashboard.warnings.length === 0 ? (
              <div className="empty-state">
                No warnings right now. Once a feed fails or a holiday region is
                misconfigured, details will show here.
              </div>
            ) : null}

            {dashboard.warnings.map((warning) => (
              <article className="warning-card" key={warning}>
                {warning}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
