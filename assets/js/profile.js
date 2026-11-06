// Account screen: rename the member, show local progress, sign out, wipe data
const nameForm = document.getElementById('nameForm');
const editNameBtn = document.getElementById('editNameBtn');
const displayName = document.getElementById('displayName');
const saveNameBtn = document.getElementById('saveNameBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const progressCount = document.getElementById('progressCount');
const toast = document.getElementById('profileToast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

function refreshProgress() {
  if (!progressCount || !window.ContinuumStore) return;
  const summary = ContinuumStore.summary();
  const total = summary.completed + ContinuumStore.savedTitles().length;
  progressCount.textContent = total === 1 ? '1 title' : total + ' titles';
}

// The name lives in the session, so the header avatar and this row both update
function seedName(session) {
  if (!session || !displayName) return;
  displayName.value = session.name || '';
}

if (editNameBtn && nameForm) {
  editNameBtn.addEventListener('click', () => {
    nameForm.hidden = !nameForm.hidden;
    if (!nameForm.hidden) {
      displayName.focus();
      displayName.select();
    }
  });
}

if (nameForm) {
  nameForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveNameBtn.disabled = true;

    try {
      await ContinuumAuth.updateProfile({ name: displayName.value });
      nameForm.hidden = true;
      showToast('Name updated');
    } catch (error) {
      showToast(error.message || 'Could not save that name');
    } finally {
      saveNameBtn.disabled = false;
    }
  });
}

if (clearDataBtn) {
  clearDataBtn.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Clear the watch progress and saved titles stored on this device?'
    );
    if (!confirmed) return;

    ContinuumStore.clear();
    refreshProgress();
    showToast('Progress cleared on this device');
  });
}

if (window.ContinuumAuth) {
  seedName(ContinuumAuth.getSession());
  ContinuumAuth.onChange(seedName);
}

refreshProgress();
