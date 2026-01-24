import {OAuth} from '/jslib/js/oauth.js';

/**
 * @typedef {Object} TaskItem
 *
 * @property {string} title
 * @property {string} url
 * @property {Date} [dueDate]
 */

/** Tasks connector */
export class TasksConnector {
  #oAuth;

  /**
   * @param {OAuth} oAuth
   */
  constructor(oAuth) {
    console.log('TasksConnector created');
    this.#oAuth = oAuth;
  }

  /**
   * @param {string} listId
   * @return {Promise<TaskItem[]>}
   */
  retrieveData(listId) {
    return listId ? this.#retrieveDataWithRetry(listId) : Promise.reject(new Error('List id cannot be empty.'));
  }

  /**
   * @param {string} listId
   * @param {boolean} isItSecondTry
   * @return {Promise<TaskItem[]>}
   */
  #retrieveDataWithRetry(listId, isItSecondTry = false) {
    const consoleTimeId = `TasksConnector.retrieveDataWithRetry ${new Date().toLocaleTimeString([], {timeStyle: 'short'})} listId=${listId} isItSecondTry=${isItSecondTry}`;
    console.time(consoleTimeId);

    return this.#oAuth.getAccessToken(/* use isItSecondTry flag to force refresh on second try*/ isItSecondTry)
        .then((accessToken) => this.#fetchTasks(accessToken, listId))
        .then((response) => {
          if (response.status == 200) {
            return this.#processSuccess(response);
          }
          if (!isItSecondTry) {
            return this.#retrieveDataWithRetry(listId, true);
          }
          return this.#processFailiure(response);
        })
        .finally(() => console.timeEnd(consoleTimeId));
  }

  /**
   * @param {Response} response
   * @return {Promise<TaskItem[]>}
   */
  #processSuccess(response) {
    return response.json()
        .then((json) => json.items)
        .then((items) => this.#jsonToTaskItems(items));
  }

  /**
   * @param {Response} response
   * @return {Promise<TaskItem[]>}
   */
  #processFailiure(response) {
    return response.text()
        .then((text) => {
          throw new Error(text);
        });
  }

  /**
   * @param {Object[]} items
   * @return {TaskItem[]}
   */
  #jsonToTaskItems(items) {
    const now = new Date();
    const result = items.map((item) => ({
      title: item.title,
      url: item.webViewLink,
      // The due date coming from the tasks API is always midnight UTC (the API is not returning
      // task time even when it is set) and the string timestamp ends with 'Z'.
      // Let's remove trailing Z to interpret the date in the local timezone.
      dueDate: item.due ? new Date(item.due.replace(/Z$/, '')) : undefined,
    }))
        .filter((item) => !item.dueDate || item.dueDate <= now);
    console.log(`Retrieved ${items.length} tasks, returning ${result.length} tasks after filtering future ones.`);
    return result;
  }

  /**
   * @param {string} accessToken
   * @param {string} listId
   * @return {Promise<Response>}
   */
  #fetchTasks(accessToken, listId) {
    const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`);
    url.searchParams.set('showCompleted', 'false');
    url.searchParams.set('showDeleted', 'false');
    url.searchParams.set('showHidden', 'false');
    url.searchParams.set('maxResults', '100');
    // Adding param that changes with every request to force no cache.
    // See: https://issuetracker.google.com/issues/136123247
    const randomMin = (Math.floor(Math.random() * 50) + 10).toString();
    const randomSec = (Math.floor(Math.random() * 50) + 10).toString();
    const randomMs = (Math.floor(Math.random() * 900) + 100).toString();
    url.searchParams.set('updatedMin', `2000-01-01T12:${randomMin}:${randomSec}.${randomMs}Z`);
    /** @type {RequestInit} */
    const params = {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'cache-control': 'no-store',
      },
    };
    return fetch(url, params);
  }
}
