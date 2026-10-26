(() => {
  const MENU_ROOT_ID = 'filt-common-menu-v2';
  const DESKTOP_BUTTON_ID = 'filt-home-button-desktop';
  const MOBILE_BUTTON_ID = 'filt-home-button-mobile';

  if (window.__FILT_HOME_BUTTON_LOADED) return;
  window.__FILT_HOME_BUTTON_LOADED = true;

  const css = [
    '#' + MENU_ROOT_ID + ' .filt-home-button { display:block; width:15px; height:15px; padding:0; border:0; border-radius:50%; background:#000; cursor:pointer; transition:opacity .3s ease, transform .2s ease; }',
    '#' + MENU_ROOT_ID + ' .filt-home-button:hover { opacity:.5; }',
    '#' + MENU_ROOT_ID + ' .filt-home-button:active { transform:scale(.9); background:#fff; }',
    '#' + MENU_ROOT_ID + ' .filt-home-button:focus-visible { outline:2px solid #BD005E; outline-offset:4px; }',
    '#' + MENU_ROOT_ID + ' .filt-home-button--desktop { position:absolute; top:20px; left:20px; z-index:15; }',
    '#' + MENU_ROOT_ID + ' .filt-home-button--mobile { display:none; position:fixed; top:20px; left:20px; z-index:999993; }',
    '@media (max-width:768px) {',
    '  #' + MENU_ROOT_ID + ' .filt-home-button--desktop { display:none; }',
    '  #' + MENU_ROOT_ID + ' .filt-home-button--mobile { display:block; }',
    '}'
  ].join('\n');

  function makeButton(id, className) {
    const link = document.createElement('a');
    link.id = id;
    link.className = className;
    link.href = '/home';
    link.setAttribute('aria-label', '홈으로 이동');
    link.setAttribute('title', '홈으로 이동');
    return link;
  }

  function mount() {
    const root = document.getElementById(MENU_ROOT_ID);
    const panel = root && root.querySelector('.side-panel');
    if (!root || !panel) return false;
    if (document.getElementById(DESKTOP_BUTTON_ID)) return true;

    const style = document.createElement('style');
    style.id = 'filt-home-button-styles';
    style.textContent = css;
    document.head.appendChild(style);

    panel.appendChild(makeButton(DESKTOP_BUTTON_ID, 'filt-home-button filt-home-button--desktop'));
    root.appendChild(makeButton(MOBILE_BUTTON_ID, 'filt-home-button filt-home-button--mobile'));
    return true;
  }

  if (document.readyState === 'loading' && !document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      if (mount()) return;
      observeForMenu();
    }, { once:true });
  } else if (!mount()) {
    observeForMenu();
  }

  function observeForMenu() {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();