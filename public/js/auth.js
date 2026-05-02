// ── Auth Page Logic (Login & Register) ──
// Depends on common.js being loaded first.

// Only run the auto-redirect on login-related pages; skip password reset
// pages so an authenticated user can still use the reset flow (Fix #10).
const authRedirectPaths = ['/', '/login', '/register'];

async function checkAuth() {
  try {
    const data = await apiRequest('/api/auth/me');
    const role = data.data.user.role;

    if (role === 'faculty') {
      window.location.href = '/faculty';
    } else {
      window.location.href = '/student';
    }
  } catch (error) {
    // Not logged in, stay on page
  }
}

if (authRedirectPaths.includes(window.location.pathname)) {
  checkAuth();
}

const roleSelect = document.getElementById('role');
if (roleSelect) {
  roleSelect.addEventListener('change', () => {
    const studentFields = document.getElementById('student-fields');
    if (!studentFields) return;

    if (roleSelect.value === 'student') {
      studentFields.classList.add('visible');
      document.getElementById('enrollment_no').required = true;
    } else {
      studentFields.classList.remove('visible');
      document.getElementById('enrollment_no').required = false;
    }
  });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
          password: document.getElementById('password').value,
        }),
      });

      showToast('Login successful!', 'success');

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
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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
