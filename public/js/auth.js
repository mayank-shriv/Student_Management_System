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

// ── Google Sign-In ──
// Initialize Google Identity Services when the GSI script has loaded.
function initGoogleSignIn() {
  const googleBtnContainer = document.getElementById('google-signin-btn');
  if (!googleBtnContainer || typeof google === 'undefined') return;

  google.accounts.id.initialize({
    client_id: window.__GOOGLE_CLIENT_ID__,
    callback: handleGoogleCredential,
  });

  google.accounts.id.renderButton(googleBtnContainer, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    width: '100%',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'center',
  });
}

async function handleGoogleCredential(response) {
  try {
    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });

    showToast('Signed in with Google!', 'success');

    setTimeout(() => {
      if (data.data.user.role === 'faculty') {
        window.location.href = '/faculty';
      } else {
        window.location.href = '/student';
      }
    }, 500);
  } catch (error) {
    showAlert(error.message);
  }
}

// Fetch the Google Client ID from the server and init GSI.
(async function loadGoogleClientId() {
  try {
    const res = await fetch('/api/auth/google-client-id');
    const data = await res.json();
    if (data.clientId) {
      window.__GOOGLE_CLIENT_ID__ = data.clientId;
      // Wait for GSI script to load, then initialize.
      if (typeof google !== 'undefined') {
        initGoogleSignIn();
      } else {
        window.addEventListener('load', initGoogleSignIn);
      }
    }
  } catch (err) {
    // Google sign-in not available, that's ok.
  }
})();

const roleSelect = document.getElementById('role');
if (roleSelect) {
  roleSelect.addEventListener('change', () => {
    const studentFields = document.getElementById('student-fields');
    const facultyFields = document.getElementById('faculty-fields');

    if (roleSelect.value === 'student') {
      if (studentFields) studentFields.classList.add('visible');
      if (facultyFields) facultyFields.classList.remove('visible');
      document.getElementById('enrollment_no').required = true;
    } else if (roleSelect.value === 'faculty') {
      if (studentFields) studentFields.classList.remove('visible');
      if (facultyFields) facultyFields.classList.add('visible');
      document.getElementById('enrollment_no').required = false;
    } else {
      if (studentFields) studentFields.classList.remove('visible');
      if (facultyFields) facultyFields.classList.remove('visible');
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

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      showAlert('Passwords do not match.');
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }

    const body = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      password,
      role: document.getElementById('role').value,
    };

    if (body.role === 'student') {
      body.enrollment_no = document.getElementById('enrollment_no').value.trim();
      body.department = document.getElementById('department').value.trim();
    }

    if (body.role === 'faculty') {
      const inviteInput = document.getElementById('invite_code');
      body.invite_code = inviteInput ? inviteInput.value.trim() : '';
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
