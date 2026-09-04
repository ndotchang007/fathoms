const NAV_ITEMS = [
  { href: '/practice', label: 'Practice', icon: 'mic' },
  { href: '/stats', label: 'Stats', icon: 'chart' },
  { href: '/profile', label: 'Profile', icon: 'user' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/><path d="M6 9a6 6 0 0 0 12 0V5H6v4z"/><path d="M12 15v4"/><path d="M8 22h8"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

function renderNav() {
  const currentPath = window.location.pathname;
  const sidebarNav = document.getElementById('sidebar-nav');
  const mobileNav = document.getElementById('mobile-nav');

  if (sidebarNav) {
    sidebarNav.innerHTML = NAV_ITEMS.map((item) => {
      const active = currentPath === item.href ? ' active' : '';
      return `<a href="${item.href}" class="sidebar-link${active}" aria-current="${active ? 'page' : 'false'}" title="${item.label}">${ICONS[item.icon]}<span class="sidebar-link-label">${item.label}</span></a>`;
    }).join('');
  }

  const footer = document.querySelector('.sidebar-footer');
  if (footer && !footer.querySelector('.sidebar-logout')) {
    footer.innerHTML = `<button type="button" class="sidebar-logout" id="sidebar-logout">Log out</button>`;
    document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
      try { await API.logout(); } catch { /* ignore */ }
      window.location.href = '/';
    });
  }

  if (mobileNav) {
    mobileNav.innerHTML = `<div class="mobile-nav-inner">${NAV_ITEMS.map((item) => {
      const active = currentPath === item.href ? ' active' : '';
      return `<a href="${item.href}" class="mobile-link${active}">${ICONS[item.icon]}${item.label}</a>`;
    }).join('')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', renderNav);
