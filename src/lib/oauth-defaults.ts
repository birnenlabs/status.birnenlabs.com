import {OAuthSettings} from './oauth';

/**
 * Upserts OAuth settings for Google.
 *
 * @param name The name of the OAuth setting (used to identify the settings in the local storage).
 * @param version The version of the OAuth setting (used to identify the settings in the local storage).
 * @param scope The scope of the OAuth setting.
 * @param clientId The client ID of the OAuth setting.
 * @param clientSecret The client secret of the OAuth setting.
 * @returns The OAuth settings.
 */
export function upsertOAuthSettingsForGoogle(
  name: string,
  version: string,
  scope: string,
  clientId: string,
  clientSecret: string,
): OAuthSettings {
  // Sync OAuth with the module settings
  const oAuthSettings = new OAuthSettings(name + '-oauth-v' + version);
  oAuthSettings.setOAuthUrl('https://accounts.google.com/o/oauth2/auth');
  oAuthSettings.setTokenUrl('https://accounts.google.com/o/oauth2/token');
  oAuthSettings.setRedirectUrl('https://birnenlabs.com/oauth/oauth.html');
  oAuthSettings.setScope(scope);
  oAuthSettings.setClientId(clientId);
  oAuthSettings.setClientSecret(clientSecret);
  // This is not important - we take the code using window postMessage.
  oAuthSettings.setReturnUrl('https://birnenlabs.com');
  oAuthSettings.save();

  return oAuthSettings;
}
