import {loadModules} from '../js/modules/loader.js';
import {initModuleRenderer} from '../js/modules/renderer.js';
import {init, render, mousemove, mouseover, mouseout} from './html.js';
import {checkNonUndefined} from '/jslib/js/preconditions.js';

/**
 * on page load
 * @return {Promise<any>}
 */
function onPageLoad() {
  const consoleLog = 'Modules: init';
  console.time(consoleLog);
  console.group(consoleLog);

  const modules = loadModules();
  init(modules);

  /** @type {Promise<any>} */
  let result = Promise.resolve();
  for (const module of modules) {
    result = result.then(() => initModuleRenderer(module, render));
  }

  return result
      .finally(() => console.groupEnd())
      .finally(() => console.timeEnd(consoleLog));
}


/**
 * This is a hack around the min height - even in the collapsed version window cannot be smaller than some
 * amount of pixels. If it is moved off screen it might happen that part of it is not visible.
 * This code will detect actual visible height and will set the css to center the font.
 */
function calculateVisibleArea() {
  const areaHeight =
       Math.min(
           Math.min(
               (window.screen.availHeight || window.screen.height) - window.screenTop + ( /** window.screen.availTop is an experimental property */ ( /** @type {any} */ (window.screen)).availTop || 0),
               window.innerHeight),
           // Limit max height to 60px
           60);
  const el = checkNonUndefined(document.getElementById('main-container'));

  // main container will have the same height as visible area
  el.style.height = areaHeight + 'px';
  // line height will cause child elements to center vertically
  el.style.lineHeight = areaHeight + 'px';
  el.style.fontSize = (0.6 * areaHeight) + 'px';

  // Padding doesn't affect font position as this is already decided by the line height parameter.
  // It is only used to extend clickable areas of span elements and should use the entire block
  // height.
//
// Commenting out for now - let's use rectangular shape and predefined padding.
//
//  const padding = (areaHeight / 7) + 'px';
//  checkNonUndefined(document.getElementById('visible-area-style')).innerHTML=`.box { padding-top: ${padding}; padding-bottom: ${padding}; }`;
}

/**
 * Init mouse over events
 */
function setMouseOver() {
  const el = checkNonUndefined(document.getElementById('main-container'));
  el.addEventListener('mouseover', mouseover, false);
  el.addEventListener('mouseout', mouseout, false);
  el.addEventListener('mousemove', mousemove, false);
}

/** init settings */
function initSettingsLink() {
  const el = checkNonUndefined(document.getElementById('settings-link'));
  el.onclick = () => window.open('https://birnenlabs.com/pwa/status/settings/', 'window', 'toolbar=no,menubar=no,resizable=yes');
}

/** set blur class */
function setBlurClass() {
  const el = checkNonUndefined(document.getElementById('main-container'));
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
