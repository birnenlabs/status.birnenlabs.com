import {PushModuleInterface, ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

const CSS = [
  {
    className: 'some-class',
    color: '#55f',
  },
];

/** @type {DefaultConfig} */
const CONFIG = {
  version: 0,
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
  help: 'Help text to be printed on the settings page above the configuration.',
  helpTemplate: {
    config: 'help text per template parameter',
    something_else: 'note that the helpTemplate keys are not compared to the template keys and any string might be used',
  },
  template: {
    config: 'some value',
    another_key: 'second value',
  },
};

/**
 * Implements ScheduledModuleInterface
 */
export class ExampleScheduledModule extends ScheduledModuleInterface {
  /** @type {number} */
  #counter;

  /**
   * Constructor
   */
  constructor() {
    super(0, CSS);
    this.#counter = 0;
  }

  /**
   * @param {boolean} forced
   * @return {Promise<RefreshResult>}
   */
  refresh(forced) {
    const consoleLog = `ExampleModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`;
    console.time(consoleLog);
    console.groupCollapsed(consoleLog);

    return Promise.resolve(
        ({
          items: [{
            value: 'Hello. I am scheduled module, calls count: ' + this.#counter++,
            extendedValue: ['I have more data'],
            classNames: ['some-class'],
          }],
        }))
        .finally(() => console.groupEnd())
        .finally(() => console.timeEnd(consoleLog));
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
  }
}

/**
 * Implements PushModuleInterface
 */
export class ExamplePushModule extends PushModuleInterface {
  /** @type {number} */
  #counter;

  /**
   * constructor
   */
  constructor() {
    super([], CSS);
    this.#counter = 0;

    setInterval(() => this._pushRefresh([{
      value: 'Hello. I am push module, push count: ' + this.#counter++,
      extendedValue: ['I have more data'],
      classNames: ['some-class'],
    }]), 2000);
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
  }
}

