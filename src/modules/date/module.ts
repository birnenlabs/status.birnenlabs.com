import {DefaultConfig, RefreshResult, ScheduledModuleInterface} from '../interface';

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

  refresh(forced: boolean): RefreshResult {
    console.log(forced);
    const now = new Date();
    return {
      items: [
        {
          value: now.toLocaleDateString(),
        },
      ],
    };
  }

  getDefaultConfig(): DefaultConfig {
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      help: 'Date is not configurable. The module simply displays new Date().toLocaleDateString().',
      template: {},
    };
  }

  setConfig(config: Record<string, string>): void {
    console.log(config);
  }
}
