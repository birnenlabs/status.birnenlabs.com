import {OAuth} from '../../lib/oauth';
import {CalendarEntry, CalendarApiItem} from './calendar_entry';

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
    const consoleTimeId = `CalendarControllerRetriever.retrieveData ${new Date().toLocaleTimeString([], {timeStyle: 'short'})} calendarId=${calendarId}`;
    console.time(consoleTimeId);

    return (
      this.#oAuth
        .getAccessToken()
        // Using '0' as minus days to properly synchronize daily recurring events.
        // If it was set to 1, we would take the daily event from yesterday and only first recurring event
        // instance is synchronized.
        .then((accessToken) => this.#fetchEvents(accessToken, 0, 1, calendarId))
        .then((response) =>
          response.status == 200
            ? response.json().then((json) => new CalendarResult(json, calendarId))
            : response
                .text()
                .then((text) => new CalendarResult({} as CalendarApiResponse, calendarId, 'Error: ' + text)),
        )
        .finally(() => console.timeEnd(consoleTimeId))
    );
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
    const params: RequestInit = {
      method: 'GET',
      mode: 'cors',
      headers: {Authorization: `Bearer ${accessToken}`},
    };
    return fetch(url, params);
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
