import {ModuleInterface} from '../modules/interface';

const LOCAL_STORAGE_ENABLED = 'status-modules-enabled';

export function getEnabledModules(): string[] {
  return getEnabledModulesString().split('\n').filter((v) => v);
}

export function getEnabledModulesString(): string {
  const result = localStorage.getItem(LOCAL_STORAGE_ENABLED) || '';
  console.log(`Settings.getEnabledModules:\n${result}`);
  return result;
}

export function setEnabledModulesString(modules: string): void {
  console.log(`Settings.setEnabledModules:\n${modules}`);
  localStorage.setItem(LOCAL_STORAGE_ENABLED, modules);
}

export function setModuleConfigString(module: ModuleInterface, value: string | null): void {
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

export function getModuleConfigString(module: ModuleInterface): string | null {
  return localStorage.getItem(moduleConfigKey(module));
}

export function getModuleConfig(module: ModuleInterface): Record<string, string> {
  const storedConfigString = getModuleConfigString(module);
  const storedConfig: Record<string, string> = stringToObject(storedConfigString || '');
  const defaultConfig = module.getDefaultConfig().template;
  const mergeStrategy = module.getDefaultConfig().mergeStrategy;

  console.groupCollapsed(`Settings.getModuleConfig()`);
  console.log('Default config:\n' + objectToString(defaultConfig));
  console.log('Stored config:\n' + objectToString(storedConfig));
  console.log('Merge strategy: ' + mergeStrategy);

  let result: Record<string, string> = {};
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

export function objectToString(o: Record<string, string>): string {
  return Object.entries(o).map(([k, v]) => `${k}:${v}`).join('\n');
}

export function stringToObject(s: string): Record<string, string> {
  return Object.fromEntries(
      s.split('\n')
          .filter((line) => line)
          .map((line) => line.split(':'))
          .map((arr) => [arr[0], arr.slice(1).join(':')]));
}

function moduleConfigKey(module: ModuleInterface): string {
  return `${module.name}-config-v${module.getDefaultConfig().version}`;
}
