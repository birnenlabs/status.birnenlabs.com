import {PushModuleInterface, ScheduledModuleInterface} from './interface.js';
import {Event} from '/jslib/js/scheduler.js';
import {combine2} from '/jslib/js/promise.js';


/**
 * @typedef {import("./interface.js").RefreshResult} RefreshResult
 * @typedef {import("./interface.js").RefreshResultItem} RefreshResultItem
 * @typedef {import("./interface.js").RenderHtmlCallback} RenderHtmlCallback
 */

/**
 * @param {ScheduledModuleInterface} module
 * @param {RenderHtmlCallback} renderHtmlCallback
 * @param {boolean} forced
 * @return {Promise<any>}
 */
function render(module, renderHtmlCallback, forced = false) {
  // Don't use Promise.resolve() as moduleRefresh can throw an exception.
  // In this case Promise.resolve(module.refresh()) would never start promise chain
  // and immediatelly fail.
  /** @type {Promise<RefreshResult>} */
  const refreshResultPromise = new Promise((resolve, reject) => resolve(module.refresh(forced)));

  const renderResultPromise = refreshResultPromise
      .then((refreshResult) => refreshResult.skipHtmlUpdate ? undefined : refreshResult.items)
  // renderer callback can handle errors, lets set the promise value to Error.
      .catch((err) => err)
      .then((itemsOrError) => itemsOrError === undefined ? undefined : renderHtmlCallback(module.name, itemsOrError));

  return combine2(refreshResultPromise, renderResultPromise, (refreshResult, unused) => refreshResult)
      .then((refreshResult) =>
        refreshResult.forceNextRefreshTs ?
        Event.at(`${module.name}-forcedUpdate`, () => render(module, renderHtmlCallback, true), refreshResult.forceNextRefreshTs) :
        undefined);
}


/**
 * @param {PushModuleInterface | ScheduledModuleInterface} module
 * @param {RenderHtmlCallback} renderHtmlCallback
 * @return {Promise<any>}
 */
export function initModuleRenderer(module, renderHtmlCallback) {
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
