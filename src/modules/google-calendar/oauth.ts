import {ModuleInterface} from '../interface';
import {OAuth, OAuthSettings} from '../../lib/oauth';
import {setModuleConfigString, objectToString} from '../../settings/settings';

/**
 * !!!!!!!!!! IMPORTANT: This file is reused by the tasks module. !!!!!!!!!!
 */

/**
 * This method is taking care of the OAuth flow based on the config:
 * - it will sync the module config with the oAuth config
 * - it will redirect user (or return the error code) if oauthStartAuthenticationFlow == true
 * The return value is either an error message or valid OAuth library.
 */
export function processOAuth(module: ModuleInterface, config: Record<string, string>): OAuth | string {
  const settings = syncAndGetOAuthSettings(module, config);

  

  // If oauthStartAuthenticationFlow then start the process.
  if (config['oauthStartAuthenticationFlow'] === 'true') {
    if (settings.isInitialised()) {
      // Change oauthStartAuthenticationFlow to false before starting redirection.
      // Change oauthStartAuthenticationFlow to false before starting redirection.
      config['oauthStartAuthenticationFlow'] = 'false';
      setModuleConfigString(module, objectToString(config));

      // Open settingsUrl or reload current page.
      const url = settings.createOAuthUrl();
      if (url) {
        window.location.href = url.href;
      } else {
        config['oauthStartAuthenticationFlow'] = 'Could not create OAuthUrl';
        setModuleConfigString(module, objectToString(config));
        window.alert('Could not create OAuthUrl, please check all the OAuth related config');
        window.location.reload();
      }
    } else {
      config['oauthStartAuthenticationFlow'] = 'missing scope, clientId or clientSecret';
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
 */
function syncAndGetOAuthSettings(module: ModuleInterface, config: Record<string, string>): OAuthSettings {
  // Sync OAuth with the module settings
  const oAuthSettings = new OAuthSettings(module.name + '-oauth-v' + config['oauthSettingsVersion']);
  oAuthSettings.setOAuthUrl('https://accounts.google.com/o/oauth2/auth');
  oAuthSettings.setTokenUrl('https://accounts.google.com/o/oauth2/token');
  oAuthSettings.setRedirectUrl('https://birnenlabs.com/oauth/oauth.html');
  oAuthSettings.setScope(config['scope'] || '');
  oAuthSettings.setClientId(config['clientId'] || '');
  oAuthSettings.setClientSecret(config['clientSecret'] || '');
  // This is not important - we take the code using window postMessage.
  oAuthSettings.setReturnUrl('https://birnenlabs.com');
  oAuthSettings.save();

  return oAuthSettings;
}
