import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

const DEFAULT_RAIN_COLOR = '#33ccff';

/** @type {DefaultConfig} */
const CONFIG = {
  version: 0,
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
  help: 'Using open-meteo.com data. Lat&long can be found here: https://open-meteo.com/en/docs.',
  helpTemplate: {
    temperatureUnit: 'One of the following values: "celsius", "fahrenheit"',
    windSpeedUnit: 'One of the following values: "kmh", "ms", "mph", "kn"',
    latitude: 'Float value, positive for N, negative for S. Example: Zurich: 47.3769, Buenos Aires: -34.6037',
    longitude: 'Float value, positive for E, negative for W. Example: Zurich: 8.5417, Buenos Aires: -58.3816',
    rainColor: 'Text color to be used if the rain is detected. Color should be specified as in css.',
  },
  template: {
    temperatureUnit: 'celsius',
    windSpeedUnit: 'kmh',
    latitude: '47.3769',
    longitude: '8.5417',
    rainColor: DEFAULT_RAIN_COLOR,
  },
};

/**
 * Implements ScheduledModuleInterface
 */
export class OpenMeteoModule extends ScheduledModuleInterface {
  /** @type {string|undefined} */
  #url;

  /** @type {string|undefined} */
  #windyUrl;

  /**
   * Constructor
   */
  constructor() {
    super(20, OpenMeteoModule.#createCss(DEFAULT_RAIN_COLOR));
  }

  /**
   * @param {boolean} forced
   * @return {Promise<RefreshResult>}
   */
  refresh(forced) {
    if (this.#url) {
      const consoleLog = `OpenMeteoModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`;
      console.time(consoleLog);
      console.groupCollapsed(consoleLog);

      return fetch(this.#url)
          .then((response) => response.json())
          .then((jsonResponse) => {
            if (jsonResponse.error) {
              throw new Error(jsonResponse.reason);
            }
            return jsonResponse;
          })
          .then((jsonResponse) => ({
            items: [{
              value: jsonResponse.current.temperature_2m + jsonResponse.current_units.temperature_2m,
              extendedValue: [
                jsonResponse.current.relative_humidity_2m + jsonResponse.current_units.relative_humidity_2m,
                jsonResponse.current.wind_speed_10m + jsonResponse.current_units.wind_speed_10m,
              ],
              href: this.#windyUrl,
              classNames: jsonResponse.current.precipitation > 0 ? ['rain'] : [],
            }],
          }))
          .finally(() => console.groupEnd())
          .finally(() => console.timeEnd(consoleLog));
    } else {
      return Promise.reject(new Error('URL not set.'));
    }
  }

  /**
   * @param {string} rainColor
   * @return {Object}
   */
  static #createCss(rainColor) {
    return [
      {
        className: 'rain',
        color: rainColor,
      },
    ];
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return CONFIG;
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    this.#url = 'https://api.open-meteo.com/v1/forecast?' +
     `latitude=${config.latitude}&` +
     `longitude=${config.longitude}&` +
     'current=temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation&' +
     `temperature_unit=${config.temperatureUnit}&` +
     `wind_speed_unit=${config.windSpeedUnit}`;
    this.#windyUrl = `https://www.windy.com/?rain,${config.latitude},${config.longitude},7,i:temp`;
    this.css = OpenMeteoModule.#createCss(config.rainColor);
  }
}
