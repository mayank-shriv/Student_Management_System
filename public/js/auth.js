// ── Utility Functions ──

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

// ── Check if already logged in ──
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const role = data.data.user.role;
      if (role === 'faculty') {
        window.location.href = '/faculty';
      } else {
        window.location.href = '/student';
      }
    }
  } catch (e) {
    // Not logged in, stay on page
  }
}

// Run auth check on login/register pages
if (window.location.pathname === '/' || window.location.pathname === '/login' || window.location.pathname === '/register') {
  checkAuth();
}

// ── Role selector: show/hide student fields ──
const roleSelect = document.getElementById('role');
if (roleSelect) {
  roleSelect.addEventListener('change', () => {
    const studentFields = document.getElementById('student-fields');
    if (studentFields) {
      if (roleSelect.value === 'student') {
        studentFields.classList.add('visible');
        document.getElementById('enrollment_no').required = true;
      } else {
        studentFields.classList.remove('visible');
        document.getElementById('enrollment_no').required = false;
      }
    }
  });
}

// ── Login Form ──
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
          password: document.getElementById('password').value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.errors
          ? data.errors.map((e) => e.message).join(', ')
          : data.message;
        throw new Error(msg);
      }

      showToast('Login successful!', 'success');

      // Redirect based on role
      setTimeout(() => {
        if (data.data.user.role === 'faculty') {
          window.location.href = '/faculty';
        } else {
          window.location.href = '/student';
        }
      }, 500);
    } catch (error) {
      showAlert(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

// ── Register Form ──
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    const body = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      role: document.getElementById('role').value,
    };

    if (body.role === 'student') {
      body.enrollment_no = document.getElementById('enrollment_no').value.trim();
      body.department = document.getElementById('department').value.trim();
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.errors
          ? data.errors.map((e) => e.message).join(', ')
          : data.message;
        throw new Error(msg);
      }

      showToast('Account created!', 'success');

      setTimeout(() => {
        if (data.data.user.role === 'faculty') {
          window.location.href = '/faculty';
        } else {
          window.location.href = '/student';
        }
      }, 500);
    } catch (error) {
      showAlert(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}
