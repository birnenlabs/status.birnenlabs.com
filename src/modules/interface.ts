/**
 * @typedef {Object} CustomCss
 *
 * Multiple class names can be specified as comma separated string.
 * @property {string} className
 *
 * The properties below are just examples, basically any camelCase will be
 * translated to camel-case CSS property.
 *
 * @property {string} [color]
 * @property {string} [textDecoration]
 * @property {string} [textDecorationColor]
 */


/**
 * @typedef {Object} RefreshResultItem
 *
 * Value to be shown as a status result.
 * When extendedValue is set, then the last character might be set to ellipsis
 * and should be removed by the rendered when extended value is shown.
 *
 * @property {string} value
 *
 *
 * Extended value is an extra information that is not essential to the item.
 * The UI should decide if it has enough space to show it or should it be shown
 * on user action (e.g. mouse hover).
 * The extendedValue will be treated differently based on the type:
 *   string:    value was too long and truncated - it should be shown by joining
 *              value and extendedValue strings without adding whitespaces.
 *   string[]:  value was not truncated, extendedValue provides extra information
 *              useful to the user - the array items should be separated by
 *              a whitespace or other type of separator
 *   undefined: do not change extendedValue (i.e. use the previous one)
 *
 * @property {string[]|string} [extendedValue]
 *
 * Optional link
 * @property {string} [href] *
 *
 * Class names to set to the object. Do NOT include dot prefix.
 *
 * @property {string[]} [classNames]
 *
 * Properties for common styles that should be handled globally by the renderer.
 *
 * @property {boolean} [important]
 * @property {boolean} [urgent]
 */


/**
 * @typedef {Object} RefreshResult
 *
 * @property {RefreshResultItem[]} items
 * @property {number} [forceNextRefreshTs]
 * @property {boolean} [skipHtmlUpdate]
 */

/**
 * @typedef {Object} DefaultConfig
 * @property {'DEFAULT_WITH_STORED_EXCLUSIVE'|'DEFAULT_WITH_STORED_MERGED'|'STORED_OR_DEFAULT'} mergeStrategy
 * @property {number} version
 * @property {Object<string, string>} template
 * @property {string} [help]
 * @property {Object<string, string>} [helpTemplate]
 */


/**
 * @callback RenderHtmlCallback
 * @param {string} moduleName
 * @param {RefreshResultItem[]|Error} result
 * @return {any|Promise<any>}
 */

export const ELLIPSIS = '…';

/**
 * The base interface that should be implemented by all the modules.
 */
export class ModuleInterface {
  /**
   * Module name
   *
   * @type {string}
   */
  name;

  /**
   * Custom css classes.
   *
   * @type {CustomCss[]}
   */
  css;

  /**
   * @param {CustomCss[]} css
   */
  constructor(css = []) {
    this.name = this.constructor.name;
    this.css = css;
  }

  /**
   * Method that returns the default configuration.
   *
   * defaultConfiguration.version is used to generate key under which the config is stored.
   * In case of substntial changes, instead of supporting the old config, the version can
   * be increased and the clear configuration will be returned from the storage.
   *
   * defaultConfiguration.template will be displayed as a config example
   * and used to create a configuration, based on the defaultConfiguration.mergeStrategy:
   *
   * DEFAULT_WITH_STORED_EXCLUSIVE
   *   Takes the defaultConfig, then reads storedConfig and overwrites properties
   *   from the defaultConfig that are available in the storedConfig.
   *   Properties from storedConfig that are not defined in the defaultConfig
   *   will NOT be included in the result.
   *
   * DEFAULT_WITH_STORED_MERGED
   *   Takes the defaultConfig, then reads storedConfig and overwrites properties
   *   from the defaultConfig that are available in the storedConfig.
   *   Properties from storedConfig that are not defined in the defaultConfig
   *   will be included in the result.
   *
   * STORED_OR_DEFAULT
   *   If the storedConfig exists, return the storedConfig.
   *   Otherwise, take the default config.
   *
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    if (true) {
      throw new Error(`${this.name}: getDefaultConfig() not implemented`);
    }
    return {
      version: 0,
      mergeStrategy: 'STORED_OR_DEFAULT',
      template: {},
    };
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    throw new Error(`${this.name}: setConfig() not implemented`);
  }

  /**
   * Add suffix to the module name.
   * @param {string} suffix
   */
  addNameSuffix(suffix) {
    this.name = `${this.name}_${suffix}`;
  }
}

/**
 * Interface implemented by the scheduled modules - modules that are
 * invoked every repeatMin minutes.
 */
export class ScheduledModuleInterface extends ModuleInterface {
  /**
   * How often the refresh method should be called (in minutes).
   * You can also return '0' to be called every second.
   *
   * @type {number}
   */
  repeatMin;

  /**
   * @param {number} repeatMin
   * @param {CustomCss[]} css
   */
  constructor(repeatMin, css = []) {
    super(css);
    this.repeatMin = repeatMin;
  }

  /**
   * Method that will be called when the refresh should happen.
   * forced will be set to true when refresh was forced by RefreshResult.forceNextRefreshTs.
   *
   * When error occures, the method should throw it - the renderer will properly handle it.
   *
   * @param {boolean} forced
   * @return {RefreshResult|Promise<RefreshResult>}
   */
  refresh(forced = false) {
    if (true) {
      throw new Error(`${this.name}: refresh() not implemented`);
    }
    return {items: []};
  }
}

/**
 * Interface implemented by the push modules. Refresh is initiated by the module using
 * the provided callback function.
 */
export class PushModuleInterface extends ModuleInterface {
  /** @type {RenderHtmlCallback} */
  #callback;

  /** @type {RefreshResultItem[]} */
  #startValue;

  /**
   * @param {RefreshResultItem[]} startValue
   * @param {CustomCss[]} css
   */
  constructor(startValue, css = []) {
    super(css);
    this.#callback = () => {};
    this.#startValue = startValue;
  }

  /**
   * @param {RenderHtmlCallback} callback
  */
  setCallback(callback) {
    this.#callback = callback;
    callback(this.name, this.#startValue);
  }

  /**
   * Method that should be called by the implementing class to force refresh.
   *
   * @param {RefreshResultItem[]|Error} refreshResult
   * @return {any|Promise<any>}
   */
  _pushRefresh(refreshResult) {
    return this.#callback(this.name, refreshResult);
  }
}
