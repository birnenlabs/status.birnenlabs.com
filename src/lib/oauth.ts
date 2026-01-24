const oauthStateParam = 'state';
const oauthCodeParam = 'code';

interface AccessToken {
  code: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  grant_type: 'authorization_code';
}

interface RefreshToken {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  grant_type: 'refresh_token';
}

interface OAuthSettingsData {
  type: 'OAuthSettings';
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  oAuthUrl?: string;
  tokenUrl?: string;
  redirectUrl?: string;
  refreshToken?: string;
  url?: string;
}

/**
 * Helper method that should be invoked in the oauth redirect window.
 * The popup page needs to specify OAuthSettings name in 'state' get parameter.
 * This method will:
 *   - load the OAuthSettings
 *   - parse the returned oauth code from the url
 *   - request refresh token and save it in OAuthSettings
 *   - redirect back to the return url
 */
export function processOAuthRedirect(): Promise<void> {
  const url = new URL(window.location.href);
  const name = url.searchParams.get(oauthStateParam);
  if (!name) {
    return Promise.reject(new Error(`Url missing param: ${oauthStateParam}`));
  }

  const s = new OAuthSettings(name);
  if (!s.isInitialised()) {
    return Promise.reject(new Error(`Settings ${s} should be initialised in processOAuthRedirect`));
  }

  const code = url.searchParams.get(oauthCodeParam);
  if (!code) {
    return Promise.reject(new Error(`Url missing param: ${oauthCodeParam}`));
  }

  const params: RequestInit = {
    method: 'POST',
    mode: 'cors',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(s.createRefreshTokenData(code)),
  };

  return fetch(s.getTokenUrl()!, params)
    .then((response) => {
      if (response.status != 200) {
        throw new Error(`Cannot get token: url: ${s.getTokenUrl()}, response: ${response.status}`);
      }
      return response.json();
    })
    .then((json: {refresh_token?: string}) => {
      if (!json.refresh_token) {
        throw new Error(`RefreshToken not found in response: ${JSON.stringify(json)}`);
      }
      s.setRefreshToken(json.refresh_token);
      s.save();
      if (s.getReturnUrl()) {
        window.location.href = s.getReturnUrl()!;
      }
      return;
    });
}

/**
 * OAuth class that will take care of the OAuth flow.
 * If OAuthSettings are properly configured, it will return
 * the token after calling getAccessToken() method.
 */
export class OAuth {
  #settings: OAuthSettings;
  #accessToken: string | undefined;

  constructor(settings: OAuthSettings) {
    console.log('OAuth created');
    this.#settings = settings;
  }

  getAccessToken(forceRefresh = false): Promise<string> {
    if (!this.#settings.hasRefreshToken()) {
      return Promise.reject(new Error('Missing token - Access not granted, please initialise OAuth'));
    }

    if (forceRefresh) {
      this.#accessToken = undefined;
    }
    if (this.#accessToken) {
      return Promise.resolve(this.#accessToken);
    }

    const accessTokenData = this.#settings.createAccessTokenData();
    if (!accessTokenData) {
      return Promise.reject(new Error(`Settings not initialised: ${this.#settings}`));
    }

    const params: RequestInit = {
      method: 'POST',
      mode: 'cors',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(accessTokenData),
    };
    return fetch(this.#settings.getTokenUrl()!, params)
      .then((response) =>
        response.status == 200
          ? response
          : this.#throwError(
              `Cannot get access token: url: ${this.#settings.getTokenUrl()}, response: ${response.status}`,
            ),
      )
      .then((response) => response.json())
      .then((json: {access_token?: string}) =>
        json.access_token
          ? (this.#accessToken = json.access_token)
          : this.#throwError(`AccessToken not found in response: ${JSON.stringify(json)}`),
      );
  }

  #throwError(message: string): never {
    console.error(message);
    console.error('Removing RefreshToken.');
    this.#settings.setRefreshToken('');
    this.#settings.save();
    throw new Error(message);
  }
}

/**
 * Class that contains OAuthSettings.
 * It will load and save the settings from the local storage under the specified #name.
 * To see which parameters are required please check isInitialised() method.
 */
export class OAuthSettings {
  static #type = 'OAuthSettings';
  #name: string;
  #data: OAuthSettingsData;

  constructor(name: string) {
    this.#name = name;
    this.#data = JSON.parse(localStorage.getItem(name) || 'null') || {
      type: OAuthSettings.#type,
    };
    if (OAuthSettings.#type == this.#data.type) {
      console.log('OAuthSettings created: ' + this);
    } else {
      console.warn('OAuthSettings created [saved data contains invalid type]: ' + this);
    }
  }

  createOAuthUrl(): URL | undefined {
    if (!this.isInitialised()) {
      return undefined;
    }

    const redirectUrl = new URL(this.#data.redirectUrl!);

    const oAuthUrl = new URL(this.#data.oAuthUrl!);
    oAuthUrl.searchParams.set('client_id', this.#data.clientId!);
    oAuthUrl.searchParams.set(oauthStateParam, this.#name);
    oAuthUrl.searchParams.set('redirect_uri', redirectUrl.toString());
    oAuthUrl.searchParams.set('scope', this.#data.scope!);
    oAuthUrl.searchParams.set('response_type', 'code');
    oAuthUrl.searchParams.set('access_type', 'offline');
    oAuthUrl.searchParams.set('approval_prompt', 'force');
    return oAuthUrl;
  }

  createRefreshTokenData(code: string): AccessToken | undefined {
    if (!this.isInitialised()) {
      return undefined;
    }

    return {
      code: code,
      client_id: this.#data.clientId!,
      client_secret: this.#data.clientSecret!,
      redirect_uri: this.#data.redirectUrl!,
      grant_type: 'authorization_code',
    };
  }

  createAccessTokenData(): RefreshToken | undefined {
    if (!this.isInitialised() || !this.#data.refreshToken) {
      return undefined;
    }

    return {
      client_id: this.#data.clientId!,
      client_secret: this.#data.clientSecret!,
      refresh_token: this.#data.refreshToken!,
      grant_type: 'refresh_token',
    };
  }

  /**
   * Save to storage
   */
  save(): void {
    localStorage.setItem(this.#name, JSON.stringify(this.#data));
    console.log('OAuthSettings saved: ' + this);
  }

  getName(): string {
    return this.#name;
  }

  getTokenUrl(): string | undefined {
    return this.#data.tokenUrl;
  }

  getClientId(): string | undefined {
    return this.#data.clientId;
  }

  getClientSecret(): string | undefined {
    return this.#data.clientSecret;
  }

  getReturnUrl(): string | undefined {
    return this.#data.url;
  }

  hasRefreshToken(): boolean {
    return !!this.#data.refreshToken;
  }

  /**
   * Sets client id (e.g. from Google Developer Console)
   */
  setClientId(clientId: string): void {
    this.#data.clientId = clientId;
  }

  /**
   * Sets client secret (e.g. from Google Developer Console)
   */
  setClientSecret(clientSecret: string): void {
    this.#data.clientSecret = clientSecret;
  }

  /**
   * Sets requested scope
   */
  setScope(scope: string): void {
    this.#data.scope = scope;
  }

  /**
   * Sets url to obtain initial refresh token, e.g.: https://accounts.google.com/o/oauth2/auth
   */
  setOAuthUrl(oAuthUrl: string): void {
    this.#data.oAuthUrl = oAuthUrl;
  }

  /**
   * Sets url to refresh token, e.g.: https://accounts.google.com/o/oauth2/token
   */
  setTokenUrl(tokenUrl: string): void {
    this.#data.tokenUrl = tokenUrl;
  }

  /**
   * Sets redirect url - usually url of the page - for this page use https://birnenlabs.com/oauth/popup.html
   */
  setRedirectUrl(redirectUrl: string): void {
    this.#data.redirectUrl = redirectUrl;
  }

  /**
   * Sets refresh token for updating access token
   */
  setRefreshToken(refreshToken: string): void {
    this.#data.refreshToken = refreshToken;
  }

  /**
   * Sets the optional return url. It will be used to redirect
   * the user back after oAuth flow.
   */
  setReturnUrl(url: string): void {
    this.#data.url = url;
  }

  isInitialised(): boolean {
    return !!(
      this.#data.clientId &&
      this.#data.clientSecret &&
      this.#data.scope &&
      this.#data.oAuthUrl &&
      this.#data.tokenUrl &&
      this.#data.redirectUrl
    );
  }

  toString(): string {
    return `OAuthSettings[name=${this.#name}, data=[clientId=${this.#data.clientId}, clientSecret=${this.#data.clientSecret}, type=${this.#data.type}, scope=${this.#data.scope}, oAuthUrl=${this.#data.oAuthUrl}, tokenUrl=${this.#data.tokenUrl}, redirectUrl=${this.#data.redirectUrl}, refreshToken=${this.#data.refreshToken}]]`;
  }
}
