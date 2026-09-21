/**
 * Bible Passage Lookup Client
 * Iglesia Canaan
 */

(function () {
  const form = document.querySelector("[data-bible-form]");
  const input = document.querySelector("[data-bible-input]");
  const searchBtn = document.querySelector("[data-bible-submit]");
  const statusEl = document.querySelector("[data-bible-status]");
  const resultCard = document.querySelector("[data-bible-result]");
  const refDisplay = document.querySelector("[data-result-ref]");
  const versionDisplay = document.querySelector("[data-result-version]");
  const textDisplay = document.querySelector("[data-result-text]");
  const metaDisplay = document.querySelector("[data-result-meta]");
  const copyrightDisplay = document.querySelector("[data-result-copyright]");
  const exampleButtons = document.querySelectorAll("[data-example-ref]");

  // Determine backend endpoint: local proxy or Supabase Edge function
  function getApiEndpoint(reference) {
    // If Supabase edge function is enabled:
    if (window.USE_SUPABASE_EDGE_FUNCTION && window.SUPABASE_URL) {
      return `${window.SUPABASE_URL}/functions/v1/bible-passage?reference=${encodeURIComponent(reference)}`;
    }
    // Local / standard server endpoint
    return `/api/bible/passage?reference=${encodeURIComponent(reference)}`;
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = !message;
  }

  function clearResult() {
    if (resultCard) {
      resultCard.hidden = true;
    }
  }

  async function lookupPassage(referenceQuery) {
    const trimmed = (referenceQuery || "").trim();
    if (!trimmed) {
      setStatus("Please enter a Bible reference (e.g. John 3:16).", true);
      input?.focus();
      return;
    }

    clearResult();
    setStatus("Looking up Scripture...", false);
    if (searchBtn) searchBtn.disabled = true;

    try {
      const endpoint = getApiEndpoint(trimmed);
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: Failed to fetch Scripture.`);
      }

      // Display results
      setStatus("");
      renderPassage(data);
    } catch (err) {
      setStatus(err.message || "Unable to load the requested passage. Please try again.", true);
    } finally {
      if (searchBtn) searchBtn.disabled = false;
    }
  }

  function renderPassage(data) {
    if (!resultCard) return;

    if (refDisplay) refDisplay.textContent = data.reference;
    if (versionDisplay) versionDisplay.textContent = data.version || "King James Version";
    if (textDisplay) textDisplay.textContent = data.text;

    if (metaDisplay) {
      metaDisplay.innerHTML = `
        <span class="bible-tag">Book: ${data.book}</span>
        <span class="bible-tag">Chapter: ${data.chapter}</span>
        ${data.verse ? `<span class="bible-tag">Verse: ${data.verse}</span>` : ""}
      `;
    }

    if (copyrightDisplay) {
      copyrightDisplay.textContent = data.copyright || "";
      copyrightDisplay.hidden = !data.copyright;
    }

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      lookupPassage(input.value);
    });
  }

  exampleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const ref = this.dataset.exampleRef;
      if (input) input.value = ref;
      lookupPassage(ref);
    });
  });
})();
