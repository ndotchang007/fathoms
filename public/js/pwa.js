/**
 * PWA bootstrap
 * - Browser: full public website (/, /app, /about, …)
 * - Homescreen / standalone: specialized shell → signup only (no marketing)
 */
(function bootstrapFathomsPwa() {
  const isHomescreenApp =
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  const marketingPaths = new Set([
    '/',
    '/about',
    '/app',
    '/index.html',
    '/about.html',
    '/app.html',
  ]);

  if (isHomescreenApp) {
    document.documentElement.classList.add('pwa-shell');

    // Installed app = signup (or login). Never marketing pages.
    if (marketingPaths.has(window.location.pathname)) {
      window.location.replace('/init');
      return;
    }

    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.init-back').forEach((el) => el.remove());
    });
  }

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
})();
