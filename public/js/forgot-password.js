// ── Forgot Password Page Logic ──
// Depends on common.js being loaded first.

const forgotForm = document.getElementById('forgot-password-form');

if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const btn = document.getElementById('forgot-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const data = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
        }),
      });

      // Switch to success view.
      document.getElementById('step-email').classList.add('hidden');
      document.getElementById('step-success').classList.remove('hidden');

      if (data.emailSent) {
        // Email was actually sent — show the "check your inbox" message.
        showToast('Reset link sent to your email!', 'success');
      } else if (data.resetToken) {
        // SMTP not configured — show the token directly (dev fallback).
        const subtitle = document.getElementById('success-subtitle');
        if (subtitle) {
          subtitle.textContent = 'SMTP is not configured. Here is your reset token for development:';
        }

        const tokenDisplay = document.getElementById('token-display');
        const tokenValue = document.getElementById('reset-token-value');
        const resetLink = document.getElementById('reset-link');

        tokenDisplay.classList.remove('hidden');
        tokenValue.textContent = data.resetToken;
        resetLink.href = data.resetUrl || `/reset-password?token=${data.resetToken}`;

        showToast('Reset token generated (dev mode)', 'success');
      } else {
        // Generic success (no email sent, no token — user may not exist).
        showToast('If that email exists, a reset link has been sent.', 'success');
      }
    } catch (error) {
      showAlert(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    }
  });
}

// Copy token to clipboard.
const copyBtn = document.getElementById('copy-token-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const tokenValue = document.getElementById('reset-token-value')?.textContent;
    if (tokenValue) {
      navigator.clipboard.writeText(tokenValue).then(() => {
        showToast('Token copied to clipboard!', 'success');
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 2000);
      }).catch(() => {
        showToast('Failed to copy token', 'error');
      });
    }
  });
}
