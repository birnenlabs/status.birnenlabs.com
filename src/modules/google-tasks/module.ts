
import {ScheduledModuleInterface, RefreshResult, RefreshResultItem, DefaultConfig} from '../interface';
import {OAuth} from '../../lib/oauth';
import {TasksConnector, TaskItem} from './connector';
import {processOAuth} from '../google-calendar/oauth';
import {DEFAULT_CONFIG} from './config';

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
  private connector?: TasksConnector;
  private errorMessage: string;
  private listIds: string[];

  constructor() {
    super(12, CSS);

    this.errorMessage = 'Configuration was not set.';
    this.listIds = [];
  }

  async refresh(forced: boolean): Promise<RefreshResult> {
    const midnightToday = new Date();
    midnightToday.setHours(0, 0, 0, 0);

    if (this.connector) {
      console.groupCollapsed(`GoogleTasksModule.refresh(${forced}) ${new Date().toLocaleTimeString([], {timeStyle: 'short'})}`);
      const timeConsole = 'GoogleTasksModule.refresh';
      console.time(timeConsole);

      try {
        const tasks = await Promise.all(
            this.listIds.map((listId) => this.connector!.retrieveData(listId)),
        );
        const items = tasks
            .flat()
            .sort(compareTaskItem)
            .map((task: TaskItem) => this.taskItemToRefreshResultItem(task, midnightToday));
        return {items};
      } finally {
        console.groupEnd();
        console.timeEnd(timeConsole);
      }
    } else {
      return Promise.reject(new Error(this.errorMessage));
    }
  }

  private taskItemToRefreshResultItem(taskItem: TaskItem, midnightToday: Date): RefreshResultItem {
    console.log(`Task: due: ${taskItem.dueDate?.toLocaleString('sv-SV')}, title: ${taskItem.title}`);
    return {
      value: `□ ${taskItem.title}`,
      href: taskItem.url,
      classNames: taskItem.dueDate
        ? taskItem.dueDate < midnightToday
          ? ['overdue']
          : ['today']
        : [],
    };
  }

  getDefaultConfig(): DefaultConfig {
    return DEFAULT_CONFIG;
  }

  setConfig(config: {[key: string]: string}): void {
    this.listIds = config.listIds?.split(',').filter((i) => i) ?? [];
    const oAuthOrError = processOAuth(this, config);
    if (oAuthOrError instanceof OAuth) {
      this.connector = new TasksConnector(oAuthOrError);
      this.errorMessage = '';
    } else {
      this.connector = undefined;
      this.errorMessage = oAuthOrError;
    }
  }
}

const FUTURE_DATE = new Date(2100, 0, 1);

function compareTaskItem(t1: TaskItem, t2: TaskItem): number {
  return (
    ((t1.dueDate || FUTURE_DATE).getTime() - (t2.dueDate || FUTURE_DATE).getTime()) ||
    t1.title.localeCompare(t2.title)
  );
}
