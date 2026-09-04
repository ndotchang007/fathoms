document.addEventListener('DOMContentLoaded', async () => {
  try {
    await API.getMe();
    window.location.href = '/practice';
    return;
  } catch {
    // Not logged in — show init form
  }

  const form = document.getElementById('init-form');
  const errorEl = document.getElementById('init-error');
  const submitBtn = document.getElementById('init-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const focusArea = document.getElementById('focus-area').value;

    if (username.length < 2) {
      errorEl.textContent = 'Please enter a username with at least 2 characters.';
      errorEl.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    try {
      await API.register({ username, password, focusArea: focusArea || null });
      window.location.href = '/practice';
    } catch (err) {
      errorEl.textContent = err.message || 'Could not create profile.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Track your fathoms';
    }
  });
});
