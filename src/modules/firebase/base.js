import {initializeApp} from 'firebase/app';
import {getDatabase, ref, onValue} from 'firebase/database';
import {PushModuleInterface} from '/pwa/status/js/modules/interface.js';

/**
 * @typedef {import("../interface.js").RefreshResultItem} RefreshResultItem
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 * @typedef {import("../interface.js").CustomCss} CustomCss
 */

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
  #firebaseApp;
  #databasePath;
  #help;
  #unsubscribe;

  /**
   * @param {string} databasePath - the path where the data is stored, the complete reference
   *                                will consist of the user defined token and this path.
   *                                Has to start with '/'.
   * @param {CustomCss[]} css
   * @param {string} help
   */
  constructor(databasePath, css, help) {
    super([], css);
    if (!databasePath.startsWith('/')) {
      throw new Error(`Database path (${databasePath}) has to start with '/'`);
    }
    this.#databasePath = databasePath;
    this.#help = help;
    this.#unsubscribe = () => {};
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return {
      version: 0,
      mergeStrategy: 'DEFAULT_WITH_STORED_EXCLUSIVE',
      help: HELP + this.#help,
      helpTemplate: {
        databaseUrl: 'This is an url provided in the realtime database console (https://console.firebase.google.com/). Should be similar to: https://[project-id]-default-rtdb.europe-west1.firebasedatabase.app/',
        databaseToken: 'This is a simple way to allow passwordless access to firebase. It is a key that will be used as a part of the path where the data is stored. MUST BE at least 20 characters long.',
      },
      template: {
        databaseUrl: '',
        databaseToken: '',
      },
    };
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    this.#unsubscribe();
    if (config.databaseUrl && config.databaseToken && config.databaseToken.length >= 20) {
      const firebaseConfig = {databaseURL: config.databaseUrl};
      this.#firebaseApp = initializeApp(firebaseConfig);
      const database = getDatabase(this.#firebaseApp);
      const dbRef = ref(database, config.databaseToken + this.#databasePath);
      this.#unsubscribe = onValue(dbRef, (snapshot) => this.#onValue(snapshot?.val()));
    } else {
      const err = new Error('Url or token empty or too short, not subscribing to the database.');
      this._pushRefresh(err);
      console.warn(err);
      this.#unsubscribe = () => {};
    }
  }

  /**
   * @param {Object} data
   */
  #onValue(data) {
    let result;
    try {
      result = this._onValue(data);
    } catch (err) {
      result = err;
    }
    this._pushRefresh(result);
  }

  /**
   * @param {Object} data
   * @return {RefreshResultItem[]|Error}
   */
  _onValue(data) {
    return new Error('_onValue is not implemented.');
  }
}
