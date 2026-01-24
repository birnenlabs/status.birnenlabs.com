import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';
import {processOAuth} from './oauth.js';
import {CalendarConnector, CalendarResult} from './connector.js';
import {createRefreshResult, CSS} from './response_processor.js';
import {OAuth} from '/jslib/js/oauth.js';
import {checkNonUndefined} from '/jslib/js/preconditions.js';
import {combine2} from '/jslib/js/promise.js';
import {DEFAULT_CONFIG} from './config.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

// Force sync and render calendar once per 6 hours.
const MAX_INTERVAL_BETWEEN_SYNC_MS = 21600000;

/**
 * Implements ScheduledModuleInterface
 */
export class GoogleCalendarModule extends ScheduledModuleInterface {
  /** @type {CalendarConnector|undefined} */
  #connector;

  /** @type {string} */
  #errorMessage;

  /** @type {string[]} */
  #sourceCalendars;

  /** @type {string} */
  #destinationCalendar;

  /** @type {string[]} */
  #requiredLocationPrefix;

  /** @type {number} */
  #lastRenderMillis = 0;

  /** @type {number} */
  #lastSyncMillis = 0;

  /**
   * constructor
   */
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
  }

  /**
   * @param {boolean} forced
   * @return {Promise<RefreshResult>|RefreshResult}
   */
  refresh(forced) {
    if (this.#connector) {
      console.groupCollapsed(`CalendarModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`);
      const timeSync = 'CalendarModule.refresh: sync time';
      const timeRender = 'CalendarModule.refresh: retrieve time';
      console.time(timeSync);
      console.time(timeRender);

      /** @type {Promise<CalendarResult[]>} */
      const calendarResultPromise = Promise.all(this.#sourceCalendars.map((calendarId) => checkNonUndefined(this.#connector).retrieveData(calendarId)));

      /** @type {Promise<RefreshResult>} */
      const refreshResultPromise = calendarResultPromise
          .then((results) => this.#createRefreshResult(results, forced))
          .finally(() => console.timeEnd(timeRender));

      const syncPromise = calendarResultPromise
          .then((calendarResult) => this.#maybeSyncCalendar(calendarResult.at(0), forced))
          .finally(() => console.timeEnd(timeSync));

      return combine2(refreshResultPromise, syncPromise, (refreshResult, unused) => refreshResult)
          .catch((err) => {
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

  /**
   * @param {CalendarResult[]} calendarResults
   * @param {boolean} forced
   * @return {RefreshResult|Promise<RefreshResult>}
   */
  #createRefreshResult(calendarResults, forced) {
    const errorResult = calendarResults.find((calendarResult) => calendarResult.hasError());
    if (errorResult) {
      return Promise.reject(new Error(errorResult.getError()));
    }

    const nowMillis = new Date().getTime();
    if (!forced) {
      const nowMillis = new Date().getTime();
      const lastUpdateMillis = Math.max(...calendarResults.map((calendarResult) => calendarResult.getLastUpdateMillis()));
      if (nowMillis - this.#lastRenderMillis < MAX_INTERVAL_BETWEEN_SYNC_MS &&
          this.#lastRenderMillis > lastUpdateMillis) {
        console.log(`Skipping render, last rendered at: ${new Date(this.#lastRenderMillis).toLocaleString('sv')}`);
        return {skipHtmlUpdate: true, items: []};
      }
    }
    this.#lastRenderMillis = nowMillis;
    const entries = calendarResults.flatMap((calendarResult) => calendarResult.getCalendarEntries());
    return createRefreshResult(entries, this.#sourceCalendars, this.#requiredLocationPrefix);
  }

  /**
   * @param {CalendarResult|undefined} calendarResult
   * @param {boolean} forced
   * @return {Promise<any>}
   */
  #maybeSyncCalendar(calendarResult, forced) {
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
    if (nowMillis - this.#lastSyncMillis < MAX_INTERVAL_BETWEEN_SYNC_MS &&
        this.#lastSyncMillis > calendarResult.getLastUpdateMillis()) {
      console.log(`Skipping sync, last synced at: ${new Date(this.#lastSyncMillis).toLocaleString('sv')}`);
      return Promise.resolve();
    }

    console.group(`Maybe sync calendar: ${calendarResult}`);
    const calendarItems = calendarResult.getCalendarEntries().map((calendarEntry) => calendarEntry.getItem());
    return checkNonUndefined(this.#connector).syncWithCalendar(calendarItems, this.#destinationCalendar)
        .then(() => {
          this.#lastSyncMillis = nowMillis;
        })
        .finally(() => console.groupEnd());
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return DEFAULT_CONFIG;
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
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
