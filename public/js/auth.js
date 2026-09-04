async function requireAuth() {
  try {
    const { user } = await API.getMe();
    applyUserSettings(user.settings);
    return user;
  } catch {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    window.location.href = standalone ? '/init' : '/';
    return null;
  }
}

function applyUserSettings(settings) {
  if (!settings) return;
  if (settings.reducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  }
  if (settings.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

async function redirectIfLoggedIn(target = '/practice') {
  try {
    await API.getMe();
    window.location.href = target;
    return true;
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('landing-body')
    && !document.body.classList.contains('init-body')
    && !document.body.classList.contains('login-body')
    && !document.body.classList.contains('about-body')
    && !document.body.classList.contains('app-body')) {
    redirectIfLoggedIn();
  }
});
