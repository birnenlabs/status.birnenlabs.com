import {dateToSec, EPOCH_FUTURE} from '../../lib/scheduler';

const NOTIFICATION_IMPORTANT = 300;
const NOTIFICATION_URGENT = 30;
const EXPIRATION_TIMEOUT = 900;

type EventStatus = 'accepted' | 'maybe' | 'rejected' | 'suppressed';

// This is from google calendar API response
export interface CalendarApiItem {
  summary?: string;
  location?: string;
  htmlLink?: string;
  start: {
    dateTime?: string; // e.g. '2024-03-25T10:00:00+01:00'
    date?: string; // e.g. '2024-03-26' for all-day events
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  eventType?: 'outOfOffice' | 'workingLocation';
  creator?: {
    self?: boolean;
  };
  attendees?: {
    self?: boolean;
    responseStatus: 'accepted' | 'declined' | 'needsAction' | 'tentative';
  }[];
}

/**
 * Calendar entry class
 *
 * This class contains everything needed to create a html element
 */
export class CalendarEntry {
  #title: string;
  #location: string;
  #htmlLink: string;
  #status: EventStatus;
  #startTime: Date;
  #endTime: Date;
  #startTimeSec: number;
  #endTimeSec: number;
  #item: CalendarApiItem;
  #calendarId: string;

  static compare(e1: CalendarEntry, e2: CalendarEntry): number {
    return (
      e1.#startTime.getTime() - e2.#startTime.getTime() ||
      e1.#status.localeCompare(e2.#status) ||
      e1.#title.localeCompare(e2.#title)
    );
  }

  constructor(item: CalendarApiItem, calendarId: string) {
    this.#title = item.summary || '(empty)';
    this.#location = item.location || '';
    this.#htmlLink = item.htmlLink || '';
    this.#status = CalendarEntry.getItemStatus(item);

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
    // When the time zone offset is absent, date-only forms are interpreted as a UTC time
    // and date-time forms are interpreted as local time. This is due to a historical spec error.
    this.#startTime = new Date(item.start.dateTime || item.start.date + 'T00:00:00');
    this.#endTime = new Date(item.end.dateTime || item.end.date + 'T00:00:00');
    this.#startTimeSec = dateToSec(this.#startTime);
    this.#endTimeSec = dateToSec(this.#endTime);

    this.#item = item;
    this.#calendarId = calendarId;
  }

  toString(): string {
    return `${this.#startTime.toLocaleTimeString([], {timeStyle: 'short'})} - ${this.#endTime.toLocaleTimeString([], {timeStyle: 'short'})}: ${this.#title}, status: ${this.#status}`;
  }

  isImportant(nowSec: number): boolean {
    return this.#isUrgentOrImportant(NOTIFICATION_IMPORTANT, nowSec);
  }

  isUrgent(nowSec: number): boolean {
    return this.#isUrgentOrImportant(NOTIFICATION_URGENT, nowSec);
  }

  getItem(): CalendarApiItem {
    return this.#item;
  }

  getCalendarId(): string {
    return this.#calendarId;
  }

  #isUrgentOrImportant(sec: number, nowSec: number): boolean {
    const diff = nowSec - this.#startTimeSec;

    return (
      !this.fullDayEvent() && this.status() != 'rejected' && this.status() != 'suppressed' && -sec <= diff && diff < sec
    );
  }

  isExpired(nowSec: number): boolean {
    return this.fullDayEvent() ? nowSec > this.#endTimeSec : nowSec - this.#startTimeSec >= EXPIRATION_TIMEOUT;
  }

  isBefore(beforeSec: number): boolean {
    return this.#startTimeSec < beforeSec;
  }

  /**
   * Returns timestamp of the next state change
   *
   * @param {number} nowSec
   * @return {number}
   */
  nextUpdateTs(nowSec: number): number {
    // adding all the important dates to array and selecting the first one that is not in the past.
    // The value of `startTimeSec + EXPIRATION_TIMEOUT` might be after `endTimeSec` but it is not important
    // as the endTimeSec counts for the full day events only and in that case it won't be later.
    return (
      [
        this.#startTimeSec - NOTIFICATION_IMPORTANT,
        this.#startTimeSec - NOTIFICATION_URGENT,
        this.#startTimeSec + NOTIFICATION_URGENT,
        this.#startTimeSec + NOTIFICATION_IMPORTANT,
        this.#startTimeSec + EXPIRATION_TIMEOUT,
        this.#endTimeSec,
      ].find((el) => el > nowSec) || EPOCH_FUTURE
    );
  }

  title(): string {
    return this.#title;
  }

  location(): string {
    return this.#location;
  }

  startTime(): string {
    return this.#startTime.toLocaleTimeString([], {timeStyle: 'short'});
  }

  endTime(): string {
    return this.#endTime.toLocaleTimeString([], {timeStyle: 'short'});
  }

  htmlLink(): string {
    return this.#htmlLink;
  }

  status(): EventStatus {
    return this.#status;
  }

  fullDayEvent(): boolean {
    return (this.#endTimeSec - this.#startTimeSec) % 86400 === 0;
  }

  static getItemStatus(item: CalendarApiItem): EventStatus {
    if (item.eventType === 'outOfOffice' || item.eventType === 'workingLocation') {
      return 'suppressed';
    }

    // Check status in attendees list if creator is there.
    const selfAttendee = item.attendees?.find((attendee) => attendee.self);
    if (selfAttendee) {
      return CalendarEntry.#responseStatusToInternal(selfAttendee.responseStatus);
    }

    // If not found accept own events.
    if (item.creator?.self) {
      return 'accepted';
    }

    return 'maybe';
  }

  static #responseStatusToInternal(
    status?: 'accepted' | 'declined' | 'needsAction' | 'tentative',
  ): 'accepted' | 'maybe' | 'rejected' {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'rejected';
      case 'needsAction':
      case 'tentative':
      default:
        return 'maybe';
    }
  }
}
