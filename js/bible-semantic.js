/**
 * Bible Semantic (Topic) Search Client
 * Iglesia Canaan
 */

(function () {
  const tabButtons = document.querySelectorAll("[data-bible-mode-tab]");
  const panels = document.querySelectorAll("[data-bible-mode-panel]");

  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const mode = this.dataset.bibleModeTab;

      tabButtons.forEach((btn) => {
        const isActive = btn === this;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.bibleModePanel !== mode;
      });
    });
  });

  const form = document.querySelector("[data-semantic-form]");
  const input = document.querySelector("[data-semantic-input]");
  const searchBtn = document.querySelector("[data-semantic-submit]");
  const statusEl = document.querySelector("[data-semantic-status]");
  const resultsEl = document.querySelector("[data-semantic-results]");
  const exampleButtons = document.querySelectorAll("[data-semantic-example]");

  // Determine backend endpoint: local proxy or Supabase Edge function
  function getApiEndpoint() {
    if (window.USE_SUPABASE_EDGE_FUNCTION && window.SUPABASE_URL) {
      return `${window.SUPABASE_URL}/functions/v1/bible-semantic-search`;
    }
    return "/api/bible/semantic-search";
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = !message;
  }

  function clearResults() {
    if (!resultsEl) return;
    resultsEl.innerHTML = "";
    resultsEl.hidden = true;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderResults(results) {
    if (!resultsEl) return;

    resultsEl.innerHTML = results
      .map((verse) => {
        const reference = escapeHtml(verse.reference || `${verse.book} ${verse.chapter}:${verse.verse}`);
        const similarityPercent =
          typeof verse.similarity === "number" ? `${Math.round(verse.similarity * 100)}% match` : "";

        return `
          <article class="bible-semantic-card">
            <div class="bible-semantic-card-header">
              <h3 class="bible-semantic-ref">${reference}</h3>
              ${similarityPercent ? `<span class="bible-version-badge">${similarityPercent}</span>` : ""}
            </div>
            <blockquote class="bible-semantic-text">${escapeHtml(verse.text)}</blockquote>
          </article>
        `;
      })
      .join("");

    resultsEl.hidden = false;
    resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function searchTopic(queryText) {
    const trimmed = (queryText || "").trim();
    if (!trimmed) {
      setStatus("Please enter a topic or phrase to search for.", true);
      input?.focus();
      return;
    }

    clearResults();
    setStatus("Searching Scripture...", false);
    if (searchBtn) searchBtn.disabled = true;

    try {
      const endpoint = getApiEndpoint();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: trimmed })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: Failed to search Scripture.`);
      }

      if (!Array.isArray(data) || data.length === 0) {
        setStatus("No matching passages found. Try a different topic or phrasing.", false);
        return;
      }

      setStatus("");
      renderResults(data);
    } catch (err) {
      setStatus(err.message || "Unable to search Scripture right now. Please try again.", true);
    } finally {
      if (searchBtn) searchBtn.disabled = false;
    }
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      searchTopic(input.value);
    });
  }

  exampleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const topic = this.dataset.semanticExample;
      if (input) input.value = topic;
      searchTopic(topic);
    });
  });
})();
