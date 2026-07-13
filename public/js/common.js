function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function showAlert(message, type = 'error') {
  const alertBox = document.getElementById('alert-box');
  if (!alertBox) return;

  alertBox.textContent = message;
  alertBox.className = '';
  alertBox.style.background = type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)';
  alertBox.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
  alertBox.style.border = `1px solid ${type === 'error' ? 'var(--danger)' : 'var(--success)'}`;
  alertBox.style.padding = '0.75rem 1rem';
  alertBox.style.borderRadius = 'var(--radius-md)';
  alertBox.style.marginBottom = '1rem';
  alertBox.style.fontSize = '0.85rem';
  alertBox.style.display = 'block';
}

function hideAlert() {
  const alertBox = document.getElementById('alert-box');
  if (alertBox) alertBox.style.display = 'none';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function parseJsonSafe(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return res.json();
}

async function tryRefreshSession() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  return res.ok;
}

async function apiRequest(url, options = {}, retry = true) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 401 && retry && url !== '/api/auth/refresh') {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiRequest(url, options, false);
    }
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const message = data?.errors
      ? data.errors.map((error) => error.message || error.msg).join(', ')
      : data?.message || 'Something went wrong';
    throw new Error(message);
  }

  return data;
}

/* ── Theme Toggle ── */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  localStorage.setItem('sms-theme', next);

  updateThemeButtons(next);

  // Re-render Google Sign-In button for new theme
  if (typeof initGoogleSignIn === 'function') {
    const container = document.getElementById('google-signin-btn');
    if (container) {
      container.innerHTML = '';
      initGoogleSignIn();
    }
  }
}

function updateThemeButtons(theme) {
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    var icon = btn.querySelector('.theme-icon');
    var label = btn.querySelector('.theme-label');
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  });

  document.querySelectorAll('.auth-theme-toggle').forEach(function(btn) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  });
}

// Attach click handlers and set initial labels on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  updateThemeButtons(theme);

  // Attach click handlers (CSP-safe, no inline onclick)
  document.querySelectorAll('.theme-toggle, .auth-theme-toggle').forEach(function(btn) {
    btn.addEventListener('click', toggleTheme);
  });
});
