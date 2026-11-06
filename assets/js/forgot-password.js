// Forgot password -> ContinuumAuth.requestPasswordReset
// The response is deliberately vague: telling the visitor whether an address
// exists would let anyone probe the member list.
const forgotForm = document.getElementById('forgotForm');
const forgotError = document.getElementById('forgotError');
const forgotSubmit = document.getElementById('forgotSubmit');
const forgotSent = document.getElementById('forgotSent');
const demoResetWrap = document.getElementById('demoResetWrap');
const emailInput = document.getElementById('email');
const toast = document.getElementById('forgotToast');

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
  forgotError.textContent = message;
  forgotError.classList.add('show');
  if (emailInput) emailInput.classList.toggle('invalid', field === 'email');
}

if (forgotForm) {
  forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    forgotError.classList.remove('show');
    emailInput.classList.remove('invalid');

    forgotSubmit.disabled = true;
    forgotSubmit.classList.add('is-busy');

    try {
      const result = await ContinuumAuth.requestPasswordReset(emailInput.value);

      forgotForm.hidden = true;
      forgotSent.hidden = false;
      showToast('Reset link requested');

      // Demo has no mailbox, so it hands over the reset screen instead
      if (result && result.demoToken && demoResetWrap) {
        demoResetWrap.hidden = false;
      }
    } catch (error) {
      showError(error.message || 'That did not work. Try again.', error.field);
      forgotSubmit.disabled = false;
      forgotSubmit.classList.remove('is-busy');
    }
  });
}
