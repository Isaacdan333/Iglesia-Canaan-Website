const churchSchedule = {
  month: "September 2026",
  services: [
    {
      date: "Thursday, September 3",
      time: "No service due to Vigilia",
      moderator: "None",
      worshipLeader: "None",
      tiempos: ["None"],
      preacher: "No service"
    },
    {
      date: "Sunday, September 6",
      time: "11:00 AM - 1:00 PM",
      highlight: "Santa Cena",
      moderator: "Maria Isabel Pineda",
      worshipLeader: "Canaan Group",
      tiempos: ["To be assigned"],
      preacher: "Pablo Pineda"
    },
    {
      date: "Thursday, September 10",
      time: "7:00 PM - 9:00 PM",
      moderator: "Maria Isabel Pineda",
      worshipLeader: "Edia Rivera",
      tiempos: ["Sarai Martinez", "Joel Yax"],
      preacher: "Marina Martinez"
    },
    {
      date: "Sunday, September 13",
      time: "11:00 AM - 1:00 PM",
      moderator: "Pablo Pineda",
      worshipLeader: "Canaan Group",
      tiempos: ["To be assigned"],
      preacher: "Sofonias Gonzalez"
    },
    {
      date: "Thursday, September 17",
      time: "7:00 PM - 9:00 PM",
      moderator: "Rebeca Mendez",
      worshipLeader: "Lorenzo Martinez",
      tiempos: ["Magda Quintana"],
      preacher: "Willie Velasquez"
    },
    {
      date: "Sunday, September 20",
      time: "11:00 AM - 1:00 PM",
      moderator: "Pablo Pineda",
      worshipLeader: "Canaan Group",
      tiempos: ["To be assigned"],
      preacher: "Eric Perez"
    },
    {
      date: "Thursday, September 24",
      time: "7:00 PM - 9:00 PM",
      moderator: "Debora Martinez",
      worshipLeader: "David Martinez",
      tiempos: ["Luis Quintana"],
      preacher: "Olegario Barrios"
    },
    {
      date: "Sunday, September 27",
      time: "11:00 AM - 1:00 PM",
      moderator: "Pastor Pablo Pineda",
      worshipLeader: "Canaan Group",
      tiempos: ["To be assigned"],
      preacher: "Guillermo Roble"
    }
  ]
};

function createScheduleField(label, value) {
  const item = document.createElement("div");
  item.className = "schedule-field";

  const fieldLabel = document.createElement("dt");
  fieldLabel.textContent = label;
  const fieldValue = document.createElement("dd");
  fieldValue.textContent = value;

  item.append(fieldLabel, fieldValue);
  return item;
}

function createScheduleCard(service) {
  const article = document.createElement("article");
  article.className = `schedule-card reveal-item${service.highlight ? " schedule-card-featured" : ""}`;

  const heading = document.createElement("div");
  heading.className = "schedule-card-heading";

  const day = document.createElement("p");
  day.className = "schedule-day";
  day.textContent = service.date.split(",")[0];

  const dateTitle = document.createElement("h2");
  dateTitle.textContent = service.date.substring(service.date.indexOf(",") + 2);

  const time = document.createElement("p");
  time.className = "schedule-time";
  time.textContent = service.time;

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
    createScheduleField("Moderator", service.moderator),
    createScheduleField("Worship leader", service.worshipLeader)
  );

  if (service.date.startsWith("Thursday")) {
    details.append(createScheduleField("Tiempos", service.tiempos.join(" / ")));
  }

  details.append(createScheduleField("Preacher", service.preacher));

  article.append(heading, details);
  return article;
}

function renderSchedule() {
  const schedule = document.querySelector("[data-schedule]");
  if (!schedule) return;

  schedule.querySelector("[data-schedule-month]").textContent = churchSchedule.month;
  const list = schedule.querySelector("[data-schedule-list]");
  churchSchedule.services.forEach((service) => list.append(createScheduleCard(service)));
}

renderSchedule();
