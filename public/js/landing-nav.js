/**
 * Landing header — mobile nav toggle.
 */

function bindMobileNav() {
  const header = document.querySelector('.glass-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('glass-nav');
  if (!header || !toggle || !nav) return;

  function setOpen(open) {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-menu-open', open);
  }

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains('nav-open'));
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) setOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', bindMobileNav);
