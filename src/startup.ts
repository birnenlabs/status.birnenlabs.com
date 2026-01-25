import {loadModules} from './modules/loader';
import {initModuleRenderer} from './modules/renderer';
import {init, render, mousemove, mouseover, mouseout} from './html';

function onPageLoad(): Promise<void> {
  const consoleLog = 'Modules: init';
  console.time(consoleLog);
  console.group(consoleLog);

  const modules = loadModules();
  init(modules);

  let result = Promise.resolve();
  for (const module of modules) {
    result = result.then(() => initModuleRenderer(module, render));
  }

  return result.finally(() => console.groupEnd()).finally(() => console.timeEnd(consoleLog));
}

/**
 * This is a hack around the min height - even in the collapsed version window cannot be smaller than some
 * amount of pixels. If it is moved off screen it might happen that part of it is not visible.
 * This code will detect actual visible height and will set the css to center the font.
 */
function calculateVisibleArea(): void {
  const screen = window.screen as any;
  const areaHeight = Math.min(
    Math.min((screen.availHeight || screen.height) - window.screenTop + (screen.availTop || 0), window.innerHeight),
    // Limit max height to 60px
    60,
  );
  const el = document.getElementById('main-container') as HTMLDivElement;
  // main container will have the same height as visible area
  el.style.height = `${areaHeight}px`;
  // line height will cause child elements to center vertically
  el.style.lineHeight = `${areaHeight}px`;
  el.style.fontSize = `${0.6 * areaHeight}px`;
}

/**
 * Init mouse over events
 */
function setMouseOver(): void {
  const el = document.getElementById('main-container') as HTMLDivElement;
  el.addEventListener('mouseover', mouseover, false);
  el.addEventListener('mouseout', mouseout, false);
  el.addEventListener('mousemove', mousemove, false);
}

/** init settings */
function initSettingsLink(): void {
  const el = document.getElementById('settings-link') as HTMLSpanElement;
  el.onclick = () => window.open('./settings.html', 'window', 'toolbar=no,menubar=no,resizable=yes');
}

/** set blur class */
function setBlurClass(): void {
  const el = document.getElementById('main-container') as HTMLDivElement;
  if (document.hasFocus()) {
    el.classList.remove('blur');
  } else {
    el.classList.add('blur');
  }
}

document.addEventListener('DOMContentLoaded', onPageLoad);
document.addEventListener('DOMContentLoaded', setMouseOver);
document.addEventListener('DOMContentLoaded', initSettingsLink);

// Recalculate visible area on events
document.addEventListener('DOMContentLoaded', calculateVisibleArea);
window.addEventListener('blur', calculateVisibleArea);
window.addEventListener('focus', calculateVisibleArea);
window.addEventListener('resize', calculateVisibleArea);
// Recalculate window size 5 seconds after window resize to allow screens to properly attach.
window.addEventListener('resize', () => setTimeout(calculateVisibleArea, 5000));

// Set settings link opacity
window.addEventListener('focus', setBlurClass);
window.addEventListener('blur', setBlurClass);
