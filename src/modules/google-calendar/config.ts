import {OAUTH_REDIRECT_URL_GOOGLE} from '../../lib/oauth-defaults';
import {DefaultConfig} from '../interface';

const CONFIG_HELP = `
GOOGLE CALENDAR AUTHENTICATION

In order to start using calendar, you need to create OAuth settings:

Open the Google Cloud console (https://console.cloud.google.com) and create OAuth credentials:
    - Type: Web application
    - Authorised JavaScript origins: https://status.birnenlabs.com
    - Authorised redirect URIs: ${OAUTH_REDIRECT_URL_GOOGLE}
    - Enable Google Calendar API
Then copy the client Id and client Secret to the settings.

Refresh status bar and click the link to start OAuth flow.

Note: if you use Calendar Module then you can reuse the client Id and client Secret, please make
      sure to enable the Google Calendar API.

If authentication stopped working or you want to change the scope after calendar was initialised, the easiest way is to increase the "oauthSettingsVersion" value, which will force reauthentication.
`;

export const DEFAULT_CONFIG: DefaultConfig = {
  version: 0,
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
  help: CONFIG_HELP,
  helpTemplate: {
    oauthSettingsVersion:
      'Number that is used as a key prefix of the OAuth settings. Increase to start the oAuth flow again.',
    scope:
      'Google Calendar access scope - one of the following values (depending if destinationCalendar is used): "https://www.googleapis.com/auth/calendar.readonly" or "https://www.googleapis.com/auth/calendar.events"',
    clientId: 'Copied from the Google Cloud Console.',
    clientSecret: 'Copied from the Google Cloud Console.',
    sourceCalendars:
      'Comma separated listof calendars to display in status bar, "primary" can be used to select the default calendar of authenticated user.',
    requiredLocationPrefix:
      "Comma separated list of locations prefixes (it should correspond to the list of source calendars - one prefix per calendar). When set and the event in the corresponding calendar is accepted and doesn't have room booked with this prefix, it will be highlighted in the UI.",
  },
  template: {
    oauthSettingsVersion: '0',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    clientId: '',
    clientSecret: '',
    sourceCalendars: 'primary',
    requiredLocationPrefix: '',
  },
};
