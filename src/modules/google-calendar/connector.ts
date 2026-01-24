import {OAuth} from '../../lib/oauth';
import {CalendarEntry, CalendarApiItem} from './calendar_entry';
import {promiseLog} from '../../lib/promise';

interface CalendarApiResponse {
  updated: string;
  items: CalendarApiItem[];
}

/**
 * Calendar connector class
 */
export class CalendarConnector {
  #oAuth: OAuth;

  constructor(oAuth: OAuth) {
    console.log('CalendarControllerRetriever created');
    this.#oAuth = oAuth;
  }

  retrieveData(calendarId: string): Promise<CalendarResult> {
    return this.#retrieveDataWithRetry(calendarId);
  }

  syncWithCalendar(items: CalendarApiItem[], destCalendarId: string): Promise<any> {
    return this.#oAuth.getAccessToken()
        .then((accessToken) => this.#sendImportRequests(items, destCalendarId, accessToken).then((itemIds) => this.#removeItemsFromSynced(itemIds, destCalendarId, accessToken)));
  }

  #retrieveDataWithRetry(calendarId: string, isItSecondTry = false): Promise<CalendarResult> {
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
                response.text().then((text) => new CalendarResult({} as CalendarApiResponse, calendarId, 'Error: ' + text)) :
                this.#retrieveDataWithRetry(calendarId, true)))
        .finally(() => console.timeEnd(consoleTimeId));
  }


  #fetchEvents(accessToken: string, minusDays: number, plusDays: number, calendarName: string): Promise<Response> {
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
    const params: RequestInit = {method: 'GET', mode: 'cors', headers: {'Authorization': `Bearer ${accessToken}`}};
    return fetch(url, params);
  }

  /**
   * Will return all the itemIds that were added.
   */
  #sendImportRequests(items: CalendarApiItem[], destCalendarId: string, accessToken: string): Promise<Set<string>> {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${destCalendarId}/events/import`);

    const itemIds = new Set<string>();
    const itemsToAdd: Partial<CalendarApiItem>[] = [];

    for (const item of items
        .filter((item) => CalendarEntry.getItemStatus(item) === 'accepted')
        .map((item) => ({iCalUID: (item as any).iCalUID.replace(/_R[0-9]{8}T[0-9]{6}/, ''), start: item.start, end: item.end, location: item.location, summary: item.summary}))) {
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
        .map((data) => (
          {method: 'POST', mode: 'cors', body: JSON.stringify(data), headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`}}
        ))
        .map((request) => fetch(url, request as RequestInit)))
        .then(() => itemIds);
  }

  #removeItemsFromSynced(toKeep: Set<string>, destCalendarId: string, accessToken: string): Promise<any> {
    return this.#fetchEvents(accessToken, 180, 180, destCalendarId)
        .then((response) => (response.status == 200) ? response.json() as Promise<CalendarApiResponse> : undefined)
        .then((json) => json!.items.filter((item) => !toKeep.has((item as any).iCalUID)))
        .then((items) => promiseLog(`will remove ${items.length} items`, items))
        .then((items) => this.#sendDeleteRequests(items, destCalendarId, accessToken));
  }

  /**
   * Will return all the itemIds that were added.
   */
  #sendDeleteRequests(items: CalendarApiItem[], destCalendarId: string, accessToken: string): Promise<any> {
    const params: RequestInit = {method: 'DELETE', mode: 'cors', headers: {'Authorization': `Bearer ${accessToken}`}};

    items.forEach((item) => console.log('removing', item));
    return Promise.all(items
        .map((item) => new URL(`https://www.googleapis.com/calendar/v3/calendars/${destCalendarId}/events/${(item as any).id}`))
        .map((url) => fetch(url, params)));
  }
}

/**
 * Calendar result
 */
export class CalendarResult {
  #calendarEntries: CalendarEntry[];
  #lastUpdateMillis: number;
  #errorMessage: string;

  constructor(json: CalendarApiResponse, calendarId: string, errorMessage = '') {
    if (errorMessage === '') {
      this.#calendarEntries = json.items.map((item) => new CalendarEntry(item, calendarId));
      this.#lastUpdateMillis = new Date(json.updated).getTime();
    } else {
      this.#calendarEntries = [];
      this.#lastUpdateMillis = -1;
    }

    this.#errorMessage = errorMessage;
  }

  hasError(): boolean {
    return this.#errorMessage != '';
  }

  getError(): string {
    return this.#errorMessage;
  }

  getCalendarEntries(): CalendarEntry[] {
    return this.#calendarEntries;
  }

  getLastUpdateMillis(): number {
    return this.#lastUpdateMillis;
  }

  toString(): string {
    return `lastUpdate: ${new Date(this.#lastUpdateMillis).toLocaleString('sv')}, #entries: ${this.#calendarEntries.length}, error: ${this.#errorMessage || '<null>'}`;
  }
}
