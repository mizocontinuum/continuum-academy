// Sign-in form -> ContinuumAuth.signIn, then back to the page that asked for it
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const toast = document.getElementById('loginToast');
const loginError = document.getElementById('loginError');
const submitBtn = document.querySelector('.btn-submit');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

function showError(message, field) {
  if (!loginError) return;
  loginError.textContent = message;
  loginError.classList.add('show');
  emailInput.classList.toggle('invalid', field === 'email');
  passwordInput.classList.toggle('invalid', field === 'password');
}

function clearError() {
  if (!loginError) return;
  loginError.classList.remove('show');
  emailInput.classList.remove('invalid');
  passwordInput.classList.remove('invalid');
}

// The guard sends signed-out visitors here with ?next=/library/ etc.
// safeNext() rejects anything pointing at another origin.
function continueToDestination() {
  const requested = new URLSearchParams(window.location.search).get('next');
  window.location.replace(ContinuumAuth.safeNext(requested) || ContinuumAuth.config.homePath);
}

// Already signed in? The form is noise, so move straight into the app.
if (ContinuumAuth.getSession()) {
  continueToDestination();
} else if (new URLSearchParams(window.location.search).get('message') === 'password-updated') {
  showToast('Password updated — sign in with the new one');
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    submitBtn.disabled = true;
    submitBtn.classList.add('is-busy');
    submitBtn.querySelector('span').textContent = 'Signing in…';

    try {
      await ContinuumAuth.signIn(emailInput.value, passwordInput.value);
      showToast('Signed in — opening your cockpit');

      // Short beat so the toast is legible before the page swaps
      setTimeout(continueToDestination, 550);
    } catch (error) {
      showError(error.message || 'That did not work. Try again.', error.field);
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-busy');
      submitBtn.querySelector('span').textContent = 'Sign In';
    }
  });
}
