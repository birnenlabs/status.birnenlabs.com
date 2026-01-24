// Some time in year 2096
export const EPOCH_FUTURE = 4000000000;

// Base value for exponential backoff.
const RETRY_DELAY_BASE_SEC = 5;

// Maximum value of retry delay
const RETRY_DELAY_MAX_SEC = 900;

/**
 * Base event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The BaseEvent is used for events that occurs on every tick.
 */
class BaseEvent {
  #fn: () => any;
  #id: string;

  constructor(id: string, fn: () => any) {
    this.#fn = fn;
    this.#id = id;
  }

  toString(): string {
    return `${this.#id}`;
  }

  id(): string {
    return this.#id;
  }

  /**
   * Performs function
   */
  tick(): Promise<any> {
    // Use `new Promise()` to start promise chain even for non promise functions.
    return new Promise((resolve) => resolve(this.#fn())).catch((e) => {
      // Log and rethrow failed task.
      // Child classes will set the next event run in their finally clauses,
      // Scheduler will reschedule in case of failure
      console.error(`${this} failed`, e);
      throw e;
    });
  }
}

/**
 * Scheduled event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The ScheduledEvent has next run time to be invoked by the scheduled.
 */
class ScheduledEvent extends BaseEvent {
  #nextRunEpochSec: number;
  #retryDelaySec: number;
  #rescheduleCount: number;

  constructor(id: string, fn: () => any, nextRunEpochSec: number) {
    super(id, fn);
    this.#nextRunEpochSec = nextRunEpochSec;
    this.#retryDelaySec = RETRY_DELAY_BASE_SEC;
    this.#rescheduleCount = 0;
  }

  override toString(): string {
    // Using sv (Sweden) as it uses iso time format
    return super.toString() + `: scheduled=${this.#nextRunEpochString()}`;
  }

  isScheduled(): boolean {
    return this.nextRunEpochSec() !== -1;
  }

  nextRunEpochSec(): number {
    return this.#nextRunEpochSec;
  }

  #nextRunEpochString(): string {
    return this.isScheduled() ? new Date(this.#nextRunEpochSec * 1000).toLocaleString('sv') : 'never';
  }

  /** Will overwrite #nextRunEpochSec to retry the task in #retryDelaySec seconds or earlier */
  scheduleForRetry(): void {
    const retryRunEpochSec = getNowSec() + this.#retryDelaySec;
    const originalNextRunEpochString = this.#nextRunEpochString();
    if (this.isScheduled()) {
      // Reschedule scheduled event only when retry is earlier than expected run.
      this.setNextRunEpochSec(Math.min(retryRunEpochSec, this.nextRunEpochSec()));
    } else {
      this.setNextRunEpochSec(retryRunEpochSec);
    }

    // Using 1.659 as multiplier because it produces nice numbers: 5, 8, 13, 22, 36, 60, 100...
    this.#retryDelaySec = Math.min(Math.round(this.#retryDelaySec * 1.659), RETRY_DELAY_MAX_SEC);
    this.#rescheduleCount++;

    console.log(
      `Rescheduling: ${super.toString()}: retry #${this.#rescheduleCount}, original next run: ${originalNextRunEpochString}, next retry delay sec: ${this.#retryDelaySec}`,
    );
  }

  setNextRunEpochSec(nextRunEpochSec: number): void {
    this.#nextRunEpochSec = nextRunEpochSec;
  }

  /**
   * Performs function
   */
  override tick(): Promise<any> {
    return (
      super
        .tick()
        // Reset retry timer on success
        .then(() => (this.#retryDelaySec = RETRY_DELAY_BASE_SEC))
        // Reset reschedule count on success
        .then(() => (this.#rescheduleCount = 0))
        // Always set next run (RepeatableEvent will overwrite it in its finally clause)
        .finally(() => this.setNextRunEpochSec(-1))
    );
  }

  static compare(e1: ScheduledEvent, e2: ScheduledEvent): number {
    return e1.#nextRunEpochSec - e2.#nextRunEpochSec || e1.id().localeCompare(e2.id());
  }
}

/**
 * Repeatable event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The RepeatableEvent is a special case of the ScheduledEvent, that will
 * reschedule itself after the completion.
 */
class RepeatableEvent extends ScheduledEvent {
  #intervalSec: number;

  constructor(id: string, fn: () => any, intervalSec: number) {
    super(id, fn, RepeatableEvent.#calculateNextRunEpochSec(intervalSec));
    this.#intervalSec = intervalSec;
  }

  override toString(): string {
    return super.toString() + `, repeatable every ${this.#intervalSec / 60}m`;
  }

  /**
   * Perform function
   */
  override tick(): Promise<any> {
    return (
      super
        .tick()
        // Always set the next run.
        .finally(() => super.setNextRunEpochSec(RepeatableEvent.#calculateNextRunEpochSec(this.#intervalSec)))
    );
  }

  /**
   * Will return next epoch seconds timestamp when event should be run.
   */
  static #calculateNextRunEpochSec(intervalSec: number): number {
    const offsetSec = new Date().getTimezoneOffset() * 60;
    const nowSec = getNowSec();
    const result = nowSec + intervalSec - ((nowSec - offsetSec) % intervalSec);
    return result;
  }
}

/**
 * Class that runs the specified function periodically.
 *
 * SetTimeout bahaviour depends on implementation - it may happen
 * that it will pause the timer while sleeping (i.e. when setTimout
 * for 1h is set and the computer is paused for 30 minutes the function
 * may be invoked after 90 minutes).
 * This implementation ticks every second and stores the next invocation
 * timestamp.
 */
class Scheduler {
  static #everyTickEvents: BaseEvent[] = [];
  static #scheduledEvents: ScheduledEvent[] = [
    // Adding last event to guard the end of an array.
    // There will be no need to check array length on #tick.
    new ScheduledEvent('__?# internal Scheduler last event #?__', () => {}, EPOCH_FUTURE),
  ];

  static {
    setTimeout(Scheduler.#tick, 1000 - (Date.now() % 1000));
  }

  /**
   * Function invoked every second.
   */
  static #tick(): Promise<any> {
    const nowSec = getNowSec();

    const eventsToRun: ScheduledEvent[] = [];

    // Scheduled events are always sorted and at least one element exists.
    while (Scheduler.#scheduledEvents[0]!.nextRunEpochSec() <= nowSec) {
      eventsToRun.push(Scheduler.#scheduledEvents.shift()!);
    }

    let tickEventsPromise =
      // Run #everyTickEvents in parallel
      Promise.all(
        Scheduler.#everyTickEvents
          // Swallow exception here - failed are already logged and #everyTickEvents will be tried at the next tick anyway
          .map((event) => event.tick().catch(() => {})),
      )
        // Schedule the next tick in 1 second after all the #everyTickEvents completed.
        .then(() => setTimeout(Scheduler.#tick, 1000 - (Date.now() % 1000)));

    // Run the remaining eventsToRun in the sequence
    for (const event of eventsToRun) {
      // Failed non #everyTickEvents should be retried
      tickEventsPromise = tickEventsPromise.then(() => event.tick().catch(() => event.scheduleForRetry()));
    }

    return (
      tickEventsPromise
        // Maybe re-add functions from eventsToRun (including events scheduled for retry).
        .then(() => eventsToRun.forEach((event) => event.isScheduled() && Scheduler.add(event)))
        .catch((e) => console.error(`Unexpected exception in scheduler - this is a bug.`, e))
    );
  }

  static add(event: BaseEvent | ScheduledEvent | RepeatableEvent): void {
    const findSameIdFn = (e: BaseEvent) => e.id() === event.id();

    // RepeatableEvent is ScheduledEvent
    if (event instanceof ScheduledEvent) {
      if (!event.isScheduled()) {
        console.error(`Scheduler: cannot add non scheduled event: ${event}`);
      }

      // Check if event with the same id exists in the scheduler array.
      const index = Scheduler.#scheduledEvents.findIndex(findSameIdFn);
      if (index == -1) {
        console.log(`Scheduler add: ${event}`);
        Scheduler.#scheduledEvents.push(event);
      } else {
        console.log(`Scheduler replace: ${Scheduler.#scheduledEvents[index]} with ${event}`);
        Scheduler.#scheduledEvents[index] = event;
      }
      Scheduler.#scheduledEvents.sort(ScheduledEvent.compare);
    } else if (event instanceof BaseEvent) {
      // Check if event with the same id exists in the every second events array.
      const index = Scheduler.#everyTickEvents.findIndex(findSameIdFn);
      if (index == -1) {
        console.log(`Scheduler add: ${event}, repeatable every 1s`);
        Scheduler.#everyTickEvents.push(event);
      } else {
        console.log(`Scheduler replace: ${Scheduler.#everyTickEvents[index]} with ${event}, repeatable every 1s`);
        Scheduler.#everyTickEvents[index] = event;
      }
    } else {
      console.error(`Scheduler: Invalid event: ${event}`);
    }
  }
}

/** Exported class used to hold static constructors of events */
export class Event {
  /**
   * Repetable events will be called every ${min} minutes or
   * every second when minute not set.
   */
  static repeat(id: string, fn: () => any, min = 0): void {
    if (min < 0) {
      throw new Error(`Negative min value: ${min}.`);
    } else if (min === 0) {
      Scheduler.add(new BaseEvent(id, fn));
    } else {
      Scheduler.add(new RepeatableEvent(id, fn, min * 60));
    }
  }

  static once(id: string, fn: () => any, min = 0, sec = 0): void {
    Scheduler.add(new ScheduledEvent(id, fn, getNowSec() + min * 60 + sec));
  }

  static at(id: string, fn: () => any, timestampSec: number): void {
    Scheduler.add(new ScheduledEvent(id, fn, timestampSec));
  }
}

export function getNowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function dateToSec(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function secToDate(sec: number): Date {
  return new Date(sec * 1000);
}
