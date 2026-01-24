import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

/**
 * Implements ScheduledModuleInterface
 */
export class ClockModule extends ScheduledModuleInterface {
  /**
   * @typedef {Object} Timezone
   * @property {string} label
   * @property {Intl.DateTimeFormatOptions} format
   */

  /** @type {Timezone[]} */
  #timezones;

  /**
   * constructor
   */
  constructor() {
    super(0);
    this.#timezones = [];
  }

  /**
   * @param {boolean} forced
   * @return {RefreshResult}
   */
  refresh(forced) {
    const now = new Date();
    const value = now.toLocaleTimeString([], {timeStyle: 'medium'});
    let extendedValue = undefined;

    if (forced || now.getSeconds() == 0) {
      // Update other timezones too.
      extendedValue = this.#timezones.map((tz) => tz.label + ': ' + this.#timezoneOrError(now, tz.format));
    }

    return {
      items: [{
        value,
        ...extendedValue && {extendedValue},
      }],
    };
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return {
      version: 0,
      mergeStrategy: 'STORED_OR_DEFAULT',
      help: 'Set timezones that will be displayed on hover - one timezone per line.',
      helpTemplate: {
        label: '<label> will be displayed before the time, value should be a valid timezone identifier per "tz database". ',
      },
      template: {
        lax: 'America/Los_Angeles',
        nyc: 'America/New_York',
        sao: 'America/Sao_Paulo',
        utc: 'UTC',
        lon: 'Europe/London',
        zrh: 'Europe/Zurich',
        del: 'Asia/Kolkata',
        tok: 'Asia/Tokyo',
        syd: 'Australia/Sydney',
      },
    };
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    this.#timezones = Object.entries(config).map(
        ([label, timeZone]) => ({label, format: {timeStyle: 'short', timeZone}}));
  }

  /**
   * @param {Date} date
   * @param {Intl.DateTimeFormatOptions} dateTimeFormatOptions
   * @return {string}
   */
  #timezoneOrError(date, dateTimeFormatOptions) {
    try {
      return date.toLocaleTimeString([], dateTimeFormatOptions);
    } catch (err) {
      return err.message;
    }
  }
}
