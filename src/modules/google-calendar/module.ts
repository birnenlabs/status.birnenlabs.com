import {ScheduledModuleInterface, RefreshResult, DefaultConfig} from '../interface';
import {processOAuth} from './oauth';
import {CalendarConnector, CalendarResult} from './connector';
import {createRefreshResult, CSS} from './response_processor';
import {OAuth} from '../../lib/oauth';
import {combine} from '../../lib/promise';
import {DEFAULT_CONFIG} from './config';

// Force sync and render calendar once per 6 hours.
const MAX_INTERVAL_BETWEEN_SYNC_MS = 21600000;

/**
 * Implements ScheduledModuleInterface
 */
export class GoogleCalendarModule extends ScheduledModuleInterface {
  #connector: CalendarConnector | undefined;
  #errorMessage: string;
  #sourceCalendars: string[];
  #destinationCalendar: string;
  #requiredLocationPrefix: string[];
  #lastRenderMillis: number = 0;
  #lastSyncMillis: number = 0;

  constructor() {
    // Let's repeat every 4 minuts - it will not interfere with the usual scheduling
    // times at full and half hour.
    // The extra refreshes for notifications will be:
    // x:55:00, x:59:30, x+1:00:30, x+1:05:00, x+1:15
    //
    // while scheduling every 4 minutes gives updates at:
    // x:52, x:56, x+1:00, x+1:04, x+1:08, ..., x+1:16
    super(4, CSS);

    this.#errorMessage = 'Configuration was not set.';
    this.#sourceCalendars = [];
    this.#destinationCalendar = '';
    this.#requiredLocationPrefix = [];
  }

  refresh(forced: boolean): Promise<RefreshResult> | RefreshResult {
    if (this.#connector) {
      console.groupCollapsed(
        `CalendarModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`,
      );
      const timeSync = 'CalendarModule.refresh: sync time';
      const timeRender = 'CalendarModule.refresh: retrieve time';
      console.time(timeSync);
      console.time(timeRender);

      const calendarResultPromise: Promise<CalendarResult[]> = Promise.all(
        this.#sourceCalendars.map((calendarId) => this.#connector!.retrieveData(calendarId)),
      );

      const refreshResultPromise: Promise<RefreshResult> = calendarResultPromise
        .then((results) => this.#createRefreshResult(results, forced))
        .finally(() => console.timeEnd(timeRender));

      const syncPromise = calendarResultPromise
        .then((calendarResult) => this.#maybeSyncCalendar(calendarResult.at(0), forced))
        .finally(() => console.timeEnd(timeSync));

      return combine(refreshResultPromise, syncPromise, (refreshResult: RefreshResult) => refreshResult)
        .catch((err: Error) => {
          // If error is thrown from this method, it will be rendered. Reset the last render to force it during the next update.
          this.#lastRenderMillis = 0;
          throw err;
        })
        .finally(() => console.groupEnd());
    } else {
      this.#lastRenderMillis = 0;
      return Promise.reject(new Error(this.#errorMessage));
    }
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

  #maybeSyncCalendar(calendarResult: CalendarResult | undefined, forced: boolean): Promise<void> {
    if (!this.#destinationCalendar) {
      console.log(`Destination calendar not specified, skipping sync.`);
      return Promise.resolve();
    }

    if (!calendarResult || calendarResult.hasError()) {
      console.error(`Maybe sync calendar: invalid result: ${calendarResult}`);
      return Promise.reject(new Error(`Could not sync calendar`));
    }

    if (forced) {
      // Forced flag is set on the first run or when the event status is changed (i.e. from important to urgent).
      // UI should be quickly refreshed at this point, let's not waste time on syncing. The calendar is refreshed
      // every 4 minutes, it is enough for the events sync.
      console.log('Forced refresh - skipping sync');
      return Promise.resolve();
    }

    const nowMillis = new Date().getTime();
    if (
      nowMillis - this.#lastSyncMillis < MAX_INTERVAL_BETWEEN_SYNC_MS &&
      this.#lastSyncMillis > calendarResult.getLastUpdateMillis()
    ) {
      console.log(`Skipping sync, last synced at: ${new Date(this.#lastSyncMillis).toLocaleString('sv')}`);
      return Promise.resolve();
    }

    console.group(`Maybe sync calendar: ${calendarResult}`);
    const calendarItems = calendarResult.getCalendarEntries().map((calendarEntry) => calendarEntry.getItem());
    return this.#connector!.syncWithCalendar(calendarItems, this.#destinationCalendar)
      .then(() => {
        this.#lastSyncMillis = nowMillis;
      })
      .finally(() => console.groupEnd());
  }

  getDefaultConfig(): DefaultConfig {
    return DEFAULT_CONFIG;
  }

  setConfig(config: Record<string, string>): void {
    this.#sourceCalendars = config.sourceCalendars.split(',');
    this.#destinationCalendar = config.destinationCalendar;
    this.#requiredLocationPrefix = config.requiredLocationPrefix.split(',');
    const oAuthOrError = processOAuth(this, config);
    if (oAuthOrError instanceof OAuth) {
      this.#connector = new CalendarConnector(oAuthOrError);
      this.#errorMessage = '';
    } else {
      this.#connector = undefined;
      this.#errorMessage = oAuthOrError;
    }
  }
}
