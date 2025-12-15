import {getEnabledModules, getModuleConfig} from '/pwa/status/js/settings/settings.js';
import {ModuleInterface, PushModuleInterface, ScheduledModuleInterface} from './interface.js';
import {checkNonUndefined} from '/jslib/js/preconditions.js';

// Actual modules
import {ClockModule} from './clock/module.js';
import {DateModule} from './date/module.js';
import {ExamplePushModule, ExampleScheduledModule} from './example/module.js';
import {GoogleCalendarModule} from './google-calendar/module.js';
import {GoogleTasksModule} from './google-tasks/module.js';
import {MeteoSwissModule} from './meteoswiss/module.js';
import {OpenMeteoModule} from './openmeteo/module.js';
import {SongModule} from './firebase/song.js';

/**
 * @typedef {import("./interface.js").RefreshResult} RefreshResult
 * @typedef {import("./interface.js").RefreshResultItem} RefreshResultItem
 * @typedef {import("./renderer.js").RenderHtmlCallback} RenderHtmlCallback
 * @typedef {import("./interface.js").DefaultConfig} DefaultConfig
 */

// Comma is allowed to specify multiple classes.
const REGEXP_CSS_NAME = /^[a-zA-Z_-][a-zA-Z_,-]+$/;
const REGEXP_CSS_PROPERTY = /^[a-zA-Z]+$/;
const REGEXP_CSS_PROPERTY_VALUE = /^#?[\.\(\)a-zA-Z0-9-]+$/;

// List of modules
export const MODULES = [
  ClockModule,
  DateModule,
  ExamplePushModule,
  ExampleScheduledModule,
  GoogleCalendarModule,
  GoogleTasksModule,
  MeteoSwissModule,
  OpenMeteoModule,
  SongModule,
];

/**
 * @return {(PushModuleInterface|ScheduledModuleInterface)[]}
 */
export function loadModules() {
  console.group('Loading modules');
  const modulesMap = new Map(MODULES.map((m) => ([m.name, m])));

  /** @type {Map<string, number>} */
  const moduleNamesMap = new Map();

  /** @type {(PushModuleInterface|ScheduledModuleInterface)[]} */
  const result = [];
  for (const moduleName of getEnabledModules()) {
    // Try to create modules as configured
    let newModule;
    if (modulesMap.has(moduleName)) {
      const M = checkNonUndefined(modulesMap.get(moduleName));
      newModule = new M();
    } else {
      const err = new Error(`Module ${moduleName} not found.`);
      console.warn(err);
      newModule = new ErrorModule(err);
      newModule.addNameSuffix(moduleName);
    }

    // Guarantee unique names
    const currentId = moduleNamesMap.get(newModule.name) || 0;
    moduleNamesMap.set(newModule.name, currentId + 1);
    newModule.addNameSuffix(currentId.toString());

    result.push(newModule);
  }

  // load configuration
  result.forEach((module) => module.setConfig(getModuleConfig(module)));

  console.groupEnd();
  return result;
}

/**
 * @param {ModuleInterface[]} modules
 *
 * @return {string}
 */
export function loadCss(modules) {
  let result = '';

  for (const module of modules) {
    for (const css of module.css) {
      if (REGEXP_CSS_NAME.test(css.className)) {
        const value = Object.entries(css)
            .filter((entry) => entry[0] != 'className')
            .filter((entry) => entry[1])
            .filter((entry) => REGEXP_CSS_PROPERTY.test(entry[0]))
            .filter((entry) => REGEXP_CSS_PROPERTY_VALUE.test(entry[1]))
            .map((entry) => `\t${entry[0].replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${entry[1]};`)
            .join('\n');

        result += css.className.split(',')
            .map((className) => '.' + generateCssName(module.name, className))
            .join('') +
          ` {\n${value}\n}\n`;
      } else {
        console.warn(`Ignoring invalid class name: ${css.className}. Valid regexp: ${REGEXP_CSS_NAME}`);
      }
    }
  }

  return result;
}

/**
 * Generates class name.
 *
 * @param {string} moduleName
 * @param {string} className
 * @return {string}
 */
export function generateCssName(moduleName, className) {
  return `${moduleName}-${className}`;
}

/**
 * Fake module class to surface error.
 */
class ErrorModule extends ScheduledModuleInterface {
  /**
   * @type {Error}
   */
  #error;

  /**
   * @param {Error} error
   */
  constructor(error) {
    super(9999);
    this.#error = error;
  }

  /**
   * @param {boolean} forced
   * @return {RefreshResult}
   */
  refresh(forced) {
    if (true) {
      throw this.#error;
    }
    return {items: []};
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return {version: 0, mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE', template: {}};
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
  }
}
