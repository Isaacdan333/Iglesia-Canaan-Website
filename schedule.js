function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`1970-01-01T${value}`));
}

function createScheduleField(label, value) {
  const item = document.createElement("div");
  item.className = "schedule-field";
  const fieldLabel = document.createElement("dt");
  fieldLabel.textContent = label;
  const fieldValue = document.createElement("dd");
  fieldValue.textContent = value || "To be assigned";
  item.append(fieldLabel, fieldValue);
  return item;
}

function createScheduleCard(service) {
  const date = new Date(`${service.service_date}T12:00:00Z`);
  const article = document.createElement("article");
  article.className = `schedule-card${service.highlight ? " schedule-card-featured" : ""}`;
  const heading = document.createElement("div");
  heading.className = "schedule-card-heading";
  const day = document.createElement("p");
  day.className = "schedule-day";
  day.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  const dateTitle = document.createElement("h2");
  dateTitle.textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const time = document.createElement("p");
  time.className = "schedule-time";
  time.textContent = `${formatTime(service.start_time)} - ${formatTime(service.end_time)}`;
  heading.append(day, dateTitle, time);
  if (service.highlight) {
    const highlight = document.createElement("p");
    highlight.className = "schedule-highlight";
    highlight.textContent = service.highlight;
    heading.append(highlight);
  }

  const details = document.createElement("dl");
  details.className = "schedule-details";
  details.append(
    createScheduleField("Service", service.title),
    createScheduleField("Location", service.location),
    createScheduleField("Moderator", service.moderator),
    createScheduleField("Worship leader", service.worship_leader),
    createScheduleField("Tiempos", service.tiempos),
    createScheduleField("Preacher", service.preacher)
  );
  if (service.notes) details.append(createScheduleField("Notes", service.notes));
  article.append(heading, details);
  return article;
}

async function renderSchedule() {
  const schedule = document.querySelector("[data-schedule]");
  if (!schedule) return;
  const list = schedule.querySelector("[data-schedule-list]");
  const month = schedule.querySelector("[data-schedule-month]");
  list.innerHTML = '<p class="schedule-status">Loading the latest schedule...</p>';
  try {
    const services = await fetchPublishedSchedule();
    list.innerHTML = "";
    month.textContent = "Upcoming schedule";
    if (!services.length) {
      list.innerHTML = '<p class="schedule-status">No schedule entries have been published yet.</p>';
      return;
    }
    services.forEach((service) => list.append(createScheduleCard(service)));
  } catch (error) {
    list.innerHTML = `<p class="schedule-status schedule-status-error">${error.message}</p>`;
    month.textContent = "Schedule unavailable";
  }
}

renderSchedule();