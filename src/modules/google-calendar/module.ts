import {ScheduledModuleInterface, RefreshResult, DefaultConfig} from '../interface';
import {CalendarConnector, CalendarResult} from './connector';
import {createRefreshResult, CSS} from './response_processor';
import {DEFAULT_CONFIG} from './config';
import {OAuth, OAuthSettings, launchOAuthPopup} from '../../lib/oauth';
import {upsertOAuthSettingsForGoogle} from '../../lib/oauth-defaults';

// Force sync and render calendar once per 6 hours.
const MAX_INTERVAL_BETWEEN_SYNC_MS = 21600000;

/**
 * Implements ScheduledModuleInterface
 */
export class GoogleCalendarModule extends ScheduledModuleInterface {
  #oAuthSettings: OAuthSettings | undefined;
  #sourceCalendars: string[];
  #requiredLocationPrefix: string[];
  #lastRenderMillis: number = 0;

  constructor() {
    // Let's repeat every 4 minuts - it will not interfere with the usual scheduling
    // times at full and half hour.
    // The extra refreshes for notifications will be:
    // x:55:00, x:59:30, x+1:00:30, x+1:05:00, x+1:15
    //
    // while scheduling every 4 minutes gives updates at:
    // x:52, x:56, x+1:00, x+1:04, x+1:08, ..., x+1:16
    super(4, CSS);

    this.#sourceCalendars = [];
    this.#requiredLocationPrefix = [];
  }

  override refresh(forced: boolean): Promise<RefreshResult> | RefreshResult {
    if (!this.#oAuthSettings) {
      this.#lastRenderMillis = 0;
      return Promise.reject(new Error('Configuration was not set.'));
    }

    if (!this.#oAuthSettings.isInitialised()) {
      this.#lastRenderMillis = 0;
      return Promise.reject(new Error('Scope, clientId or clientSecret is not set. Please go to the settings page.'));
    }

    if (!this.#oAuthSettings.hasRefreshToken()) {
      return {
        items: [{value: 'Click to authenticate', onclick: () => launchOAuthPopup(this.#oAuthSettings!)}],
        // Force refresh every 2 seconds.
        forceNextRefreshTs: new Date().getTime() / 1000 + 2,
      };
    }

    // Everything was checked, we can now proceed.
    // Creating connector is inexpensive - it only sets proper references inside.
    const connector = new CalendarConnector(new OAuth(this.#oAuthSettings));
    console.groupCollapsed(
      `CalendarModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`,
    );
    const timeSync = 'CalendarModule.refresh: sync time';
    const timeRender = 'CalendarModule.refresh: retrieve time';
    console.time(timeSync);
    console.time(timeRender);

    return Promise.all(this.#sourceCalendars.map((calendarId) => connector.retrieveData(calendarId)))
      .then((results) => this.#createRefreshResult(results, forced))
      .catch((err: Error) => {
        // If error is thrown from this method, it will be rendered. Reset the last render to force it during the next update.
        this.#lastRenderMillis = 0;
        throw err;
      })
      .finally(() => console.timeEnd(timeRender))
      .finally(() => console.groupEnd());
  }

  #createRefreshResult(calendarResults: CalendarResult[], forced: boolean): RefreshResult | Promise<RefreshResult> {
    const errorResult = calendarResults.find((calendarResult) => calendarResult.hasError());
    if (errorResult) {
      return Promise.reject(new Error(errorResult.getError()));
    }

    const nowMillis = new Date().getTime();
    if (!forced) {
      const lastUpdateMillis = Math.max(
        ...calendarResults.map((calendarResult) => calendarResult.getLastUpdateMillis()),
      );
      if (
        nowMillis - this.#lastRenderMillis < MAX_INTERVAL_BETWEEN_SYNC_MS &&
        this.#lastRenderMillis > lastUpdateMillis
      ) {
        console.log(`Skipping render, last rendered at: ${new Date(this.#lastRenderMillis).toLocaleString('sv')}`);
        return {skipHtmlUpdate: true, items: []};
      }
    }
    this.#lastRenderMillis = nowMillis;
    const entries = calendarResults.flatMap((calendarResult) => calendarResult.getCalendarEntries());
    return createRefreshResult(entries, this.#sourceCalendars, this.#requiredLocationPrefix);
  }

  override getDefaultConfig(): DefaultConfig {
    return DEFAULT_CONFIG;
  }

  override setConfig(config: Record<string, string>): void {
    this.#sourceCalendars = config['sourceCalendars']?.split(',') || [];
    this.#requiredLocationPrefix = config['requiredLocationPrefix']?.split(',') || [];
    this.#oAuthSettings = upsertOAuthSettingsForGoogle(
      this.name,
      config['oauthSettingsVersion'] || '',
      config['scope'] || '',
      config['clientId'] || '',
      config['clientSecret'] || '',
    );
  }
}
