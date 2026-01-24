import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 */

/**
 * Implements ScheduledModuleInterface
 */
export class DateModule extends ScheduledModuleInterface {
  /**
   * constructor
   */
  constructor() {
    super(24 * 60);
  }

  /**
   * @param {boolean} forced
   * @return {RefreshResult}
   */
  refresh(forced) {
    const now = new Date();
    return {
      items: [{
        value: now.toLocaleDateString(),
      }],
    };
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      help: 'Date is not configurable. The module simply displays new Date().toLocaleDateString().',
      template: {},
    };
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
  }
}
