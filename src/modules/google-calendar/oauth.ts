import {ModuleInterface} from '/pwa/status/js/modules/interface.js';
import {OAuth, OAuthSettings} from '/jslib/js/oauth.js';
import {setModuleConfigString, objectToString} from '/pwa/status/js/settings/settings.js';

/**
 * !!!!!!!!!! IMPORTANT: This file is reused by the tasks module. !!!!!!!!!!
 */

/**
 * This method is taking care of the OAuth flow based on the config:
 * - it will sync the module config with the oAuth config
 * - it will redirect user (or return the error code) if oauthStartAuthenticationFlow == true
 * The return value is either an error message or valid OAuth library.
 *
 * @param {ModuleInterface} module
 * @param {Object<string, string>} config
 * @return {OAuth|string}
 */
export function processOAuth(module, config) {
  const settings = syncAndGetOAuthSettings(module, config);

  // If oauthStartAuthenticationFlow then start the process.
  if (config.oauthStartAuthenticationFlow === 'true') {
    if (settings.isInitialised()) {
      // Change oauthStartAuthenticationFlow to false before starting redirection.
      config.oauthStartAuthenticationFlow = 'false';
      setModuleConfigString(module, objectToString(config));

      // Open settingsUrl or reload current page.
      const url = settings.createOAuthUrl();
      if (url) {
        window.location.href = url.href;
      } else {
        config.oauthStartAuthenticationFlow = 'Could not create OAuthUrl';
        setModuleConfigString(module, objectToString(config));
        window.alert('Could not create OAuthUrl, please check all the OAuth related config');
        window.location.reload();
      }
    } else {
      config.oauthStartAuthenticationFlow = 'missing scope, clientId or clientSecret';
      setModuleConfigString(module, objectToString(config));
      window.alert('OAuth settings are not valid. Scope, clientId or clientSecret is not set.');
      window.location.reload();
    }
    // Making the compiler happy, at this point the current window was reloaded.
    return '';
  } else {
    if (!settings.isInitialised()) {
      return 'Scope, clientId or clientSecret is not set. Please go to the settings page.';
    }
    if (!settings.hasRefreshToken()) {
      return 'RefreshToken is not set. Start oAuth flow by setting oauthStartAuthenticationFlow:true.';
    }
    return new OAuth(settings);
  }
}

/**
 * Creates oAuth settings from the module config, saves them and returnes.
 *
 * @param {ModuleInterface} module
 * @param {Object<string, string>} config
 * @return {OAuthSettings}
 */
function syncAndGetOAuthSettings(module, config) {
  // Sync OAuth with the module settings
  const oAuthSettings = new OAuthSettings(module.name + '-oauth-v' + config.oauthSettingsVersion);
  oAuthSettings.setOAuthUrl('https://accounts.google.com/o/oauth2/auth');
  oAuthSettings.setTokenUrl('https://accounts.google.com/o/oauth2/token');
  oAuthSettings.setRedirectUrl('https://birnenlabs.com/oauth/popup.html');
  oAuthSettings.setScope(config.scope || '');
  oAuthSettings.setClientId(config.clientId || '');
  oAuthSettings.setClientSecret(config.clientSecret || '');
  oAuthSettings.setReturnUrl(window.location.href);
  oAuthSettings.save();

  return oAuthSettings;
}
