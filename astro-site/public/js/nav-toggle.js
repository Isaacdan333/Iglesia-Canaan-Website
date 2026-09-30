const navToggle = document.querySelector("[data-nav-toggle]");
const navClose = document.querySelector("[data-nav-close]");
const nav = document.querySelector("#main-navigation");
const navOverlay = document.querySelector("[data-nav-overlay]");

if (navToggle && navClose && nav && navOverlay) {
  const mobileQuery = window.matchMedia("(max-width: 820px)");

  const setNavOpen = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);
    navOverlay.classList.toggle("is-visible", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);

    if (isOpen) {
      navClose.focus();
    } else {
      navToggle.focus();
    }
  };

  navToggle.addEventListener("click", () => setNavOpen(true));
  navClose.addEventListener("click", () => setNavOpen(false));
  navOverlay.addEventListener("click", () => setNavOpen(false));

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setNavOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setNavOpen(false);
    }
  });

  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      setNavOpen(false);
    }
  });
}