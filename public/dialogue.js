/*
 * Emerald Dialogue Studio Client
 * Full featured editor for .string dialogue blocks in pokeemerald.
 */

(function(window) {
  "use strict";

  const CHECKLIST_KEY = "emerald-dialogue-studio/checklist-v2";

  class DialogueStudio {
    constructor() {
      this.dialogues = [];
      this.selected = null;
      this.originalText = "";
      this.checklist = this.loadChecklist();

      this.searchEl = document.getElementById("dialogue-search");
      this.scopeEl = document.getElementById("dialogue-scope");
      this.stateEl = document.getElementById("dialogue-state");
      this.listEl = document.getElementById("dialogue-list");
      this.textareaEl = document.getElementById("dialogue-text");
      this.previewEl = document.getElementById("dialogue-preview");
      this.statusEl = document.getElementById("dialogue-status");
      this.saveBtn = document.getElementById("dialogue-save-btn");
      this.completeCheck = document.getElementById("dialogue-complete-check");
    }

    async init() {
      this.bindEvents();
      await this.loadDialogues();
    }

    loadChecklist() {
      try {
        return JSON.parse(localStorage.getItem(CHECKLIST_KEY)) || {};
      } catch (e) {
        return {};
      }
    }

    persistChecklist() {
      try {
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(this.checklist));
      } catch (e) {}
    }

    isDone(item) {
      return Boolean(this.checklist[item.id]);
    }

    setDone(item, done) {
      if (done) this.checklist[item.id] = new Date().toISOString();
      else delete this.checklist[item.id];
      this.persistChecklist();
      this.updateProgress();
      this.renderList();
      if (this.selected?.id === item.id && this.completeCheck) {
        this.completeCheck.checked = done;
      }
    }

    async loadDialogues() {
      this.setStatus("Loading dialogue files from pokeemerald…", "");
      try {
        const res = await fetch("/api/dialogues");
        const data = await res.json();
        this.dialogues = data.dialogues || [];
        this.updateProgress();
        this.renderList();
        this.setStatus(`${this.dialogues.length.toLocaleString()} dialogue strings loaded`, "success");
      } catch (err) {
        this.setStatus(`Failed to load dialogues: ${err.message}`, "error");
      }
    }

    bindEvents() {
      if (this.searchEl) this.searchEl.addEventListener("input", () => this.renderList());
      if (this.scopeEl) this.scopeEl.addEventListener("change", () => this.renderList());
      if (this.stateEl) this.stateEl.addEventListener("change", () => this.renderList());

      if (this.textareaEl) {
        this.textareaEl.addEventListener("input", () => {
          this.updatePreview();
          this.updateCharCount();
        });
      }

      if (this.saveBtn) {
        this.saveBtn.addEventListener("click", () => this.saveCurrent());
      }

      if (this.completeCheck) {
        this.completeCheck.addEventListener("change", (e) => {
          if (this.selected) {
            this.setDone(this.selected, e.target.checked);
          }
        });
      }

      window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          const dialogueTab = document.getElementById("tab-dialogue");
          if (dialogueTab && dialogueTab.classList.contains("active")) {
            e.preventDefault();
            this.saveCurrent();
          }
        }
      });
    }

    visibleDialogues() {
      const needle = (this.searchEl?.value || "").trim().toLowerCase();
      const scopeVal = this.scopeEl?.value || "all";
      const stateVal = this.stateEl?.value || "all";

      return this.dialogues.filter(item => {
        const matchesScope = scopeVal === "all" ||
          (scopeVal === "story" ? item.chapterIndex < 12 : item.chapterIndex >= 12);

        const matchesState = stateVal === "all" ||
          (stateVal === "done" ? this.isDone(item) : !this.isDone(item));

        const haystack = `${item.file} ${item.label} ${item.mapName} ${item.chapter} ${item.text}`.toLowerCase();
        return matchesScope && matchesState && (!needle || haystack.includes(needle));
      });
    }

    chapterStats(chapter) {
      const entries = this.dialogues.filter(d => d.chapter === chapter);
      return {
        total: entries.length,
        done: entries.filter(d => this.isDone(d)).length,
      };
    }

    updateProgress() {
      const done = this.dialogues.filter(d => this.isDone(d)).length;
      const total = this.dialogues.length;
      const percent = total ? (done / total) * 100 : 0;

      const progressEl = document.getElementById("overall-progress-bar");
      const countEl = document.getElementById("overall-progress-count");

      if (progressEl) progressEl.style.width = `${percent}%`;
      if (countEl) countEl.textContent = `${done.toLocaleString()} / ${total.toLocaleString()} done (${percent.toFixed(1)}%)`;
    }

    renderList() {
      if (!this.listEl) return;
      const entries = this.visibleDialogues();

      const noteEl = document.getElementById("dialogue-filter-note");
      if (noteEl) {
        noteEl.textContent = `${entries.length.toLocaleString()} visible · ${this.dialogues.filter(d => this.isDone(d)).length} done`;
      }

      if (!entries.length) {
        this.listEl.innerHTML = `<p style="padding:1rem; color:var(--muted); font-size:0.8rem;">No dialogue matching current search/filters.</p>`;
        return;
      }

      this.listEl.innerHTML = "";
      let lastChapter = null;
      let chapterGroupEl = null;

      for (const item of entries) {
        if (item.chapter !== lastChapter) {
          lastChapter = item.chapter;
          const stats = this.chapterStats(item.chapter);
          const percent = stats.total ? (stats.done / stats.total) * 100 : 0;

          chapterGroupEl = document.createElement("div");
          chapterGroupEl.className = "chapter-group";
          chapterGroupEl.innerHTML = `
            <div class="chapter-header">
              <div class="chapter-title-line">
                <span>${this.escape(item.chapter)}</span>
                <span style="color:var(--muted); font-size:0.68rem;">${stats.done}/${stats.total}</span>
              </div>
              <div class="chapter-progress">
                <div class="chapter-progress-bar" style="width: ${percent}%;"></div>
              </div>
            </div>
          `;
          this.listEl.appendChild(chapterGroupEl);
        }

        const row = document.createElement("div");
        row.className = `dialogue-card-row${this.selected?.id === item.id ? " active" : ""}`;
        row.innerHTML = `
          <input type="checkbox" style="accent-color:var(--mint); margin-top:3px; cursor:pointer;" ${this.isDone(item) ? "checked" : ""}>
          <div style="min-width:0;">
            <div class="dialogue-card-title">#${item.sequence} · ${this.escape(item.label)}</div>
            <div class="dialogue-card-meta">${this.escape(item.mapName)} · L${item.startLine}</div>
            <div class="dialogue-card-snippet">${this.escape(item.text.replace(/\\[npl]/g, " ")) || "(empty)"}</div>
          </div>
        `;

        const check = row.querySelector("input[type=checkbox]");
        check.addEventListener("change", (e) => {
          this.setDone(item, e.target.checked);
        });

        row.addEventListener("click", (e) => {
          if (e.target.tagName !== "INPUT") {
            this.selectDialogue(item);
          }
        });

        chapterGroupEl.appendChild(row);
      }
    }

    selectDialogue(item) {
      this.selected = item;
      this.originalText = item.text;

      const titleEl = document.getElementById("editor-title-label");
      const fileEl = document.getElementById("editor-file-info");
      const emptyEl = document.getElementById("dialogue-empty-state");
      const formEl = document.getElementById("dialogue-form-stage");

      if (emptyEl) emptyEl.style.display = "none";
      if (formEl) formEl.style.display = "flex";

      if (titleEl) titleEl.textContent = item.label;
      if (fileEl) fileEl.textContent = `${item.file}:${item.startLine} (${item.chapter})`;

      if (this.textareaEl) this.textareaEl.value = item.text;
      if (this.completeCheck) this.completeCheck.checked = this.isDone(item);

      this.updatePreview();
      this.updateCharCount();
      this.setStatus("", "");

      // Highlight active row in sidebar
      document.querySelectorAll(".dialogue-card-row").forEach(el => {
        el.classList.remove("active");
      });
      const activeEl = document.querySelector(`.dialogue-card-row:hover, .dialogue-card-row.active`);
      if (activeEl) activeEl.classList.add("active");
    }

    updatePreview() {
      if (!this.previewEl || !this.textareaEl) return;
      const raw = this.textareaEl.value;

      // Colorize \p, \l, \n
      let html = this.escape(raw)
        .replace(/\\p/g, '<span class="gba-tag-badge">\\p (New Page)</span><hr style="border:0;border-top:1px dashed #3a4a6b;margin:8px 0;">')
        .replace(/\\l/g, '<span class="gba-tag-badge">\\l (Scroll)</span><br>')
        .replace(/\\n/g, '<span class="gba-tag-badge">\\n (Line)</span><br>');

      this.previewEl.innerHTML = html || `<span style="opacity:0.4;">(Empty text)</span>`;
    }

    updateCharCount() {
      const countEl = document.getElementById("dialogue-char-count");
      if (!countEl || !this.textareaEl) return;
      const count = this.textareaEl.value.length;
      countEl.textContent = `${count} chars`;
    }

    setStatus(msg, kind) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.className = `save-status-msg ${kind}`;
    }

    async saveCurrent() {
      if (!this.selected || !this.textareaEl) return;
      const newText = this.textareaEl.value;

      this.setStatus("Saving to disk…", "");
      if (this.saveBtn) this.saveBtn.disabled = true;

      try {
        const res = await fetch("/api/dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: this.selected.id,
            text: newText,
            sourceHash: this.selected.sourceHash
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Save failed");
        }

        // Update in memory
        this.selected.text = data.dialogue.text;
        this.selected.sourceHash = data.dialogue.sourceHash;
        this.originalText = this.selected.text;

        this.setStatus("Saved successfully to pokeemerald!", "success");
        this.renderList();
      } catch (err) {
        this.setStatus(`Error: ${err.message}`, "error");
      } finally {
        if (this.saveBtn) this.saveBtn.disabled = false;
      }
    }

    escape(str) {
      return String(str || "").replace(/[&<>"]/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
      }[c]));
    }
  }

  window.DialogueStudio = DialogueStudio;
})(window);
