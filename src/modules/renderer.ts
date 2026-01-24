import {PushModuleInterface, ScheduledModuleInterface, RefreshResult, RenderHtmlCallback} from './interface';
import {Event} from '../lib/scheduler';
import {combine} from '../lib/promise';

function render(
    module: ScheduledModuleInterface,
    renderHtmlCallback: RenderHtmlCallback,
    forced: boolean = false): Promise<any> {
  // Don't use Promise.resolve() as moduleRefresh can throw an exception.
  // In this case Promise.resolve(module.refresh()) would never start promise chain
  // and immediatelly fail.
  const refreshResultPromise: Promise<RefreshResult> = new Promise((resolve) => resolve(module.refresh(forced)));

  const renderResultPromise = refreshResultPromise
      .then((refreshResult) => refreshResult.skipHtmlUpdate ? undefined : refreshResult.items)
  // renderer callback can handle errors, lets set the promise value to Error.
      .catch((err) => err)
      .then((itemsOrError) => itemsOrError === undefined ? undefined : renderHtmlCallback(module.name, itemsOrError));

  return combine(refreshResultPromise, renderResultPromise, (refreshResult: RefreshResult, _: any) => refreshResult)
      .then((refreshResult: RefreshResult) =>
        refreshResult.forceNextRefreshTs ?
        Event.at(`${module.name}-forcedUpdate`, () => render(module, renderHtmlCallback, true), refreshResult.forceNextRefreshTs) :
        undefined);
}

export function initModuleRenderer(
    module: PushModuleInterface | ScheduledModuleInterface,
    renderHtmlCallback: RenderHtmlCallback): Promise<any> {
  if (module instanceof PushModuleInterface) {
    module.setCallback(renderHtmlCallback);
    return Promise.resolve();
  } else if (module instanceof ScheduledModuleInterface) {
    Event.repeat(module.name, () => render(module, renderHtmlCallback, false), module.repeatMin);
    return render(module, renderHtmlCallback, true)
    // catch an error here. The error is already rendered.
        .catch((err) => console.warn(`Could not render module: ${module.name}`, err));
  } else {
    return Promise.reject(new Error('Invalid module instance'));
  }
}