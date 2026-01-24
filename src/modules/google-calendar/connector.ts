import {OAuth} from '/jslib/js/oauth.js';
import {CalendarEntry} from './calendar_entry.js';
import {checkNonUndefined} from '/jslib/js/preconditions.js';
import {promiseLog} from '/jslib/js/promise.js';

/**
 * @typedef {Object} CalendarItem
 */

/**
 * Calendar connector class
 */
export class CalendarConnector {
  #oAuth;

  /**
   * @param {OAuth} oAuth
   */
  constructor(oAuth) {
    console.log('CalendarControllerRetriever created');
    this.#oAuth = oAuth;
  }

  /**
   * @param {string} calendarId
   * @return {Promise<CalendarResult>}
   */
  retrieveData(calendarId) {
    return this.#retrieveDataWithRetry(calendarId);
  }

  /**
   * @param {Object[]} items
   * @param {string} destCalendarId
   * @return {Promise<any>}
   */
  syncWithCalendar(items, destCalendarId) {
    return this.#oAuth.getAccessToken()
        .then((accessToken) => this.#sendImportRequests(items, destCalendarId, accessToken).then((itemIds) => this.#removeItemsFromSynced(itemIds, destCalendarId, accessToken)));
  }

  /**
   * @param {string} calendarId
   * @param {boolean} isItSecondTry
   * @return {Promise<CalendarResult>}
   */
  #retrieveDataWithRetry(calendarId, isItSecondTry = false) {
    const consoleTimeId = `CalendarControllerRetriever.retrieveDataWithRetry ${new Date().toLocaleTimeString([], {timeStyle: 'short'})} calendarId=${calendarId} isItSecondTry=${isItSecondTry}`;
    console.time(consoleTimeId);

    return this.#oAuth.getAccessToken(/* use isItSecondTry flag to force refresh on second try*/ isItSecondTry)
        // Using '0' as minus days to properly synchronize daily recurring events.
    // If it was set to 1, we would take the daily event from yesterday and only first recurring event
    // instance is synchronized.
        .then((accessToken) => this.#fetchEvents(accessToken, 0, 1, calendarId))
        .then((response) =>
          (response.status == 200) ?
             response.json().then((json) => new CalendarResult(json, calendarId)) :
             (isItSecondTry ?
                response.text().then((text) => new CalendarResult('', calendarId, 'Error: ' + text)) :
                this.#retrieveDataWithRetry(calendarId, true)))
        .finally(() => console.timeEnd(consoleTimeId));
  }


  /**
   * @param {string} accessToken
   * @param {number} minusDays
   * @param {number} plusDays
   * @param {string} calendarName
   * @return {Promise<Response>}
   */
  #fetchEvents(accessToken, minusDays, plusDays, calendarName) {
    const cutOffStart = new Date();
    const cutOffEnd = new Date();
    // Always operate on full calendar days
    cutOffStart.setHours(0, 0, 0, 0);
    cutOffEnd.setHours(23, 59, 59, 999);

    cutOffStart.setDate(cutOffStart.getDate() - minusDays);
    cutOffEnd.setDate(cutOffEnd.getDate() + plusDays);

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarName}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', cutOffStart.toISOString());
    url.searchParams.set('timeMax', cutOffEnd.toISOString());
    /** @type {RequestInit} */
    const params = {method: 'GET', mode: 'cors', headers: {'Authorization': `Bearer ${accessToken}`}};
    return fetch(url, params);
  }

  /**
   * Will return all the itemIds that were added.
   *
   * @param {CalendarItem[]} items
   * @param {string} destCalendarId
   * @param {string} accessToken
   * @return {Promise<Set<string>>}
   */
  #sendImportRequests(items, destCalendarId, accessToken) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${destCalendarId}/events/import`);

    const itemIds = new Set();
    const itemsToAdd = [];

    for (const item of items
        .filter((item) => CalendarEntry.getItemStatus(item) === 'accepted')
        .map((item) => ({iCalUID: item.iCalUID.replace(/_R[0-9]{8}T[0-9]{6}/, ''), start: item.start, end: item.end, location: item.location, summary: item.summary}))) {
      // Recurring items will have the same id after the '_R...' substring is replaced.
      // Let's add only the first instance.
      if (itemIds.has(item.iCalUID)) {
        console.log('skipping already added recurring item', item);
      } else {
        console.log('adding', item);
        itemsToAdd.push(item);
        itemIds.add(item.iCalUID);
      }
    }

    return Promise.all(itemsToAdd
        .map((data) => (/** @type {RequestInit} */(
          {method: 'POST', mode: 'cors', body: JSON.stringify(data), headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`}}
        )))
        .map((request) => fetch(url, request)))
        .then(() => itemIds);
  }

  /**
   * @param {Set<string>} toKeep
   * @param {string} destCalendarId
   * @param {string} accessToken
   * @return {Promise<any>}
   */
  #removeItemsFromSynced(toKeep, destCalendarId, accessToken) {
    return this.#fetchEvents(accessToken, 180, 180, destCalendarId)
        .then((response) => (response.status == 200) ? response.json() : undefined)
        .then((json) => checkNonUndefined(json).items.filter((item) => !toKeep.has(item.iCalUID)))
        .then((items) => promiseLog(`will remove ${items.length} items`, items))
        .then((items) => this.#sendDeleteRequests(items, destCalendarId, accessToken));
  }

  /**
   * Will return all the itemIds that were added.
   *
   * @param {CalendarItem[]} items
   * @param {string} destCalendarId
   * @param {string} accessToken
   * @return {Promise<any>}
   */
  #sendDeleteRequests(items, destCalendarId, accessToken) {
    /** @type {RequestInit} */
    const params = {method: 'DELETE', mode: 'cors', headers: {'Authorization': `Bearer ${accessToken}`}};

    items.forEach((item) => console.log('removing', item));
    return Promise.all(items
        .map((item) => new URL(`https://www.googleapis.com/calendar/v3/calendars/${destCalendarId}/events/${item.id}`))
        .map((url) => fetch(url, params)));
  }
}

/**
 * Calendar result
 */
export class CalendarResult {
  /** @type {CalendarEntry[]} */
  #calendarEntries;

  /** @type {number} */
  #lastUpdateMillis;

  /** @type {string} */
  #errorMessage;

  /**
   * @param {Object} json
   * @param {string} calendarId
   * @param {string} errorMessage
   */
  constructor(json, calendarId, errorMessage = '') {
    if (errorMessage === '') {
      this.#calendarEntries = json.items.map((item) => new CalendarEntry(item, calendarId));
      this.#lastUpdateMillis = new Date(json.updated).getTime();
    } else {
      this.#calendarEntries = [];
      this.#lastUpdateMillis = -1;
    }

    this.#errorMessage = errorMessage;
  }

  /**
   * @return {boolean}
   */
  hasError() {
    return this.#errorMessage != '';
  }

  /**
   * @return {string}
   */
  getError() {
    return this.#errorMessage;
  }

  /**
   * @return {CalendarEntry[]}
   */
  getCalendarEntries() {
    return this.#calendarEntries;
  }

  /**
   * @return {number}
   */
  getLastUpdateMillis() {
    return this.#lastUpdateMillis;
  }

  /**
   * @return {String}
   */
  toString() {
    return `lastUpdate: ${new Date(this.#lastUpdateMillis).toLocaleString('sv')}, #entries: ${this.#calendarEntries.length}, error: ${this.#errorMessage || '<null>'}`;
  }
}

