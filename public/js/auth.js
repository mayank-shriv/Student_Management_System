const authRedirectPaths = ['/', '/login', '/register'];

let isRedirecting = false;

async function checkAuth() {
  try {
    const data = await apiRequest('/api/auth/me');
    const role = data.data.user.role;

    isRedirecting = true;
    if (role === 'faculty') {
      window.location.href = '/faculty';
    } else {
      window.location.href = '/student';
    }
  } catch (error) {
  }
}

if (authRedirectPaths.includes(window.location.pathname)) {
  checkAuth();
}

function initGoogleSignIn() {
  if (isRedirecting) return;

  const googleBtnContainer = document.getElementById('google-signin-btn');
  if (!googleBtnContainer) return;
  if (typeof google === 'undefined' || !google.accounts) return;
  if (!window.__GOOGLE_CLIENT_ID__) return;

  try {
    google.accounts.id.initialize({
      client_id: window.__GOOGLE_CLIENT_ID__,
      callback: handleGoogleCredential,
    });

    google.accounts.id.renderButton(googleBtnContainer, {
      type: 'standard',
      theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'outline' : 'filled_black',
      size: 'large',
      width: googleBtnContainer.offsetWidth || 380,
      text: 'signin_with',
      shape: 'pill',
      logo_alignment: 'center',
    });
  } catch (err) {
    console.error('[GSI] Failed to initialize Google Sign-In:', err);
  }
}

async function handleGoogleCredential(response) {
  try {
    const body = { credential: response.credential };

    const roleSelect = document.getElementById('role');
    if (roleSelect && roleSelect.value) {
      body.role = roleSelect.value;

      if (body.role === 'faculty') {
        const inviteInput = document.getElementById('invite_code');
        body.invite_code = inviteInput ? inviteInput.value.trim() : '';
      }

      if (body.role === 'student') {
        const enrollInput = document.getElementById('enrollment_no');
        const deptInput = document.getElementById('department');
        const enrollValue = enrollInput ? enrollInput.value.trim() : '';

        if (!enrollValue) {
          showAlert('Please enter your enrollment number before signing up with Google.');
          return;
        }

        body.enrollment_no = enrollValue;
        body.department = deptInput ? deptInput.value.trim() : '';
      }
    }

    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    showToast('Signed in with Google!', 'success');

    isRedirecting = true;
    setTimeout(() => {
      if (data.data.user.role === 'faculty') {
        window.location.href = '/faculty';
      } else {
        window.location.href = '/student';
      }
    }, 500);
  } catch (error) {
    const msg = error.message || '';
    // If user doesn't exist yet, redirect to register page
    if (msg.includes('register') || msg.includes('Enrollment number is required')) {
      showToast('Please register first to create your account.', 'warning');
      setTimeout(() => {
        window.location.href = '/register';
      }, 1500);
      return;
    }
    showAlert(msg);
  }
}

function waitForGSIAndInit() {
  if (isRedirecting) return;
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleSignIn();
    return;
  }
  const poll = setInterval(() => {
    if (isRedirecting) { clearInterval(poll); return; }
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(poll);
      initGoogleSignIn();
    }
  }, 200);
  setTimeout(() => clearInterval(poll), 10000);
}

(async function loadGoogleClientId() {
  try {
    const res = await fetch('/api/auth/google-client-id');
    const data = await res.json();
    if (data.clientId) {
      window.__GOOGLE_CLIENT_ID__ = data.clientId;

      if (document.readyState === 'complete') {
        waitForGSIAndInit();
      } else {
        window.addEventListener('load', waitForGSIAndInit);
      }
    }
  } catch (err) {
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
