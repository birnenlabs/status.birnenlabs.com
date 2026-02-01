import {ScheduledModuleInterface, RefreshResult, DefaultConfig} from '../interface';
import {CalendarConnector} from './connector';
import {createRefreshResult, CSS} from './response_processor';
import {DEFAULT_CONFIG} from './config';
import {OAuth, OAuthSettings, launchOAuthPopup} from '../../lib/oauth';
import {upsertOAuthSettingsForGoogle} from '../../lib/oauth-defaults';


/**
 * Implements ScheduledModuleInterface
 */
export class GoogleCalendarModule extends ScheduledModuleInterface {
  #oAuthSettings: OAuthSettings | undefined;
  #sourceCalendars: string[];
  #requiredLocationPrefix: string[];

  constructor() {
    // Let's repeat every 4 minuts - it will not interfere with the usual scheduling
    // times at full and half hour.
    // The extra refreshes for notifications will be:
    // x:55:00, x:59:30, x+1:00:30, x+1:05:00, x+1:15
    //
    // while scheduling every 4 minutes gives updates at:
    // x:52, x:56, x+1:00, x+1:04, x+1:08, ..., x+1:16
    super(4, CSS);

    this.#sourceCalendars = [];
    this.#requiredLocationPrefix = [];
  }

  override refresh(forced: boolean): Promise<RefreshResult> | RefreshResult {
    if (!this.#oAuthSettings) {
      return Promise.reject(new Error('Configuration was not set.'));
    }

    if (!this.#oAuthSettings.isInitialised()) {
      return Promise.reject(new Error('Scope, clientId or clientSecret is not set. Please go to the settings page.'));
    }

    if (!this.#oAuthSettings.hasRefreshToken()) {
      return {
        items: [
          {
            value: 'Click to authenticate',
            onclick: () => launchOAuthPopup(this.#oAuthSettings!),
            classNames: ['clickOAuth'],
          },
        ],
        // Force refresh every 2 seconds.
        forceNextRefreshTs: new Date().getTime() / 1000 + 2,
      };
    }

    console.groupCollapsed(
      `CalendarModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`,
    );
    // Everything was checked, we can now proceed.
    // Creating connector is inexpensive - it only sets proper references inside.
    const connector = new CalendarConnector(new OAuth(this.#oAuthSettings));
    const timeRender = 'CalendarModule.refresh: retrieve time';
    console.time(timeRender);

    return Promise.all(this.#sourceCalendars.map((calendarId) => connector.retrieveData(calendarId)))
      .then((results) => results.flat())
      .then((entries) => createRefreshResult(entries, this.#sourceCalendars, this.#requiredLocationPrefix))
      .finally(() => console.timeEnd(timeRender))
      .finally(() => console.groupEnd());
  }

  override getDefaultConfig(): DefaultConfig {
    return DEFAULT_CONFIG;
  }

  override setConfig(config: Record<string, string>): void {
    this.#sourceCalendars = config['sourceCalendars']?.split(',') || [];
    this.#requiredLocationPrefix = config['requiredLocationPrefix']?.split(',') || [];
    this.#oAuthSettings = upsertOAuthSettingsForGoogle(
      this.name,
      config['oauthSettingsVersion'] || '',
      config['scope'] || '',
      config['clientId'] || '',
      config['clientSecret'] || '',
    );
  }
}
