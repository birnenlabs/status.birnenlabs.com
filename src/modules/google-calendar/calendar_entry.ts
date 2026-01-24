import {dateToSec, EPOCH_FUTURE} from '/jslib/js/scheduler.js';

const NOTIFICATION_IMPORTANT = 300;
const NOTIFICATION_URGENT = 30;
const EXPIRATION_TIMEOUT = 900;


/**
 * Calendar entry class
 *
 * This class contains everything needed to create a html element
 */
export class CalendarEntry {
  /** @type {string} */
  #title;

  /** @type {string} */
  #location;

  /** @type {string} */
  #htmlLink;

  /**
   * Type of the event used to sort priorities (using rejested instead of declined to have it sorted)
   * @type {'accepted'|'maybe'|'rejected'|'suppressed'}
   */
  #status;

  /** @type {Date} */
  #startTime;

  /** @type {Date} */
  #endTime;

  /** type {number} */
  #startTimeSec;

  /** @type {number} */
  #endTimeSec;

  /** @type {Object} */
  #item;

  /** @type {string} */
  #calendarId;

  /**
   * @param {CalendarEntry} e1
   * @param {CalendarEntry} e2
   * @return {number}
   */
  static compare(e1, e2) {
    return (e1.#startTime.getTime() - e2.#startTime.getTime()) ||
      e1.#status.localeCompare(e2.#status) ||
      e1.#title.localeCompare(e2.#title);
  }

  /**
   * @param {Object} item
   * @param {string} calendarId
   */
  constructor(item, calendarId) {
    this.#title = item.summary || '(empty)';
    this.#location = item.location || '';
    this.#htmlLink = item.htmlLink || '';
    this.#status = CalendarEntry.getItemStatus(item);

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
    // When the time zone offset is absent, date-only forms are interpreted as a UTC time
    // and date-time forms are interpreted as local time. This is due to a historical spec error.
    this.#startTime = new Date(item.start.dateTime || (item.start.date + 'T00:00:00'));
    this.#endTime = new Date(item.end.dateTime || (item.end.date + 'T00:00:00'));
    this.#startTimeSec = dateToSec(this.#startTime);
    this.#endTimeSec = dateToSec(this.#endTime);

    this.#item = item;
    this.#calendarId = calendarId;
  }

  /**
   * @return {string}
   */
  toString() {
    return `${this.#startTime.toLocaleTimeString([], {timeStyle: 'short'})} - ${this.#endTime.toLocaleTimeString([], {timeStyle: 'short'})}: ${this.#title}, status: ${this.#status}`;
  }

  /**
   * @param {number} nowSec
   * @return {boolean}
   */
  isImportant(nowSec) {
    return this.#isUrgentOrImportant(NOTIFICATION_IMPORTANT, nowSec);
  }

  /**
   * @param {number} nowSec
   * @return {boolean}
   */
  isUrgent(nowSec) {
    return this.#isUrgentOrImportant(NOTIFICATION_URGENT, nowSec);
  }

  /**
   * @return {Object}
   */
  getItem() {
    return this.#item;
  }

  /**
   * @return {string}
   */
  getCalendarId() {
    return this.#calendarId;
  }

  /**
   * @param {number} sec
   * @param {number} nowSec
   * @return {boolean}
   */
  #isUrgentOrImportant(sec, nowSec) {
    const diff = nowSec - this.#startTimeSec;

    return !this.fullDayEvent() &&
       this.status() != 'rejected' &&
       this.status() != 'suppressed' &&
       -sec <= diff && diff < sec;
  }

  /**
   * @param {number} nowSec
   * @return {boolean}
   */
  isExpired(nowSec) {
    return this.fullDayEvent() ?
       nowSec > this.#endTimeSec :
       (nowSec - this.#startTimeSec) >= EXPIRATION_TIMEOUT;
  }

  /**
   * @param {number} beforeSec
   * @return {boolean}
   */
  isBefore(beforeSec) {
    return this.#startTimeSec < beforeSec;
  }

  /**
   * Returns timestamp of the next state change
   *
   * @param {number} nowSec
   * @return {number}
   */
  nextUpdateTs(nowSec) {
    // adding all the important dates to array and selecting the first one that is not in the past.
    // The value of `startTimeSec + EXPIRATION_TIMEOUT` might be after `endTimeSec` but it is not important
    // as the endTimeSec counts for the full day events only and in that case it won't be later.
    return [
      this.#startTimeSec - NOTIFICATION_IMPORTANT,
      this.#startTimeSec - NOTIFICATION_URGENT,
      this.#startTimeSec + NOTIFICATION_URGENT,
      this.#startTimeSec + NOTIFICATION_IMPORTANT,
      this.#startTimeSec + EXPIRATION_TIMEOUT,
      this.#endTimeSec,
    ].find((el) => el > nowSec) || EPOCH_FUTURE;
  }

  /**
   * @return {string}
   */
  title() {
    return this.#title;
  }

  /**
   * @return {string}
   */
  location() {
    return this.#location;
  }


  /**
   * @return {string}
   */
  startTime() {
    return this.#startTime.toLocaleTimeString([], {timeStyle: 'short'});
  }

  /**
   * @return {string}
   */
  endTime() {
    return this.#endTime.toLocaleTimeString([], {timeStyle: 'short'});
  }

  /**
   * @return {string}
   */
  htmlLink() {
    return this.#htmlLink;
  }

  /**
   * @return {'accepted'|'maybe'|'rejected'|'suppressed'}
   */
  status() {
    return this.#status;
  }

  /**
   * @return {boolean}
   */
  fullDayEvent() {
    return (this.#endTimeSec - this.#startTimeSec) % 86400 === 0;
  }

  /**
   * @param {Object} item
   * @return {'accepted'|'maybe'|'rejected'|'suppressed'}
   */
  static getItemStatus(item) {
    if (item.eventType === 'outOfOffice' || item.eventType === 'workingLocation') {
      return 'suppressed';
    } else if (item.creator?.self) {
      return 'accepted';
    } else {
      return CalendarEntry.#responseStatusToInternal(item.attendees?.find((attendee) => attendee.self)?.responseStatus);
    }
  }

  /**
   * @param {string} status
   * @return {'accepted'|'maybe'|'rejected'}
   */
  static #responseStatusToInternal(status) {
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
