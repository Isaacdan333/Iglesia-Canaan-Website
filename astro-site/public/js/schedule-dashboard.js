const authPanel = document.querySelector("[data-auth-panel]");
const dashboardApp = document.querySelector("[data-dashboard-app]");
const loginForm = document.querySelector("[data-login-form]");
const entryForm = document.querySelector("[data-entry-form]");
const entryList = document.querySelector("[data-entry-list]");
const loginStatus = document.querySelector("[data-login-status]");
const appStatus = document.querySelector("[data-app-status]");
const formStatus = document.querySelector("[data-form-status]");
const formTitle = document.querySelector("[data-form-title]");
const cancelEditButton = document.querySelector("[data-cancel-edit]");
let entries = [];

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function formatEntryDate(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatEntryTime(value) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`1970-01-01T${value}`));
}

function showDashboard() {
  authPanel.hidden = true;
  dashboardApp.hidden = false;
  loadEntries();
}

function showLogin() {
  authPanel.hidden = false;
  dashboardApp.hidden = true;
}

function resetEntryForm() {
  entryForm.reset();
  entryForm.elements.id.value = "";
  entryForm.elements.published.checked = true;
  formTitle.textContent = "Add schedule entry";
  cancelEditButton.hidden = true;
  setStatus(formStatus, "");
}

function populateEntryForm(entry) {
  Object.entries(entry).forEach(([key, value]) => {
    if (entryForm.elements[key]) entryForm.elements[key].value = value || "";
  });
  entryForm.elements.published.checked = entry.published;
  formTitle.textContent = "Edit schedule entry";
  cancelEditButton.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEntries() {
  entryList.innerHTML = "";
  if (!entries.length) {
    entryList.innerHTML = '<p class="schedule-status">No entries yet. Add the first service.</p>';
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "entry-item";
    item.innerHTML = `<div><span class="entry-date">${formatEntryDate(entry.service_date)}</span><h3></h3><p>${formatEntryTime(entry.start_time)} - ${formatEntryTime(entry.end_time)}${entry.location ? ` · ${entry.location}` : ""}</p><span class="entry-badge ${entry.published ? "is-published" : ""}">${entry.published ? "Published" : "Draft"}</span></div><div class="entry-actions"><button class="button text-button" type="button" data-edit="${entry.id}">Edit</button><button class="button danger-button" type="button" data-delete="${entry.id}">Delete</button></div>`;
    item.querySelector("h3").textContent = entry.title;
    entryList.append(item);
  });
}

async function loadEntries() {
  setStatus(appStatus, "Loading entries...");
  try {
    entries = await fetchStaffSchedule();
    renderEntries();
    setStatus(appStatus, "");
  } catch (error) {
    setStatus(appStatus, error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus(loginStatus, "Signing in...");
  try {
    await signInStaff(loginForm.elements.email.value, loginForm.elements.password.value);
    loginForm.reset();
    showDashboard();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  } finally {
    button.disabled = false;
  }
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const entry = Object.fromEntries(formData.entries());
  entry.published = formData.has("published");
  const button = entryForm.querySelector("[data-save-entry]");
  button.disabled = true;
  setStatus(formStatus, "Saving...");
  try {
    await saveScheduleEntry(entry);
    resetEntryForm();
    setStatus(appStatus, "Schedule entry saved.");
    await loadEntries();
  } catch (error) {
    setStatus(formStatus, error.message, true);
  } finally {
    button.disabled = false;
  }
});

entryList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) populateEntryForm(entries.find((entry) => entry.id === editButton.dataset.edit));
  if (deleteButton && window.confirm("Delete this schedule entry?")) {
    try {
      await deleteScheduleEntry(deleteButton.dataset.delete);
      await loadEntries();
      setStatus(appStatus, "Schedule entry deleted.");
    } catch (error) {
      setStatus(appStatus, error.message, true);
    }
  }
});

document.querySelector("[data-cancel-edit]").addEventListener("click", resetEntryForm);
document.querySelector("[data-sign-out]").addEventListener("click", async () => {
  await signOutStaff();
  showLogin();
});

(async function initializeDashboard() {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    if (data.session) showDashboard();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  }
})();
