import {PushModuleInterface, ScheduledModuleInterface, ModuleInterface} from '../modules/interface';
import {MODULES} from '../modules/loader';
import {
  getEnabledModulesString,
  setEnabledModulesString,
  getModuleConfig,
  getModuleConfigString,
  setModuleConfigString,
} from './settings';
import {loadModules} from '../modules/loader';

function onPageLoad(): void {
  const modulesPreEl = document.getElementById('modules-available') as HTMLPreElement;
  const modulesTextAreaEl = document.getElementById('modules-enabled') as HTMLTextAreaElement;
  const modulesSaveEl = document.getElementById('modules-save') as HTMLInputElement;

  for (const moduleObj of MODULES) {
    modulesPreEl.textContent = `${modulesPreEl.textContent}${moduleObj.name}\n`;
  }
  modulesTextAreaEl.value = getEnabledModulesString();
  modulesTextAreaEl.rows = MODULES.length + 1;
  modulesTextAreaEl.spellcheck = false;
  modulesSaveEl.onclick = onModulesSaveClick;
  modulesRender();
}

function onModulesSaveClick(): void {
  const modulesTextAreaEl = document.getElementById('modules-enabled') as HTMLTextAreaElement;
  setEnabledModulesString(modulesTextAreaEl.value);
  modulesRender();
}

function modulesRender(): void {
  const configHeaderSectionEl = document.getElementById('config-header-section') as HTMLElement;
  const configSectionEl = document.getElementById('config-section') as HTMLElement;
  configHeaderSectionEl.innerHTML = '';
  configSectionEl.innerHTML = '';

  let firstButtonEl: HTMLInputElement | undefined;

  for (const m of loadModules()) {
    const buttonEl = createHeaderSectionHtml(m);
    configHeaderSectionEl.appendChild(buttonEl);
    configSectionEl.appendChild(createSectionHtml(m));
    if (!firstButtonEl) {
      firstButtonEl = buttonEl;
    }
  }

  if (firstButtonEl) {
    firstButtonEl.click();
  }
}

function createHeaderSectionHtml(module: ModuleInterface): HTMLInputElement {
  const headerSectionEl = document.createElement('input');
  headerSectionEl.id = `${module.name}-button`;
  headerSectionEl.type = 'button';
  headerSectionEl.classList.add('module-button');
  headerSectionEl.value = module.name;
  headerSectionEl.onclick = onHeaderSectionClick;
  return headerSectionEl;
}

function onHeaderSectionClick(event: Event): void {
  const eventTarget = event.target as HTMLInputElement;
  const tabButtonId = eventTarget.id;
  const tabPanelId = tabButtonId.slice(0, -7);

  document
    .querySelectorAll<HTMLElement>('.module-button')
    .forEach((el) =>
      el.id === tabButtonId ? el.classList.add('module-button-active') : el.classList.remove('module-button-active'),
    );

  document
    .querySelectorAll<HTMLElement>('.module')
    .forEach((el) => (el.style.display = el.id === tabPanelId ? 'block' : 'none'));
}

function createSectionHtml(module: ModuleInterface): HTMLElement {
  const helpTemplate = module.getDefaultConfig().helpTemplate ?? {};

  const sectionEl = document.createElement('section');
  sectionEl.classList.add('module');
  sectionEl.id = module.name;
  sectionEl.style.display = 'none';

  const h3El = document.createElement('h3');
  h3El.textContent = module.name;
  if (module.name.startsWith('ErrorModule')) {
    h3El.classList.add('error');
  }
  sectionEl.appendChild(h3El);

  if (Object.keys(module.getDefaultConfig().template).length > 0 || Object.keys(helpTemplate).length > 0) {
    const h4ConfigEl = document.createElement('h4');
    h4ConfigEl.textContent = 'Configuration';
    sectionEl.appendChild(h4ConfigEl);

    const h5ConfigExampleEl = document.createElement('h5');
    h5ConfigExampleEl.textContent = 'Default';
    sectionEl.appendChild(h5ConfigExampleEl);
    sectionEl.appendChild(createConfigWithHelp(module.getDefaultConfig().template, helpTemplate));

    const h5ConfigSavedEl = document.createElement('h5');
    h5ConfigSavedEl.textContent = 'Saved';
    sectionEl.appendChild(h5ConfigSavedEl);
    const configEditorEl = document.createElement('textarea');
    const configString = getModuleConfigString(module);
    configEditorEl.spellcheck = false;
    if (configString == null) {
      configEditorEl.placeholder = '<unset>';
      configEditorEl.rows = Object.keys(module.getDefaultConfig().template).length;
    } else {
      configEditorEl.value = configString;
      configEditorEl.rows = configString.split('\n').length + 2;
    }
    sectionEl.appendChild(configEditorEl);

    const h5ConfigCurrentEl = document.createElement('h5');
    h5ConfigCurrentEl.textContent = 'Active (default + saved)';
    sectionEl.appendChild(h5ConfigCurrentEl);
    const configCurrentEl = document.createElement('pre');
    configCurrentEl.replaceChildren(createConfigWithHelp(getModuleConfig(module), helpTemplate));
    sectionEl.appendChild(configCurrentEl);

    const configSaveButtonEl = document.createElement('input');
    configSaveButtonEl.type = 'button';
    configSaveButtonEl.value = 'Save Configuration';
    configSaveButtonEl.disabled = module.name.startsWith('ErrorModule');
    configSaveButtonEl.onclick = () =>
      Promise.resolve(setModuleConfigString(module, configEditorEl.value))
        .then(() => module.setConfig(getModuleConfig(module)))
        .then(() => configCurrentEl.replaceChildren(createConfigWithHelp(getModuleConfig(module), helpTemplate)));
    sectionEl.appendChild(configSaveButtonEl);
  }

  const testSectionEl = document.createElement('div');
  testSectionEl.style.display = 'none';
  const h5TestEl = document.createElement('h5');
  h5TestEl.textContent = 'Output';
  testSectionEl.appendChild(h5TestEl);
  const testOutputEl = document.createElement('pre');
  testOutputEl.textContent = 'loading...';
  testSectionEl.appendChild(testOutputEl);
  sectionEl.appendChild(testSectionEl);

  const testButtonEl = document.createElement('input');
  testButtonEl.type = 'button';
  testButtonEl.value = 'Test Module';
  if (module instanceof ScheduledModuleInterface) {
    testButtonEl.onclick = () =>
      Promise.resolve()
        .then(() => (testSectionEl.style.display = ''))
        .then(() => (module as ScheduledModuleInterface).refresh(true))
        .then((r) => (testOutputEl.textContent = resultToString(r)))
        .catch((err) => (testOutputEl.textContent = err.toString()));
  } else if (module instanceof PushModuleInterface) {
    (module as PushModuleInterface).setCallback((_, r) => (testOutputEl.textContent = resultToString(r)));
    testButtonEl.onclick = () => (testSectionEl.style.display = '');
  }
  sectionEl.appendChild(testButtonEl);

  if (module.getDefaultConfig().help) {
    const h4ConfigDescriptionEl = document.createElement('h4');
    h4ConfigDescriptionEl.textContent = 'Help';
    sectionEl.appendChild(h4ConfigDescriptionEl);
    const configDescriptionEl = document.createElement('pre');
    configDescriptionEl.textContent = module.getDefaultConfig().help?.trim() ?? '';
    configDescriptionEl.classList.add('config-description');
    sectionEl.appendChild(configDescriptionEl);
  }

  const h4DebugEl = document.createElement('h4');
  h4DebugEl.textContent = 'Debug information';
  sectionEl.appendChild(h4DebugEl);

  const debugPreEl = document.createElement('pre');
  if (module instanceof ScheduledModuleInterface) {
    debugPreEl.textContent += `repeatMin:     ${(module as ScheduledModuleInterface).repeatMin}\n`;
  }
  debugPreEl.textContent += `class:         ${module.constructor.name}\n`;
  debugPreEl.textContent += `mergeStrategy: ${module.getDefaultConfig().mergeStrategy}`;
  sectionEl.appendChild(debugPreEl);

  return sectionEl;
}

function createConfigWithHelp(config: Record<string, string>, helpObj: Record<string, string>): HTMLElement {
  const resultEl = document.createElement('div');
  for (const [key, val] of Object.entries(config)) {
    const keyEl = document.createElement('span');
    const sepEl = document.createElement('span');
    const valEl = document.createElement('span');
    const endEl = document.createElement('br');
    keyEl.textContent = key;
    sepEl.textContent = ':';
    valEl.textContent = val;

    keyEl.classList.add('config-preview-key');
    sepEl.classList.add('config-preview-sep');
    valEl.classList.add('config-preview-val');

    resultEl.appendChild(keyEl);
    resultEl.appendChild(sepEl);
    resultEl.appendChild(valEl);
    resultEl.appendChild(endEl);

    if (Object.prototype.hasOwnProperty.call(helpObj, key)) {
      const helpEl = document.createElement('span');
      helpEl.textContent = helpObj[key] || null;
      keyEl.appendChild(helpEl);
      keyEl.classList.add('config-preview-key-with-tooltip');
      helpEl.classList.add('config-preview-tooltip');
    }
  }
  resultEl.classList.add('config-preview');
  return resultEl;
}

function resultToString(object: object | Error): string {
  if (object instanceof Error) {
    return object.toString();
  } else {
    return JSON.stringify(object, undefined, 2);
  }
}

document.addEventListener('DOMContentLoaded', onPageLoad);
