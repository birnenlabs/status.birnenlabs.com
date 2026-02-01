export const ELLIPSIS = '…';

export interface CustomCss {
  className: string;
  color?: string;
  textDecoration?: string;
  textDecorationColor?: string;
  [key: string]: string | undefined;
}

export interface RefreshResultItem {
  value: string;
  extendedValue?: string[] | string;
  onclick?: (e: Event) => any;
  classNames?: string[];
  important?: boolean;
  urgent?: boolean;
}

export interface RefreshResult {
  items: RefreshResultItem[];
  forceNextRefreshTs?: number;
  skipHtmlUpdate?: boolean;
}

export interface DefaultConfig {
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE' | 'DEFAULT_WITH_STORED_MERGED' | 'STORED_OR_DEFAULT';
  version: number;
  template: Record<string, string>;
  help?: string;
  helpTemplate?: Record<string, string>;
}

export type RenderHtmlCallback = (moduleName: string, result: RefreshResultItem[] | Error) => any | Promise<any>;

/**
 * The base interface that should be implemented by all the modules.
 */
export class ModuleInterface {
  name: string;
  css: CustomCss[];

  constructor(css: CustomCss[] = []) {
    this.name = this.constructor.name;
    this.css = css;
  }

  getDefaultConfig(): DefaultConfig {
    throw new Error(`${this.name}: getDefaultConfig() not implemented`);
  }

  setConfig(config: Record<string, string>): void {
    throw new Error(`${this.name}: setConfig() not implemented ${config}`);
  }

  addNameSuffix(suffix: string): void {
    this.name = `${this.name}_${suffix}`;
  }
}

/**
 * Interface implemented by the scheduled modules - modules that are
 * invoked every repeatMin minutes.
 */
export class ScheduledModuleInterface extends ModuleInterface {
  repeatMin: number;

  constructor(repeatMin: number, css: CustomCss[] = []) {
    super(css);
    this.repeatMin = repeatMin;
  }

  refresh(): RefreshResult | Promise<RefreshResult> {
    throw new Error(`${this.name}: refresh() not implemented`);
  }
}

/**
 * Interface implemented by the push modules. Refresh is initiated by the module using
 * the provided callback function.
 */
export class PushModuleInterface extends ModuleInterface {
  #callback: RenderHtmlCallback;
  #startValue: RefreshResultItem[];

  constructor(startValue: RefreshResultItem[], css: CustomCss[] = []) {
    super(css);
    this.#callback = () => {};
    this.#startValue = startValue;
  }

  setCallback(callback: RenderHtmlCallback): void {
    this.#callback = callback;
    callback(this.name, this.#startValue);
  }

  protected _pushRefresh(refreshResult: RefreshResultItem[] | Error): any | Promise<any> {
    return this.#callback(this.name, refreshResult);
  }
}
