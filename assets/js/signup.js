// Sign-up form -> ContinuumAuth.signUp, then straight into the app
const signupForm = document.getElementById('signupForm');
const signupError = document.getElementById('signupError');
const signupSubmit = document.getElementById('signupSubmit');
const toast = document.getElementById('signupToast');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// One error line under the form, and a red ring on the field that caused it
function showError(message, field) {
  signupError.textContent = message;
  signupError.classList.add('show');

  [nameInput, emailInput, passwordInput, confirmInput].forEach((input) => {
    if (!input) return;
    input.classList.toggle('invalid', input.id === field);
  });
}

function clearError() {
  signupError.classList.remove('show');
  [nameInput, emailInput, passwordInput, confirmInput].forEach((input) => {
    if (input) input.classList.remove('invalid');
  });
}

function setBusy(isBusy) {
  signupSubmit.disabled = isBusy;
  signupSubmit.classList.toggle('is-busy', isBusy);
  signupSubmit.querySelector('span').textContent = isBusy ? 'Creating…' : 'Create Account';
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const values = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      confirm: confirmInput.value
    };

    if (values.password !== values.confirm) {
      showError("The two passwords don't match.", 'confirm');
      return;
    }

    setBusy(true);
    try {
      const result = await ContinuumAuth.signUp(values);

      // Supabase with email confirmation on: no session until the link is opened
      if (result && result.pending) {
        signupForm.reset();
        showToast('Check your inbox to confirm your email');
        showError('Account created. Open the confirmation link we sent to ' + result.email + '.', 'form');
        return;
      }

      showToast('Account created — welcome to the cockpit');
      setTimeout(() => {
        window.location.replace(ContinuumAuth.config.homePath);
      }, 700);
    } catch (error) {
      showError(error.message || 'That did not work. Try again.', error.field);
      setBusy(false);
    }
  });
}
