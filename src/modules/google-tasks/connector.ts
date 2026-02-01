import {OAuth} from '../../lib/oauth';

export interface TaskItem {
  title: string;
  url: string;
  dueDate?: Date;
}

/** Tasks connector */
export class TasksConnector {
  #oAuth: OAuth;

  constructor(oAuth: OAuth) {
    console.log('TasksConnector created');
    this.#oAuth = oAuth;
  }

  retrieveData(listId: string): Promise<TaskItem[]> {
    if (!listId) {
      return Promise.reject(new Error('List id cannot be empty.'));
    }

    const consoleTimeId = `TasksConnector.retrieveData ${new Date().toLocaleTimeString([], {timeStyle: 'short'})} listId=${listId}`;
    console.time(consoleTimeId);

    return this.#oAuth
      .getAccessToken()
      .then((accessToken) => this.#fetchTasks(accessToken, listId))
      .then((response) => (response.status == 200 ? this.#processSuccess(response) : this.#processFailure(response)))
      .finally(() => console.timeEnd(consoleTimeId));
  }

  #processSuccess(response: Response): Promise<TaskItem[]> {
    return response
      .json()
      .then((json) => json.items)
      .then((items) => this.#jsonToTaskItems(items));
  }

  #processFailure(response: Response): Promise<TaskItem[]> {
    return response.text().then((text) => {
      throw new Error(text);
    });
  }

  #jsonToTaskItems(items: any[]): TaskItem[] {
    const now = new Date();
    const result = items
      .map(
        (item): TaskItem => ({
          title: item.title,
          url: item.webViewLink,
          // The due date coming from the tasks API is always midnight UTC (the API is not returning
          // task time even when it is set) and the string timestamp ends with 'Z'.
          // Let's remove trailing Z to interpret the date in the local timezone.
          dueDate: item.due ? new Date(item.due.replace(/Z$/, '')) : undefined,
        }),
      )
      .filter((item) => !item.dueDate || item.dueDate <= now);
    console.log(`Retrieved ${items.length} tasks, returning ${result.length} tasks after filtering future ones.`);
    return result;
  }

  #fetchTasks(accessToken: string, listId: string): Promise<Response> {
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
    const params: RequestInit = {
      method: 'GET',
      mode: 'cors',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'cache-control': 'no-store',
      },
    };
    return fetch(url, params);
  }
}
