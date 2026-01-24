import {DefaultConfig} from '../interface';

const CONFIG_HELP = `
GOOGLE CALENDAR AUTHENTICATION

In order to start using calendar, you need to complete the following steps:

1. Open the Google Cloud console (https://console.cloud.google.com) and create OAuth credentials:
    - Type: Web application
    - Authorised JavaScript origins: https://birnenlabs.com
    - Authorised redirect URIs: https://birnenlabs.com/oauth/popup.html
    - Enable Google Calendar API
Then copy the client Id and client Secret to the settings.

2. If you want to copy calendar events (i.e. use destinationCalendarId setting) please change the scope from the "https://www.googleapis.com/auth/calendar.readonly" to "https://www.googleapis.com/auth/calendar.events".

3. Set value of "oauthStartAuthenticationFlow" to true and save settings.

If authentication stopped working or you want to change the scope after calendar was initialised, the easiest way is to increase the "oauthSettingsVersion" value, which will force reauthentication.
`;

export const DEFAULT_CONFIG: DefaultConfig = {
  version: 0,
  mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
  help: CONFIG_HELP,
  helpTemplate: {
    oauthSettingsVersion:
      'Number that is used as a key prefix of the OAuth settings. Increase to start the oAuth flow again.',
    oauthStartAuthenticationFlow:
      'Should be set to "true" only once when the OAuth flow should be started. It will be automatically changed to "false" after the OAuth is started.',
    scope:
      'Google Calendar access scope - one of the following values (depending if destinationCalendar is used): "https://www.googleapis.com/auth/calendar.readonly" or "https://www.googleapis.com/auth/calendar.events"',
    clientId: 'Copied from the Google Cloud Console.',
    clientSecret: 'Copied from the Google Cloud Console.',
    sourceCalendars:
      'Comma separated listof calendars to display in status bar, "primary" can be used to select the default calendar of authenticated user.',
    destinationCalendar:
      'Calendar id, where non declined events the first calendar in the sourceCalendars list will be copied. If set, the scope has to be "https://www.googleapis.com/auth/calendar.events".',
    requiredLocationPrefix:
      "Comma separated list of locations prefixes (it should correspond to the list of source calendars - one prefix per calendar). When set and the event in the corresponding calendar is accepted and doesn't have room booked with this prefix, it will be highlighted in the UI.",
  },
  template: {
    oauthSettingsVersion: '0',
    oauthStartAuthenticationFlow: 'false',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    clientId: '',
    clientSecret: '',
    sourceCalendars: 'primary',
    destinationCalendar: '',
    requiredLocationPrefix: '',
  },
};
