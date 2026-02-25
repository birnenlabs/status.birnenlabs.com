import {FirebaseApp, initializeApp} from 'firebase/app';
import {DataSnapshot, getDatabase, onValue, ref, Unsubscribe} from 'firebase/database';
import {CustomCss, DefaultConfig, PushModuleInterface, RefreshResultItem} from '../interface';

const FORCE_REFRESH_TIMEOUT_MS = 600000;

const HELP = `
Required steps for the Firebase module to work:

1. In the Firebase console (https://console.firebase.google.com/) create a new project with the realtime database.
2. Generate random at least 20 characters long token and set it in the configuration of this module (databaseToken).
3. Edit Firebase rules (see help: https://firebase.google.com/docs/rules/manage-deploy?authuser=0&hl=en#edit_and_update_your_rules_2) to enable read/write access to the data stored under the token. The value should be similar to this:

{
  "rules": {
    "[generated random token]": {
      ".read": true,
      ".write": true
    }
  }
}
`;

/**
 * Base class for the Firebase modules
 */
export class FirebaseBaseModule extends PushModuleInterface {
  #firebaseApp: FirebaseApp | undefined;
  #databasePath: string;
  #help: string;
  #unsubscribe: Unsubscribe;
  #onValueTimeout: number | undefined;

  constructor(databasePath: string, css: CustomCss[], help: string) {
    super([], css);
    if (!databasePath.startsWith('/')) {
      throw new Error(`Database path (${databasePath}) has to start with '/'`);
    }
    this.#databasePath = databasePath;
    this.#help = help;
    this.#unsubscribe = () => {};
  }

  override getDefaultConfig(): DefaultConfig {
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      help: HELP + this.#help,
      helpTemplate: {
        databaseUrl:
          'This is an url provided in the realtime database console (https://console.firebase.google.com/). Should be similar to: https://[project-id]-default-rtdb.europe-west1.firebasedatabase.app/',
        databaseToken:
          'This is a simple way to allow passwordless access to firebase. It is a key that will be used as a part of the path where the data is stored. MUST BE at least 20 characters long.',
      },
      template: {
        databaseUrl: '',
        databaseToken: '',
      },
    };
  }

  override setConfig(config: Record<string, string>): void {
    this.#unsubscribe();
    clearTimeout(this.#onValueTimeout);
    if (config['databaseUrl'] && config['databaseToken'] && config['databaseToken'].length >= 20) {
      const firebaseConfig = {databaseURL: config['databaseUrl']};
      try {
        this.#firebaseApp = initializeApp(firebaseConfig);
      } catch (e: any) {
        if (e.code !== 'app/duplicate-app') {
          throw e;
        }
      }
      const database = getDatabase(this.#firebaseApp);
      const dbRef = ref(database, config['databaseToken'] + this.#databasePath);
      this.#unsubscribe = onValue(dbRef, (snapshot: DataSnapshot) => this.#onValue(snapshot?.val()));
    } else {
      const err = new Error('Url or token empty or too short, not subscribing to the database.');
      this._pushRefresh(err);
      console.warn(err);
      this.#unsubscribe = () => {};
    }
  }

  #onValue(data: unknown): void {
    // Force refreshing data if there was no update for the last 10 minutes. The data might contain expiration data
    // and without it the onValue would have been only invoked when the firebase data was changed.
    clearTimeout(this.#onValueTimeout);
    this.#onValueTimeout = setTimeout(() => this.#onValue(data), FORCE_REFRESH_TIMEOUT_MS);
      
    let result: RefreshResultItem[] | Error;
    try {
      result = this._onValue(data);
    } catch (err) {
      result = err instanceof Error ? err : new Error(String(err));
    }
    this._pushRefresh(result);
  }

  protected _onValue(data: unknown): RefreshResultItem[] | Error {
    console.log(data);
    return new Error('_onValue is not implemented.');
  }
}
