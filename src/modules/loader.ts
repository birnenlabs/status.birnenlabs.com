import {getEnabledModules, getModuleConfig} from '../settings/settings.js';
import {
  ModuleInterface,
  PushModuleInterface,
  ScheduledModuleInterface,
  RefreshResult,
  DefaultConfig,
} from './interface.js';

// Actual modules
import {ClockModule} from './clock/module.js';
import {DateModule} from './date/module.js';
import {ExamplePushModule, ExampleScheduledModule} from './example/module.js';
import {GoogleCalendarModule} from './google-calendar/module.js';
import {GoogleTasksModule} from './google-tasks/module.js';
import {MeteoSwissModule} from './meteoswiss/module.js';
import {OpenMeteoModule} from './openmeteo/module.js';
import {SongModule} from './firebase/song.js';

// Comma is allowed to specify multiple classes.
const REGEXP_CSS_NAME = /^[a-zA-Z_-][a-zA-Z_,-]+$/u;
const REGEXP_CSS_PROPERTY = /^[a-zA-Z]+$/u;
const REGEXP_CSS_PROPERTY_VALUE = /^#?[.()a-zA-Z0-9-]+$/u;

type ModuleConstructor = new () => ModuleInterface;

// List of modules
export const MODULES: ModuleConstructor[] = [
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

export function loadModules(): (PushModuleInterface | ScheduledModuleInterface)[] {
  console.group('Loading modules');
  const modulesMap = new Map<string, ModuleConstructor>(MODULES.map((m) => [m.name, m]));

  const moduleNamesMap = new Map<string, number>();

  const result: (PushModuleInterface | ScheduledModuleInterface)[] = [];
  for (const moduleName of getEnabledModules()) {
    // Try to create modules as configured
    let newModule: PushModuleInterface | ScheduledModuleInterface;
    if (modulesMap.has(moduleName)) {
      const M = modulesMap.get(moduleName)!;
      newModule = new M() as PushModuleInterface | ScheduledModuleInterface;
    } else {
      const err = new Error(`Module ${moduleName} not found.`);
      console.warn(err);
      const errorModule = new ErrorModule(err);
      errorModule.addNameSuffix(moduleName);
      newModule = errorModule;
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

export function loadCss(modules: ModuleInterface[]): string {
  let result = '';

  for (const module of modules) {
    for (const css of module.css) {
      if (REGEXP_CSS_NAME.test(css.className)) {
        const value = Object.entries(css)
          .filter(
            (entry): entry is [string, string] =>
              entry[0] !== 'className' &&
              !!entry[1] &&
              REGEXP_CSS_PROPERTY.test(entry[0]) &&
              REGEXP_CSS_PROPERTY_VALUE.test(entry[1]),
          )
          .map((entry) => `\t${entry[0].replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${entry[1]};`)
          .join('\n');

        result +=
          css.className
            .split(',')
            .map((className) => '.' + generateCssName(module.name, className))
            .join('') + ` {\n${value}\n}\n`;
      } else {
        console.warn(`Ignoring invalid class name: ${css.className}. Valid regexp: ${REGEXP_CSS_NAME}`);
      }
    }
  }

  return result;
}

/**
 * Generates class name.
 */
export function generateCssName(moduleName: string, className: string): string {
  return `${moduleName}-${className}`;
}

/**
 * Fake module class to surface error.
 */
class ErrorModule extends ScheduledModuleInterface {
  #error: Error;

  constructor(error: Error) {
    super(9999);
    this.#error = error;
  }

  override refresh(_: boolean): RefreshResult {
    throw this.#error;
  }

  override getDefaultConfig(): DefaultConfig {
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      template: {},
    };
  }

  override setConfig(_: Record<string, string>): void {
    // empty
  }
}
