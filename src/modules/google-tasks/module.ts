import {ScheduledModuleInterface, RefreshResult, RefreshResultItem, DefaultConfig} from '../interface';
import {launchOAuthPopup, OAuth, OAuthSettings} from '../../lib/oauth';
import {TasksConnector, TaskItem} from './connector';
import {DEFAULT_CONFIG} from './config';
import {upsertOAuthSettingsForGoogle} from '../../lib/oauth-defaults';

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

export class GoogleTasksModule extends ScheduledModuleInterface {
  private listIds: string[];
  private oAuthSettings: OAuthSettings | undefined;

  constructor() {
    super(12, CSS);

    this.listIds = [];
  }

  override refresh(forced: boolean): RefreshResult | Promise<RefreshResult> {
    const midnightToday = new Date();
    midnightToday.setHours(0, 0, 0, 0);

    if (!this.oAuthSettings) {
      return Promise.reject(new Error('Configuration was not set.'));
    }

    if (!this.oAuthSettings.isInitialised()) {
      return Promise.reject(new Error('Scope, clientId or clientSecret is not set. Please go to the settings page.'));
    }

    if (!this.oAuthSettings.hasRefreshToken()) {
      return {
        items: [{value: 'Click to authenticate', onclick: () => launchOAuthPopup(this.oAuthSettings!)}],
        // Force refresh every 2 seconds.
        forceNextRefreshTs: new Date().getTime() / 1000 + 2,
      };
    }

    console.groupCollapsed(
      `GoogleTasksModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`,
    );
    const connector = new TasksConnector(new OAuth(this.oAuthSettings));
    const timeConsole = 'GoogleTasksModule.refresh';
    console.time(timeConsole);
    return Promise.all(this.listIds.map((listId) => connector.retrieveData(listId)))
      .then((tasks) =>
        tasks
          .flat()
          .sort(compareTaskItem)
          .map((task) => this.taskItemToRefreshResultItem(task, midnightToday)),
      )
      .then((items) => ({items}))
      .finally(() => console.groupEnd())
      .finally(() => console.timeEnd(timeConsole));
  }

  private taskItemToRefreshResultItem(taskItem: TaskItem, midnightToday: Date): RefreshResultItem {
    console.log(`Task: due: ${taskItem.dueDate?.toLocaleString('sv-SV')}, title: ${taskItem.title}`);
    return {
      value: `□ ${taskItem.title}`,
      onclick: () => window.open(taskItem.url, 'window', 'toolbar=no,menubar=no,resizable=yes'),
      classNames: taskItem.dueDate ? (taskItem.dueDate < midnightToday ? ['overdue'] : ['today']) : [],
    };
  }

  override getDefaultConfig(): DefaultConfig {
    return DEFAULT_CONFIG;
  }

  override setConfig(config: Record<string, string>): void {
    this.listIds = config['listIds']?.split(',').filter((i) => i) ?? [];
    this.oAuthSettings = upsertOAuthSettingsForGoogle(
      this.name,
      config['oauthSettingsVersion'] || '',
      config['scope'] || '',
      config['clientId'] || '',
      config['clientSecret'] || '',
    );
  }
}

const FUTURE_DATE = new Date(2100, 0, 1);

function compareTaskItem(t1: TaskItem, t2: TaskItem): number {
  return (
    (t1.dueDate || FUTURE_DATE).getTime() - (t2.dueDate || FUTURE_DATE).getTime() || t1.title.localeCompare(t2.title)
  );
}
