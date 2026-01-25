import {ModuleInterface, RefreshResultItem, ELLIPSIS} from './modules/interface';
import {loadCss, generateCssName} from './modules/loader';

const BASE_ATT = 'text-base';
const EXTENSION_ATT = 'text-ext';
const MODE_ATT = 'extended-mode';
const SEP_EL = ' • ';
const SEP = ' ◦ ';

export function init(modules: ModuleInterface[]): void {
  console.log('Initialising base DOM structure.');
  const mainEl = document.getElementById('main-container') as HTMLDivElement;

  for (const module of modules) {
    const el = document.createElement('span');
    el.id = module.name;
    mainEl.appendChild(el);

    const sepEl = document.createElement('span');
    sepEl.id = `${module.name}-sep`;
    sepEl.classList.add('box-sep');
    sepEl.textContent = SEP_EL;
    mainEl.appendChild(sepEl);
  }

  // Remove the last separator
  if (mainEl.lastChild) {
    mainEl.removeChild(mainEl.lastChild);
  }

  (document.getElementById('module-style') as HTMLStyleElement).innerHTML = loadCss(modules);
}

export function render(moduleName: string, itemsOrError: RefreshResultItem[] | Error): void {
  if (itemsOrError instanceof Error) {
    renderError(moduleName, itemsOrError);
  } else {
    renderItems(moduleName, itemsOrError);
  }
}

function renderItems(moduleName: string, items: RefreshResultItem[]): void {
  const parentEl = document.getElementById(moduleName) as HTMLDivElement;

  // Expected elements with the separators between.
  const expectedElementsCount = Math.max(2 * items.length - 1, 0);

  if (parentEl.childElementCount !== expectedElementsCount) {
    console.log(
      `Adjusting DOM: ChildElementCount (${parentEl.childElementCount}) doesn't match items size (${items.length}), expected count with separators: ${expectedElementsCount}`,
    );

    while (parentEl.childElementCount < expectedElementsCount) {
      const childEl = document.createElement('span');
      if (parentEl.childElementCount % 2 === 1) {
        childEl.textContent = SEP;
      }
      parentEl.appendChild(childEl);
    }

    while (parentEl.childElementCount > expectedElementsCount) {
      if (parentEl.lastChild) {
        parentEl.removeChild(parentEl.lastChild);
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const el = parentEl.children[2 * i] as HTMLElement;
    const item = items[i]!;

    el.className = item.classNames
      ? item.classNames.map((className: string) => generateCssName(moduleName, className)).join(' ')
      : '';
    el.classList.add('box');

    if (item.urgent) {
      el.classList.add('urgent');
    } else if (item.important) {
      el.classList.add('important');
    }

    if (item.onclick) {
      el.classList.add('link');
      el.onclick = item.onclick;
    } else {
      el.removeAttribute('onclick');
      el.classList.remove('link');
    }

    setElement(el, item.value, item.extendedValue);
  }

  const display = items.length === 0 ? 'none' : '';
  parentEl.style.display = display;
  const sepEl = document.getElementById(`${moduleName}-sep`);
  if (sepEl) {
    sepEl.style.display = display;
  }
}

function renderError(moduleName: string, error: Error): void {
  const parentEl = document.getElementById(moduleName) as HTMLElement;

  if (!parentEl.hasChildNodes()) {
    parentEl.appendChild(document.createElement('span'));
  }

  while (parentEl.childElementCount > 1) {
    if (parentEl.lastChild) {
      parentEl.removeChild(parentEl.lastChild);
    }
  }

  const el = parentEl.lastChild as HTMLElement;
  el.className = 'box error';
  el.onclick = null;
  setElement(el, error.message, '');
}

function setElement(el: HTMLElement, text: string, extension: string | string[] | undefined): void {
  el.setAttribute(BASE_ATT, text);

  if (extension === '') {
    el.removeAttribute(EXTENSION_ATT);
  } else if (extension !== undefined) {
    const extText = Array.isArray(extension) ? SEP + extension.join(SEP) : extension;
    el.setAttribute(EXTENSION_ATT, extText);
  }

  updateView(el);
}

function updateView(el: HTMLElement): void {
  const baseAttr = el.getAttribute(BASE_ATT);
  if (el.hasAttribute(MODE_ATT)) {
    let base = baseAttr || '';
    if (base.slice(-1) === ELLIPSIS) {
      base = base.slice(0, -1);
    }
    el.textContent = base + (el.getAttribute(EXTENSION_ATT) || '');
  } else {
    el.textContent = baseAttr;
  }
}

export function mouseover(e: MouseEvent): void {
  const el = e.target as HTMLElement;
  if (el && el.hasAttribute(BASE_ATT)) {
    // el.getBoundingClientRect returns element position in relation to
    // the viewport - the same as clientX and clientY from mouse event is using.
    // Let's store the clientX value of the element before expansion.
    // It will be used to hide it in mouse move event if the coursor would have left.
    const elClientX = Math.ceil(el.getBoundingClientRect().left + el.getBoundingClientRect().width + 1);
    el.setAttribute(MODE_ATT, `${elClientX}`);
    updateView(el);
  }
}

export function mouseout(e: MouseEvent): void {
  const el = e.target as HTMLElement;
  if (el && el.hasAttribute(BASE_ATT)) {
    el.removeAttribute(MODE_ATT);
    updateView(el);
  }
}

export function mousemove(e: MouseEvent): void {
  const el = e.target as HTMLElement;
  if (el && el.hasAttribute(MODE_ATT)) {
    const clientX = el.getAttribute(MODE_ATT);
    if (clientX && e.clientX > +clientX) {
      mouseout(e);
    }
  }
}
