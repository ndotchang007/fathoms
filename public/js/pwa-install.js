/**
 * /app install page — wires beforeinstallprompt + iOS / already-installed states.
 */
(function initPwaInstall() {
  const btn = document.getElementById('pwa-install-btn');
  const note = document.getElementById('pwa-install-note');
  const eyebrow = document.getElementById('pwa-eyebrow');
  if (!btn) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let deferredPrompt = null;

  function setNote(html) {
    if (note) note.innerHTML = html;
  }

  function setButton(label, options = {}) {
    const { disabled = false, href = null, onClick = null } = options;
    btn.disabled = disabled;
    btn.textContent = label;
    btn.onclick = null;
    if (href) {
      btn.onclick = () => {
        window.location.href = href;
      };
    } else if (onClick) {
      btn.onclick = onClick;
    }
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === 'accepted') {
      markInstalled();
    } else {
      setButton('Install Fathoms', { disabled: true });
      setNote(
        'Install was dismissed. Use your browser’s install menu, or reload this page to try again. <a href="/init">Sign up</a>.'
      );
    }
  }

  function markInstalled() {
    if (eyebrow) eyebrow.textContent = 'Installed';
    setButton('Open Fathoms', { href: '/init' });
    setNote('Fathoms is on your home screen. Open it anytime to keep diving.');
  }

  if (isStandalone) {
    markInstalled();
    setNote('Fathoms is already installed on this device. Open it anytime from your home screen.');
    return;
  }

  if (isIos) {
    if (eyebrow) eyebrow.textContent = 'Install on iPhone';
    setButton('How to install', {
      onClick: () => {
        setNote(
          'On iPhone or iPad: tap the <strong>Share</strong> button, then choose <strong>Add to Home Screen</strong>. Open Fathoms from the new icon for the full app experience.'
        );
        setButton('Follow the steps above', { disabled: true });
      },
    });
    setNote(
      'Safari on iOS doesn’t show an install popup. Use Share → <strong>Add to Home Screen</strong>. Already tracking dives? <a href="/login">Log in</a> or <a href="/init">sign up</a>.'
    );
  } else {
    setButton('Install Fathoms', { disabled: true });
    setNote(
      'When your browser is ready, tap Install to add Fathoms to your home screen. Prefer the web? <a href="/init">Sign up</a> or <a href="/login">log in</a>.'
    );
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (eyebrow) eyebrow.textContent = 'Ready to install';
    setButton('Install Fathoms', { onClick: promptInstall });
    setNote(
      'Install Fathoms for quick access between dives — same practice flow, home-screen launch. Prefer the web? <a href="/init">Sign up</a> or <a href="/login">log in</a>.'
    );
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markInstalled();
  });

  // Browsers that never fire beforeinstallprompt (Firefox, desktop Safari, etc.)
  window.setTimeout(() => {
    if (deferredPrompt || isStandalone || isIos) return;
    if (eyebrow) eyebrow.textContent = 'Add to home screen';
    setButton('Sign up', { href: '/init' });
    setNote(
      'Your browser doesn’t expose a one-tap install button. Use the browser menu to <strong>Install app</strong> / <strong>Add to Home Screen</strong>, or keep playing on the web. <a href="/init">Sign up</a> · <a href="/login">Log in</a>.'
    );
  }, 2500);
})();
