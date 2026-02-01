import {DefaultConfig, RefreshResult, ScheduledModuleInterface} from '../interface';

interface Timezone {
  label: string;
  format: Intl.DateTimeFormatOptions;
}

/**
 * Implements ScheduledModuleInterface
 */
export class ClockModule extends ScheduledModuleInterface {
  #timezones: Timezone[] = [];

  constructor() {
    super(0);
  }

  override refresh(): RefreshResult {
    const now = new Date();
    const value = now.toLocaleTimeString([], {timeStyle: 'medium'});
    let extendedValue: string[] | undefined;

    if (now.getSeconds() === 0) {
      // Update other timezones too.
      extendedValue = this.#timezones.map((tz) => `${tz.label}: ${this.#timezoneOrError(now, tz.format)}`);
    }

    return {
      items: [
        {
          value,
          ...(extendedValue && {extendedValue}),
        },
      ],
    };
  }

  override getDefaultConfig(): DefaultConfig {
    return {
      version: 0,
      mergeStrategy: 'STORED_OR_DEFAULT',
      help: 'Set timezones that will be displayed on hover - one timezone per line.',
      helpTemplate: {
        label:
          '<label> will be displayed before the time, value should be a valid timezone identifier per "tz database". ',
      },
      template: {
        lax: 'America/Los_Angeles',
        nyc: 'America/New_York',
        sao: 'America/Sao_Paulo',
        utc: 'UTC',
        lon: 'Europe/London',
        zrh: 'Europe/Zurich',
        del: 'Asia/Kolkata',
        tok: 'Asia/Tokyo',
        syd: 'Australia/Sydney',
      },
    };
  }

  override setConfig(config: Record<string, string>): void {
    this.#timezones = Object.entries(config).map(([label, timeZone]) => ({
      label,
      format: {timeStyle: 'short', timeZone},
    }));
  }

  #timezoneOrError(date: Date, dateTimeFormatOptions: Intl.DateTimeFormatOptions): string {
    try {
      return date.toLocaleTimeString([], dateTimeFormatOptions);
    } catch (err) {
      if (err instanceof Error) {
        return err.message;
      }
      return String(err);
    }
  }
}
