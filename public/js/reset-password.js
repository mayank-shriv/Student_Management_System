// ── Reset Password Page Logic ──

(function () {
  // Extract the token from the URL query string.
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const stepReset = document.getElementById('step-reset');
  const stepSuccess = document.getElementById('step-success');
  const stepError = document.getElementById('step-error');

  // If no token is present, show the error state.
  if (!token) {
    stepReset.classList.add('hidden');
    stepError.classList.remove('hidden');
    return;
  }

  // Password strength meter.
  const passwordInput = document.getElementById('password');
  const strengthFill = document.getElementById('strength-fill');
  const strengthText = document.getElementById('strength-text');

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      let label = '';

      if (val.length >= 6) score++;
      if (val.length >= 10) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[^a-zA-Z0-9]/.test(val)) score++;

      const percentage = (score / 5) * 100;

      strengthFill.style.width = percentage + '%';

      if (score <= 1) {
        label = 'Weak';
        strengthFill.className = 'progress-fill danger';
      } else if (score <= 3) {
        label = 'Fair';
        strengthFill.className = 'progress-fill warning';
      } else {
        label = 'Strong';
        strengthFill.className = 'progress-fill success';
      }

      strengthText.textContent = val.length > 0 ? label : '';
    });
  }

  // Handle form submission.
  const resetForm = document.getElementById('reset-password-form');

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (password !== confirmPassword) {
        showAlert('Passwords do not match.');
        return;
      }

      if (password.length < 6) {
        showAlert('Password must be at least 6 characters.');
        return;
      }

      if (!/\d/.test(password)) {
        showAlert('Password must contain a number.');
        return;
      }

      const btn = document.getElementById('reset-btn');
      btn.disabled = true;
      btn.textContent = 'Resetting...';

      try {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });

        // Switch to success view.
        stepReset.classList.add('hidden');
        stepSuccess.classList.remove('hidden');

        showToast('Password reset successfully!', 'success');
      } catch (error) {
        showAlert(error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }
    });
  }
})();
