import {DefaultConfig} from '../interface';

const CONFIG_HELP = `
This module will display tasks from the provided lists. The following task types will be displayed
and marked in the UI:
- overdue - not completed with past due date
- today - not completed with due date set to today
- not completed without due date

The Google Tasks API doesn't return task due time - it only returns date.


GOOGLE TASK AUTHENTICATION

In order to start using calendar, you need to complete the following steps:

1. Open the Google Cloud console (https://console.cloud.google.com) and create OAuth credentials:
    - Type: Web application
    - Authorised JavaScript origins: https://status.birnenlabs.com
    - Authorised redirect URIs: https://status.birnenlabs.com/oauth.html
    - Enable Google Tasks API
Then copy the client Id and client Secret to the settings.

Note: if you use Calendar Module then you can reuse the client Id and client Secret, please make
      sure to enable the Google Tasks API.

2. Set value of "oauthStartAuthenticationFlow" to true and save settings.

If authentication stopped working, the easiest soluition is to increase the "oauthSettingsVersion" value,
which will force reauthentication.
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
    scope: 'Google Tasks access scope - should be the default value: "https://www.googleapis.com/auth/tasks.readonly"',
    clientId: 'Copied from the Google Cloud Console.',
    clientSecret: 'Copied from the Google Cloud Console.',
    listIds:
      'Comma separated listIds to be displayed. The listIds can be found here: https://developers.google.com/tasks/reference/rest/v1/tasklists/list, by clicking "Try it!" and then "Execute"',
  },
  template: {
    oauthSettingsVersion: '0',
    oauthStartAuthenticationFlow: 'false',
    scope: 'https://www.googleapis.com/auth/tasks.readonly',
    clientId: '',
    clientSecret: '',
    listIds: '',
  },
};
