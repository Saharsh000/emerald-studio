/*
 * Main Studio Orchestrator
 * Controls tab switching, global keyboard shortcuts, and backend status sync.
 */

(function(window) {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Subsystems
    const mapTester = new window.EmeraldMapTester();
    await mapTester.init();

    const dialogueStudio = new window.DialogueStudio();
    await dialogueStudio.init();

    // Tab Switching
    const tabBtns = document.querySelectorAll(".tab-btn");
    const viewports = {
      "map": document.getElementById("tab-map"),
      "dialogue": document.getElementById("tab-dialogue"),
    };

    function switchTab(tabName) {
      tabBtns.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
      });

      Object.entries(viewports).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle("active", key === tabName);
      });

      if (tabName === "map" && mapTester.map) {
        setTimeout(() => {
          mapTester.map.invalidateSize();
        }, 50);
      }
    }

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Hotkeys 1 and 2 for quick tab switching
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "1") {
        switchTab("map");
      } else if (e.key === "2") {
        switchTab("dialogue");
      }
    });

    // Fetch backend status
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      const statusPill = document.getElementById("repo-path-pill");
      if (statusPill && data.emeraldDir) {
        statusPill.textContent = data.emeraldDir.split("/").slice(-2).join("/");
        statusPill.title = `Connected to: ${data.emeraldDir}`;
      }
    } catch (err) {
      console.warn("Could not fetch backend status:", err);
    }
  });
})(window);
