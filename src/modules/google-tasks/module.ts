import {ScheduledModuleInterface} from '/pwa/status/js/modules/interface.js';
import {OAuth} from '/jslib/js/oauth.js';
import {TasksConnector} from './connector.js';
import {processOAuth} from '../google-calendar/oauth.js';
import {checkNonUndefined} from '/jslib/js/preconditions.js';
import {DEFAULT_CONFIG} from './config.js';

/**
 * @typedef {import("../interface.js").RefreshResult} RefreshResult
 * @typedef {import("../interface.js").RefreshResultItem} RefreshResultItem
 * @typedef {import("../interface.js").DefaultConfig} DefaultConfig
 * @typedef {import("./connector.js").TaskItem} TaskItem
 */

const CSS = [
  {
    className: 'overdue',
    color: '#f66',
  },
  {
    className: 'today',
    color: '#ffd580',
  },
];

/**
 * Implements ScheduledModuleInterface
 */
export class GoogleTasksModule extends ScheduledModuleInterface {
  /** @type {TasksConnector|undefined} */
  #connector;

  /** @type {string} */
  #errorMessage;

  /** @type {string[]} */
  #listIds;

  /**
   * Constructor
   */
  constructor() {
    super(12, CSS);

    this.#errorMessage = 'Configuration was not set.';
  }

  /**
   * @param {boolean} forced
   * @return {Promise<RefreshResult>}
   */
  refresh(forced) {
    const midnightToday = new Date();
    midnightToday.setHours(0, 0, 0, 0);
    if (this.#connector) {
      console.groupCollapsed(`GoogleTasksModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`);
      const timeConsole = 'GoogleTasksModule.refresh';
      console.time(timeConsole);
      return Promise.all(this.#listIds.map((listId) => checkNonUndefined(this.#connector).retrieveData(listId)))
          .then((tasks) => tasks.flat().sort(compareTaskItem).map((task) => this.#taskItemToRefreshResultItem(task, midnightToday)))
          .then((items) => ({items}))
          .finally(() => console.groupEnd())
          .finally(() => console.timeEnd(timeConsole));
    } else {
      return Promise.reject(new Error(this.#errorMessage));
    }
  }

  /**
   * @param {TaskItem} taskItem
   * @param {Date} midnightToday
   * @return {RefreshResultItem}
   */
  #taskItemToRefreshResultItem(taskItem, midnightToday) {
    console.log(`Task: due: ${taskItem.dueDate?.toLocaleString('sv-SV')}, title: ${taskItem.title}`);
    return {
      value: `□ ${taskItem.title}`,
      href: taskItem.url,
      classNames: taskItem.dueDate ?
           (taskItem.dueDate < midnightToday ? ['overdue'] : ['today']) :
           [],
    };
  }

  /**
   * @return {DefaultConfig}
   */
  getDefaultConfig() {
    return DEFAULT_CONFIG;
  }

  /**
   * @param {Object<string, string>} config
   */
  setConfig(config) {
    this.#listIds = config.listIds.split(',').filter((i) => i);
    const oAuthOrError = processOAuth(this, config);
    if (oAuthOrError instanceof OAuth) {
      this.#connector = new TasksConnector(oAuthOrError);
      this.#errorMessage = '';
    } else {
      this.#connector = undefined;
      this.#errorMessage = oAuthOrError;
    }
  }
}

const FUTURE_DATE = new Date(2100, 0, 1);

/**
 * @param {TaskItem} t1
 * @param {TaskItem} t2
 * @return {number}
 */
function compareTaskItem(t1, t2) {
  return ((t1.dueDate || FUTURE_DATE).getTime() - (t2.dueDate || FUTURE_DATE).getTime()) || t1.title.localeCompare(t2.title);
}

