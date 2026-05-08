// ── Shared Utilities ──
// Common functions used across all frontend pages to avoid duplication.

// Escapes HTML entities in a string to prevent XSS when inserting
// user-controlled data into the DOM via innerHTML.
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
