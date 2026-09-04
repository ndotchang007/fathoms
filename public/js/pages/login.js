const SUPPORT_EMAIL = 'thenoahchang@gmail.com';

function showLoginError(errorEl, message) {
  errorEl.textContent = `${message} `;
  const link = document.createElement('a');
  link.href = `mailto:${SUPPORT_EMAIL}`;
  link.textContent = 'Contact support';
  errorEl.appendChild(link);
  errorEl.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await API.getMe();
    window.location.href = '/practice';
    return;
  } catch {
    // Not logged in — show login form
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');

  passwordToggle.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    passwordToggle.textContent = showing ? 'Show' : 'Hide';
    passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    passwordToggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value;

    if (username.length < 2) {
      showLoginError(errorEl, 'Please enter your username.');
      return;
    }

    if (password.length < 6) {
      showLoginError(errorEl, 'Please enter your password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      await API.login({ username, password });
      window.location.href = '/practice';
    } catch (err) {
      showLoginError(errorEl, err.message || 'Could not log in.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
});
