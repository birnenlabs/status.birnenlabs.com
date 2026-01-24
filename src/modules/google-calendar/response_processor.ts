import {ELLIPSIS, RefreshResult, RefreshResultItem} from '../interface';
import {dateToSec, EPOCH_FUTURE, getNowSec, secToDate} from '../../lib/scheduler';
import {CalendarEntry} from './calendar_entry';

/**
 * The following css classes are set by the code below:
 *   calendarItem-firstCalendar-(true|false)           - true if item is from the first calendar
 *   calendarItem-(accepted|maybe|rejected|suppressed) - item response status
 *   calendarItem-missingRoom                          - room is required but not set
 */

export const CSS = [
  {
    className: 'calendarItem-firstCalendar-false',
    color: '#bbb',
  },
  {
    className: 'calendarItem-maybe',
    color: '#bbb',
  },
  {
    className: 'calendarItem-rejected',
    color: '#bbb',
    textDecoration: 'line-through',
    textDecorationColor: '#6c6c6c',
  },
  {
    className: 'calendarItem-accepted,calendarItem-missingRoom',
    color: '#ffd580',
  },
];

/**
 * Filters inputEntries and creats RefreshResult.
 */
export function createRefreshResult(
  inputEntries: CalendarEntry[],
  sourceCalendars: string[],
  requiredLocationPrefix: string[],
): RefreshResult {
  const items: RefreshResultItem[] = [];

  const requiredLocationsMap = new Map(sourceCalendars.map((key, index) => [key, requiredLocationPrefix[index]]));
  const firstSourceCalendar = sourceCalendars.at(0);

  const nowSec = getNowSec();

  const midnigthDate = new Date();
  midnigthDate.setHours(0, 0, 0, 0);
  midnigthDate.setDate(midnigthDate.getDate() + 1);
  const midnightSec = dateToSec(midnigthDate);

  const calendarEntries = inputEntries
    .filter((entry) => entry.status() !== 'suppressed')
    .filter((entry) => !entry.isExpired(nowSec))
    // Show only events that are starting before 23:59:59 today.
    .filter((entry) => entry.isBefore(midnightSec - 1))
    .sort(CalendarEntry.compare);

  console.log(`Skipped ${inputEntries.length - calendarEntries.length} expired or suppressed items.`);

  let nextUpdateTs: number = EPOCH_FUTURE;

  let i = 0;

  // Scroll i past full day events
  while (i < calendarEntries.length && calendarEntries[i]?.fullDayEvent()) {
    i++;
  }
  // i > 0 means we have some full day events
  if (i > 0) {
    console.group(`Full day entries`);
    let firstAllDayEventIndex = 0;
    let hasFirstCalendarEvent = false;
    for (let j = 0; j < i; j++) {
      const entry = calendarEntries[j];
      console.log(`${entry}`);
      if (firstAllDayEventIndex == 0 && entry?.getCalendarId() === firstSourceCalendar) {
        firstAllDayEventIndex = j;
        hasFirstCalendarEvent = true;
      }
    }
    // Set next midnight for the full day events
    nextUpdateTs = midnightSec;
    console.log(`Next update from this event: ${secToDate(nextUpdateTs).toLocaleString('sv')} [earliest so far]`);

    const entry = calendarEntries[firstAllDayEventIndex];
    const item: RefreshResultItem = {
      value: entry?.title() || '',
      extendedValue: '',
      classNames: [`calendarItem-firstCalendar-${hasFirstCalendarEvent}`],
    };

    // i > 1 means we have more than one full day event
    if (i > 1) {
      item.value += ' ' + ELLIPSIS;
      item.extendedValue = [];
      for (let j = 0; j < i; j++) {
        if (j != firstAllDayEventIndex) {
          (item.extendedValue as string[]).push(calendarEntries[j]?.title() || '');
        }
      }
    }
    items.push(item);
    console.groupEnd();
  }

  let fullTitleDisplayed = false;
  while (i < calendarEntries.length) {
    const entry = calendarEntries[i]!;
    console.group(`${entry}`);

    const item: RefreshResultItem = {
      value: `${entry.startTime()}: `,
      extendedValue: '',
      classNames: [
        `calendarItem-${entry.status()}`,
        `calendarItem-firstCalendar-${entry.getCalendarId() === firstSourceCalendar}`,
      ],
      important: entry.isImportant(nowSec),
      urgent: entry.isUrgent(nowSec),
    };

    if (entry.htmlLink()) {
      item.href = entry.htmlLink();
    }

    const requiredLocation = requiredLocationsMap.get(entry.getCalendarId());
    if (requiredLocation && !entry.location()?.includes(requiredLocation)) {
      item.classNames!.push('calendarItem-missingRoom');
    }

    const entryNextUpdateTs = entry.nextUpdateTs(nowSec);
    if (entryNextUpdateTs < nextUpdateTs) {
      nextUpdateTs = entryNextUpdateTs;
      console.log(
        `Next update from this event: ${secToDate(entryNextUpdateTs).toLocaleString('sv')} [earliest so far]`,
      );
    } else {
      console.log(`Next update from this event: ${secToDate(entryNextUpdateTs).toLocaleString('sv')}`);
    }

    const entryRejected = entry.status() === 'rejected';
    const displayFullTitle =
      (!fullTitleDisplayed && !entryRejected) ||
      (entry.title().length <= 12 && !entryRejected) ||
      calendarEntries.length == 1;

    if (displayFullTitle) {
      item.value += entry.title();
      fullTitleDisplayed = true;
    } else {
      item.value += entry.title().slice(0, 10) + ELLIPSIS;
      item.extendedValue += entry.title().slice(10);
    }

    if (entry.location()) {
      item.extendedValue += ': ' + entry.location();
    }

    items.push(item);
    i++;
    console.groupEnd();
  }

  if (items.length == 0) {
    items.push({value: 'No events'});
    console.log('Items list is empty');
  }

  console.log(`Next update scheduled at ${secToDate(nextUpdateTs).toLocaleString('sv')}`);
  return {items, forceNextRefreshTs: nextUpdateTs};
}
