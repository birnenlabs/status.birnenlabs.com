import {ModuleInterface, RefreshResultItem, ELLIPSIS} from './modules/interface';
import {loadCss, generateCssName} from './modules/loader';

const BASE_ATT = 'text-base';
const EXTENSION_ATT = 'text-ext';
const MODE_ATT = 'extended-mode';
const SEP_EL = ' • ';
const SEP = ' ◦ ';

export function init(modules: ModuleInterface[]) {
  console.log('Initialising base DOM structure.');
  const mainEl = (document.getElementById('main-container') as HTMLDivElement);

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
  mainEl.removeChild(mainEl.lastChild as ChildNode);

  (document.getElementById('module-style') as HTMLStyleElement).innerHTML= loadCss(modules);
}

export function render(moduleName: string, itemsOrError: RefreshResultItem[]|Error) {
  if (itemsOrError instanceof Error) {
    renderError(moduleName, itemsOrError);
  } else {
    renderItems(moduleName, itemsOrError);
  }
}

function renderItems(moduleName: string, items: RefreshResultItem[]) {
  const parentEl = (document.getElementById(moduleName) as HTMLDivElement);

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
      parentEl.removeChild(parentEl.lastChild as ChildNode);
    }
  }

  for (let i = 0; i < items.length; i++) {
    // Getting text element, ignoring separators.
    const el = (parentEl.children[2 * i] as HTMLElement);
    const item = items[i];
    if (item.classNames) {
      el.className = item.classNames.map((className: string) => generateCssName(moduleName, className)).join(' ');
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

function renderError(moduleName: string, error: Error) {
  const parentEl = (document.getElementById(moduleName) as HTMLElement);

  if (!parentEl.hasChildNodes()) {
    parentEl.appendChild(document.createElement('span'));
  }

  const el = parentEl.children[0];
  el.className = 'box error';
  setElement(el, error.message, '');
}

function setElement(el: Element, text: string, extension: string|string[]|undefined) {
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

function updateView(el: Element) {
  if (el.hasAttribute(MODE_ATT)) {
    let base = el.getAttribute(BASE_ATT)!;
    if (base.slice(-1) === ELLIPSIS) {
      base = base.slice(0, -1);
    }
    el.textContent = base + (el.getAttribute(EXTENSION_ATT) || '');
  } else {
    el.textContent = el.getAttribute(BASE_ATT);
  }
}

export function mouseover(e: MouseEvent) {
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

export function mouseout(e: MouseEvent) {
  const el = e.target;
  if (el instanceof HTMLElement && el.hasAttribute(BASE_ATT)) {
    el.removeAttribute(MODE_ATT);
    updateView(el);
  }
}

export function mousemove(e: MouseEvent) {
  const el = e.target;
  if (el instanceof HTMLElement && el.hasAttribute(MODE_ATT)) {
    const clientX = el.getAttribute(MODE_ATT)!;
    // Call mouse out if the coursor would have left element before expansion.
    if (e.clientX > +clientX) {
      mouseout(e);
    }
  }
}
