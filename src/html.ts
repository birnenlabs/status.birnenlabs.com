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
  const newChildren: Node[] = [];

  items.forEach((item, i) => {
    const el = document.createElement('span');

    el.className = item.classNames ? item.classNames.map((c: string) => generateCssName(moduleName, c)).join(' ') : '';
    el.classList.add('box');
    el.classList.toggle('urgent', !!item.urgent);
    el.classList.toggle('important', !!item.important && !item.urgent);
    el.classList.toggle('link', !!item.onclick);

    if (item.onclick) {
      el.onclick = item.onclick;
    }

    setElement(el, item.value, item.extendedValue);
    newChildren.push(el);

    if (i < items.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = SEP;
      newChildren.push(sep);
    }
  });

  parentEl.replaceChildren(...newChildren);

  const display = items.length === 0 ? 'none' : '';
  parentEl.style.display = display;
  const sepEl = document.getElementById(`${moduleName}-sep`);
  if (sepEl) {
    sepEl.style.display = display;
  }
}

function renderError(moduleName: string, error: Error): void {
  const parentEl = document.getElementById(moduleName) as HTMLElement;

  parentEl.style.display = '';
  const sepEl = document.getElementById(`${moduleName}-sep`);
  if (sepEl) {
    sepEl.style.display = '';
  }

  const el = document.createElement('span');
  el.className = 'box error';
  setElement(el, error.message, '');
  parentEl.replaceChildren(el);
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
