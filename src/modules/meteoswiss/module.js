import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';
import {MeteoSwissLib} from './lib.js';
import {combine4} from '/jslib/js/promise.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

const DEFAULT_RAIN_COLOR = '#33ccff';

const CONFIG_HELP = `
Provide home and work location - it will be used to create a rectangle. Weather will be retrieved from the meteo stations within 12km distance from the rectangle, that are not higher than 600m above the sea level.

Meteo Swiss is using CH1903+ coordinates, which have reversed X and Y, so they are noted as (Y,X) on a cartesian chart.

   ^
   |
   |            (workY,workX)
 X |
   |         (homeY,homeX)
   |
   +----------------------------->
                 Y

Use this map to get coordinates for your area: https://tools.retorte.ch/map/. The default values are set for Zurich.
`;

/**
 * Implements ScheduledModuleInterface
 */
export class MeteoSwissModule extends ScheduledModuleInterface {
  /** @type {MeteoSwissLib|undefined} */
  #meteoSwissLib;

  /**
   * Constructor
   */
  constructor() {
    super(20, MeteoSwissModule.#createCss(DEFAULT_RAIN_COLOR));
  }

  /**
   * @param {boolean} forced
   * @return {Promise<RefreshResult>}
   */
  refresh(forced) {
    const consoleLog = `MeteoSwissModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`;
    if (this.#meteoSwissLib === undefined) {
      const err = new Error('Config is not set.');
      console.error(err);
      throw err;
    }
    console.time(consoleLog);
    console.groupCollapsed(consoleLog);

    return combine4(
        this.#meteoSwissLib.getTemperature(),
        this.#meteoSwissLib.getHumidity(),
        this.#meteoSwissLib.getWind(),
        this.#meteoSwissLib.isRaining(),
        (temperature, humidity, wind, isRaining) =>
          ({
            items: [{
              value: temperature,
              extendedValue: [humidity, wind],
              href: 'https://www.meteoswiss.admin.ch/services-and-publications/applications/precipitation.html',
              classNames: isRaining ? ['rain'] : [],
            }],
          }))
        .finally(() => console.groupEnd())
        .finally(() => console.timeEnd(consoleLog));
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
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      help: CONFIG_HELP,
      helpTemplate: {
        homeY: 'Y value of home location according to the CH1903+ coordinates.',
        homeX: 'X value of home location according to the CH1903+ coordinates.',
        workY: 'Y value of work location according to the CH1903+ coordinates.',
        workX: 'X value of work location according to the CH1903+ coordinates.',
        rainColor: 'Text color to be used if the rain is detected. Color should be specified as in css.',
      },
      template: {
        homeY: '2683258',
        homeX: '1247652',
        workY: '2683258',
        workX: '1247652',
        rainColor: DEFAULT_RAIN_COLOR,
      },
    };
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    this.#meteoSwissLib = new MeteoSwissLib(
        parseInt(config.workY),
        parseInt(config.workX),
        parseInt(config.homeY),
        parseInt(config.homeX));
    this.css = MeteoSwissModule.#createCss(config.rainColor);
  }
}
