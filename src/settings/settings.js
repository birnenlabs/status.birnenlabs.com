import {ModuleInterface} from '../modules/interface.js';

const LOCAL_STORAGE_ENABLED = 'status-modules-enabled';

/**
 * @return {string[]}
 */
export function getEnabledModules() {
  return getEnabledModulesString().split('\n').filter((v) => v);
}

/**
 * @return {string}
 */
export function getEnabledModulesString() {
  const result = localStorage.getItem(LOCAL_STORAGE_ENABLED) || '';
  console.log(`Settings.getEnabledModules:\n${result}`);
  return result;
}

/**
 * @param {string} modules
 */
export function setEnabledModulesString(modules) {
  console.log(`Settings.setEnabledModules:\n${modules}`);
  localStorage.setItem(LOCAL_STORAGE_ENABLED, modules);
}

/**
 * @param {ModuleInterface} module
 * @param {string|null} value
 */
export function setModuleConfigString(module, value) {
  if (value) {
    console.groupCollapsed('Settings.setModuleConfig()');
    console.log(value);
    console.groupEnd();
    localStorage.setItem(moduleConfigKey(module), value);
  } else {
    console.log('Settings.setModuleConfig() - clear');
    localStorage.removeItem(moduleConfigKey(module));
  }
}

/**
 * @param {ModuleInterface} module
 * @return {string|null}
 */
export function getModuleConfigString(module) {
  return localStorage.getItem(moduleConfigKey(module));
}

/**
 * Method will return object configuration.
 * The config might be merged from the object default configuration
 * and stored configuration.
 *
 * @param {ModuleInterface} module
 * @return {Object<string, string>}
 */
export function getModuleConfig(module) {
  /** @type {string|null} */
  const storedConfigString = getModuleConfigString(module);
  /** @type {Object<string, string>} */
  const storedConfig = stringToObject(storedConfigString || '');
  /** @type {Object<string, string>} */
  const defaultConfig = module.getDefaultConfig().template;
  const mergeStrategy = module.getDefaultConfig().mergeStrategy;

  console.groupCollapsed(`Settings.getModuleConfig()`);
  console.log('Default config:\n' + objectToString(defaultConfig));
  console.log('Stored config:\n' + objectToString(storedConfig));
  console.log('Merge strategy: ' + mergeStrategy);

  /** @type {Object<string, string>} */
  let result = {};
  for (const [key, value] of Object.entries(defaultConfig)) {
    result[key] = value;
  }

  if (mergeStrategy === 'DEFAULT_WITH_STORED_EXCLUSIVE') {
    for (const [key, value] of Object.entries(storedConfig)) {
      if (Object.hasOwn(defaultConfig, key)) {
        result[key] = value;
      }
    }
  } else if (mergeStrategy === 'DEFAULT_WITH_STORED_MERGED') {
    for (const [key, value] of Object.entries(storedConfig)) {
      result[key] = value;
    }
  } else if (mergeStrategy === 'STORED_OR_DEFAULT') {
    if (storedConfigString !== null) {
      result = stringToObject(storedConfigString);
    }
  } else {
    const err = new Error('Invalid merge strategy.');
    console.error(err);
    throw err;
  }

  console.log('Result config:\n' + objectToString(result));
  console.groupEnd();
  return result;
}

/**
 * @param {Object<string, string>} o
 * @return {string}
 */
export function objectToString(o) {
  return Object.entries(o).map(([k, v]) => `${k}:${v}`).join('\n');
}

/**
 * @param {string} s
 * @return {Object<string, string>}
 */
export function stringToObject(s) {
  return Object.fromEntries(
      s.split('\n')
          .filter((line) => line)
          .map((line) => line.split(':'))
          .map((arr) => [arr[0], arr.slice(1).join(':')]));
}

/**
 * @param {ModuleInterface} module
 * @return {string}
 */
function moduleConfigKey(module) {
  return `${module.name}-config-v${module.getDefaultConfig().version}`;
}
