import {checkNonUndefined} from '/jslib/js/preconditions.js';
import {ModuleInterface, ELLIPSIS} from '../js/modules/interface.js';
import {loadCss, generateCssName} from '../js/modules/loader.js';

const BASE_ATT = 'text-base';
const EXTENSION_ATT = 'text-ext';
const MODE_ATT = 'extended-mode';
const SEP_EL = ' • ';
const SEP = ' ◦ ';


/**
 * @typedef {import("../js/modules/interface.js").RefreshResultItem} RefreshResultItem
 *
 */

/**
 * @param {ModuleInterface[]} modules
 */
export function init(modules) {
  console.log('Initialising base DOM structure.');
  const mainEl = checkNonUndefined(document.getElementById('main-container'));

  for (const module of modules) {
    const el = document.createElement('span');
    el.id = module.name;
    mainEl.appendChild(el);

    const sepEl = document.createElement('span');
    sepEl.id = module.name + '-sep';
    sepEl.classList.add('box-sep');
    sepEl.textContent = SEP_EL;
    mainEl.appendChild(sepEl);
  }

  // Remove the last separator
  mainEl.removeChild(/** @type {Node} */(mainEl.lastChild));

  checkNonUndefined(document.getElementById('module-style')).innerHTML= loadCss(modules);
}

/**
 * @param {string} moduleName
 * @param {RefreshResultItem[]|Error} itemsOrError
 */
export function render(moduleName, itemsOrError) {
  if (itemsOrError instanceof Error) {
    renderError(moduleName, itemsOrError);
  } else {
    renderItems(moduleName, itemsOrError);
  }
}

/**
 * @param {string} moduleName
 * @param {RefreshResultItem[]} items
 */
function renderItems(moduleName, items) {
  const parentEl = checkNonUndefined(document.getElementById(moduleName));

  // Expected elements with the separators between.
  const expectedElementsCount = Math.max(2 * items.length - 1, 0);
  if (parentEl.childElementCount != expectedElementsCount) {
    console.log(`Adjusting DOM: ChildElementCount (${parentEl.childElementCount}) doesn't match items size (${items.length}), expected count with separators: ${expectedElementsCount}`);
    for (let i = parentEl.childElementCount; i < expectedElementsCount; i++) {
      const childEl = document.createElement('span');
      if (i % 2) {
        // Even elements should be separators, but it is zero indexed, so the odd elements are.
        childEl.textContent = SEP;
      }
      parentEl.appendChild(childEl);
    }
    while (parentEl.childElementCount > expectedElementsCount) {
      parentEl.removeChild(/** @type {Node} */(parentEl.lastChild));
    }
  }

  for (let i = 0; i < items.length; i++) {
    // Getting text element, ignoring separators.
    const el = /** @type {HTMLElement} */ (parentEl.children[2 * i]);
    const item = items[i];
    if (item.classNames) {
      el.className = item.classNames.map((className) => generateCssName(moduleName, className)).join(' ');
    } else {
      el.className = '';
    }
    el.classList.add('box');
    if (item.urgent) {
      el.classList.add('urgent');
    } else if (item.important) {
      el.classList.add('important');
    }
    if (item.href) {
      el.classList.add('link');
      el.onclick = () => window.open(item.href, 'window', 'toolbar=no,menubar=no,resizable=yes');
    } else {
      el.removeAttribute('onclick');
    }
    setElement(el, item.value, item.extendedValue);
  }

  const display = items.length === 0 ? 'none' : '';
  parentEl.style.display = display;
  const sepEl = document.getElementById(moduleName + '-sep');
  if (sepEl) {
    sepEl.style.display = display;
  }
}

/**
 * @param {string} moduleName
 * @param {Error} error
 */
function renderError(moduleName, error) {
  const parentEl = checkNonUndefined(document.getElementById(moduleName));

  if (!parentEl.hasChildNodes()) {
    parentEl.appendChild(document.createElement('span'));
  }

  const el = parentEl.children[0];
  el.className = 'box error';
  setElement(el, error.message, '');
}

/**
 * @param {Element} el
 * @param {string} text
 * @param {string|string[]|undefined} extension
 */
function setElement(el, text, extension) {
  el.setAttribute(BASE_ATT, text);

  if (extension === '') {
    // If the extension text is explicitely set to empty, let's remove the attribute.
    el.removeAttribute(EXTENSION_ATT);
  } else if (extension !== undefined) {
    // Otherwise update the text only if not undefined
    if (Array.isArray(extension)) {
      el.setAttribute(EXTENSION_ATT, SEP + extension.join(SEP));
    } else {
      el.setAttribute(EXTENSION_ATT, extension);
    }
  }

  updateView(el);
}

/**
 * @param {Element} el
 */
function updateView(el) {
  const extendedMode = el.hasAttribute(MODE_ATT);

  if (extendedMode) {
    let base = checkNonUndefined(el.getAttribute(BASE_ATT));
    if (base.slice(-1) === ELLIPSIS) {
      base = base.slice(0, -1);
    }
    el.textContent = base + (el.getAttribute(EXTENSION_ATT) || '');
  } else {
    el.textContent = checkNonUndefined(el.getAttribute(BASE_ATT));
  }
}

/**
 * @param {MouseEvent} e
 */
export function mouseover(e) {
  const el = e.target;
  if (el instanceof HTMLElement && el.hasAttribute(BASE_ATT)) {
    // el.getBoundingClientRect returns element position in relation to
    // the viewport - the same as clientX and clientY from mouse event is using.
    // Let's store the clientX value of the element before expansion.
    // It will be used to hide it in mouse move event if the coursor would have left.
    const elClientX = Math.ceil(el.getBoundingClientRect().left + el.getBoundingClientRect().width + 1);
    el.setAttribute(MODE_ATT, '' + elClientX);

    updateView(el);
  }
}

/**
 * @param {MouseEvent} e
 */
export function mouseout(e) {
  const el = e.target;
  if (el instanceof HTMLElement && el.hasAttribute(BASE_ATT)) {
    el.removeAttribute(MODE_ATT);
    updateView(el);
  }
}

/**
 * @param {MouseEvent} e
 */
export function mousemove(e) {
  const el = e.target;
  if (el instanceof HTMLElement && el.hasAttribute(MODE_ATT)) {
    const clientX = checkNonUndefined(el.getAttribute(MODE_ATT));
    // Call mouse out if the coursor would have left element before expansion.
    if (e.clientX > +clientX) {
      mouseout(e);
    }
  }
}
