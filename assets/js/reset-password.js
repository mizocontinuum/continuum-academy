// Reset password -> ContinuumAuth.updatePassword
// In Supabase mode the recovery token arrives in the URL and the client turns it
// into a short-lived session, so the form only has to write the new secret.
const resetForm = document.getElementById('resetForm');
const resetError = document.getElementById('resetError');
const resetSubmit = document.getElementById('resetSubmit');
const resetExpired = document.getElementById('resetExpired');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm');
const toast = document.getElementById('resetToast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function showError(message, field) {
  resetError.textContent = message;
  resetError.classList.add('show');
  passwordInput.classList.toggle('invalid', field === 'password');
  confirmInput.classList.toggle('invalid', field === 'confirm');
}

// A real recovery link always carries a token (or has already become a session).
// Without either, the form would be a dead end, so say so instead.
const hasToken = /(?:^|[#&?])access_token=|(?:^|[?&])token=/.test(
  window.location.search + window.location.hash
);

if (!ContinuumAuth.isDemo() && !hasToken && !ContinuumAuth.getSession()) {
  resetForm.hidden = true;
  resetExpired.hidden = false;
}

if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetError.classList.remove('show');
    passwordInput.classList.remove('invalid');
    confirmInput.classList.remove('invalid');

    if (passwordInput.value !== confirmInput.value) {
      showError("The two passwords don't match.", 'confirm');
      return;
    }

    resetSubmit.disabled = true;
    resetSubmit.classList.add('is-busy');

    try {
      await ContinuumAuth.updatePassword(passwordInput.value, confirmInput.value);
      showToast('Password updated — sign in with the new one');
      setTimeout(() => {
        window.location.replace('../login/?message=password-updated');
      }, 800);
    } catch (error) {
      showError(error.message || 'That did not work. Try again.', error.field);
      resetSubmit.disabled = false;
      resetSubmit.classList.remove('is-busy');
    }
  });
}
