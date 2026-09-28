/* Apply before CSS loads to avoid a theme flash; local storage is optional. */
(function () {
  'use strict';
  const root = document.documentElement, key = 'TE_2D_theme';
  const system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let explicit = saved === 'light' || saved === 'dark';
  root.dataset.theme = explicit ? saved : system?.matches ? 'light' : 'dark';
  function syncButton() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const light = root.dataset.theme === 'light';
    button.setAttribute('aria-pressed', String(light));
    button.title = light ? 'Switch to dark mode' : 'Switch to light mode';
  }
  function apply(theme) {
    root.dataset.theme = theme;
    syncButton();
    requestAnimationFrame(() => {
      const app = globalThis.TEApp;
      if (!app || !globalThis.TE_APP_READY) return;
      app.drawGeometry(); app.drawResults(); app.drawProfile(); app.drawBode();
    });
  }
  globalThis.TETheme = {
    colors() {
      const css = getComputedStyle(root), get = name => css.getPropertyValue('--' + name).trim();
      return {text: get('plot-text'), grid: get('plot-grid'), line: get('plot-line'), point: get('plot-point'),
        background: get('panel'), source: get('contact-source'), sink: get('contact-sink'),
        halo: get('contact-halo'), mesh: get('mesh-line')};
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    syncButton();
    document.getElementById('themeToggle').addEventListener('click', () => {
      const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      explicit = true;
      try { localStorage.setItem(key, theme); } catch {}
      apply(theme);
    });
  });
  system?.addEventListener?.('change', event => { if (!explicit) apply(event.matches ? 'light' : 'dark'); });
})();
