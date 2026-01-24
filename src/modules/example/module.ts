import {CustomCss, DefaultConfig, PushModuleInterface, RefreshResult, ScheduledModuleInterface} from '../interface';

const CSS: CustomCss[] = [
  {
    className: 'some-class',
    color: '#55f',
  },
];

const CONFIG: DefaultConfig = {
  version: 0,
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
  help: 'Help text to be printed on the settings page above the configuration.',
  helpTemplate: {
    config: 'help text per template parameter',
    something_else:
      'note that the helpTemplate keys are not compared to the template keys and any string might be used',
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
  #counter = 0;

  /**
   * Constructor
   */
  constructor() {
    super(0, CSS);
  }

  override refresh(forced: boolean): Promise<RefreshResult> {
    const consoleLog = `ExampleModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`;
    console.time(consoleLog);
    console.groupCollapsed(consoleLog);

    return Promise.resolve({
      items: [
        {
          value: 'Hello. I am scheduled module, calls count: ' + this.#counter++,
          extendedValue: ['I have more data'],
          classNames: ['some-class'],
        },
      ],
    })
      .finally(() => console.groupEnd())
      .finally(() => console.timeEnd(consoleLog));
  }

  override getDefaultConfig(): DefaultConfig {
    return CONFIG;
  }

  override setConfig(config: Record<string, string>): void {
    console.log(config);
  }
}

/**
 * Implements PushModuleInterface
 */
export class ExamplePushModule extends PushModuleInterface {
  #counter = 0;

  /**
   * constructor
   */
  constructor() {
    super([], CSS);

    setInterval(
      () =>
        this._pushRefresh([
          {
            value: 'Hello. I am push module, push count: ' + this.#counter++,
            extendedValue: ['I have more data'],
            classNames: ['some-class'],
          },
        ]),
      2000,
    );
  }

  override getDefaultConfig(): DefaultConfig {
    return CONFIG;
  }

  override setConfig(config: Record<string, string>): void {
    console.log(config);
  }
}
