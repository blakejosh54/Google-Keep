class Note {
  constructor(id, title, text, status = "notes", color = "#ffffff", order = 0) {
    this.id = id;
    this.title = title;
    this.text = text;
    this.status = status;
    this.color = color;
    this.order = order;
  }
}

class App {
  constructor() {
    const storedNotes = JSON.parse(localStorage.getItem("notes")) || [];
    this.notes = storedNotes.map(
      (note) =>
        new Note(
          note.id,
          note.title,
          note.text,
          note.status || "notes",
          note.color || "#ffffff",
          typeof note.order === "number" ? note.order : 0,
        ),
    );
    this.selectedNoteId = "";
    this.sidebarPinned = false;
    this.currentView = document.body.dataset.page || "notes";

    this.$activeForm = document.querySelector(".active-form");
    this.$inactiveForm = document.querySelector(".inactive-form");
    this.$menuBtn = document.querySelector("#menu-btn");
    this.$noteTitle = document.querySelector("#note-title");
    this.$noteText = document.querySelector("#note-text");
    this.$notes = document.querySelector(".notes");
    this.$form = document.querySelector("#form");
    this.$modal = document.querySelector(".modal");
    this.$modalForm = document.querySelector("#modal-form");
    this.$modalTitle = document.querySelector("#modal-title");
    this.$modalText = document.querySelector("#modal-text");
    this.$closeModalForm = document.querySelector("#modal-btn");
    this.$sidebar = document.querySelector(".sidebar");
    this.$sidebarActiveItem = document.querySelector(".active-item");
    this.$sidebarItems = document.querySelectorAll(".sidebar-item[data-view]");

    this.longPressTimer = null;
    this.isMoveMode = false;
    this.moveSourceId = null;
    this.ignoreNextClick = false;
    this.draggedElement = null;
    this.dragOriginalStyle = null;
    this.dragStartClientX = 0;
    this.dragStartClientY = 0;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragGhostEl = null;
    this.dragOverId = null;

    this.addEventListeners();
    this.displayNotes();
  }

  addEventListeners() {
    document.body.addEventListener("click", (event) => {
      if (this.isMobileUi()) {
        const tappedNote = event.target.closest(".note");
        const tappedInsideNoteFooter = !!event.target.closest(".note-footer");
        const tappedInteractive = this.isInteractiveControl(event.target);
        if (!tappedNote) {
          this.closeAllToolkits();
        } else {
          if (!tappedInteractive && !tappedInsideNoteFooter) {
            if (!tappedNote.classList.contains("tools-open")) {
              this.openToolkit(tappedNote);
              return;
            }
          }
        }
      }
      if (this.currentView === "notes") {
        this.handleFormClick(event);
      }
      this.closeModal(event);
      this.openModal(event);
      this.handleArchiving(event);
      this.handleMoreMenu(event);
      this.handleColorMenu(event);
    });

    this.$menuBtn.addEventListener("click", () => {
      this.toggleSidebar();
    });

    if (this.currentView === "notes") {
      this.$form.addEventListener("submit", (event) => {
        event.preventDefault();
        const title = this.$noteTitle.value;
        const text = this.$noteText.value;
        this.addNote({ title, text });
        this.closeActiveForm();
      });
    }

    this.$modalForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    this.$sidebar.addEventListener("mouseenter", () => {
      if (!this.sidebarPinned) {
        this.$sidebar.style.width = "250px";
        this.$sidebar.classList.add("sidebar-hover");
        this.$sidebarActiveItem.classList.add("sidebar-active-item");
      }
    });

    this.$sidebar.addEventListener("mouseleave", () => {
      if (!this.sidebarPinned) {
        this.$sidebar.style.width = "80px";
        this.$sidebar.classList.remove("sidebar-hover");
        this.$sidebarActiveItem.classList.remove("sidebar-active-item");
      }
    });

    this.$notes.addEventListener("mouseover", (e) => {
      const note = e.target.closest(".note");

      if (note) {
        note.addEventListener(
          "mouseleave",
          () => {
            this.closeAllMoreMenus();
            this.closeAllColorMenus();
          },
          { once: true },
        );
      }
    });

    this.$sidebar.addEventListener("click", (event) => {
      this.handleSidebarNavigation(event);
    });

    if (this.currentView === "notes") {
      this.$notes.addEventListener("mousedown", (event) =>
        this.handleNotePointerDown(event),
      );
      this.$notes.addEventListener("mouseup", (event) =>
        this.handleNotePointerUp(event),
      );
      this.$notes.addEventListener("mousemove", (event) =>
        this.handleNotePointerMove(event),
      );
      this.$notes.addEventListener("mouseleave", () => this.cancelLongPress());
      this.$notes.addEventListener("touchstart", (event) =>
        this.handleNotePointerDown(event),
      );
      this.$notes.addEventListener("touchend", (event) =>
        this.handleNotePointerUp(event),
      );
      this.$notes.addEventListener("touchmove", (event) =>
        this.handleNotePointerMove(event),
      );
    }
  }

  handleFormClick(event) {
    if (this.currentView !== "notes") return;

    const isActiveFormClickedOn = this.$activeForm.contains(event.target);
    const isInactiveFormClickedOn = this.$inactiveForm.contains(event.target);
    const title = this.$noteTitle.value;
    const text = this.$noteText.value;

    if (isInactiveFormClickedOn) {
      this.openActiveForm();
    } else if (!isInactiveFormClickedOn && !isActiveFormClickedOn) {
      this.addNote({ title, text });
      this.closeActiveForm();
    }
  }

  openActiveForm() {
    this.$inactiveForm.style.display = "none";
    this.$activeForm.style.display = "block";
    this.$noteText.focus();
  }

  closeActiveForm() {
    this.$inactiveForm.style.display = "block";
    this.$activeForm.style.display = "none";
    this.$noteText.value = "";
    this.$noteTitle.value = "";
  }

  openModal(event) {
    if (this.isMobileUi()) {
      const tappedNote = event.target.closest(".note");
      if (tappedNote && !this.isInteractiveControl(event.target)) {
        if (!tappedNote.classList.contains("tools-open")) {
          this.openToolkit(tappedNote);
          return;
        }
      }
    }

    if (this.isMoveMode || this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }

    const $selectedNote = event.target.closest(".note");
    if (
      $selectedNote &&
      !event.target.closest(".archive") &&
      !event.target.closest(".more-container") &&
      !event.target.closest(".delete-note") &&
      !event.target.closest(".color-container") &&
      !event.target.closest(".color-option")
    ) {
      this.selectedNoteId = $selectedNote.id;
      this.$modalTitle.value = $selectedNote.children[1].innerHTML;
      this.$modalText.value = $selectedNote.children[2].innerHTML;
      this.$modal.classList.add("open-modal");
    } else {
      return;
    }
  }

  closeModal(event) {
    const isModalFormClickedOn = this.$modalForm.contains(event.target);
    const isCloseModalBtnClickedOn = this.$closeModalForm.contains(
      event.target,
    );
    if (
      (!isModalFormClickedOn || isCloseModalBtnClickedOn) &&
      this.$modal.classList.contains("open-modal")
    ) {
      this.editNote(this.selectedNoteId, {
        title: this.$modalTitle.value,
        text: this.$modalText.value,
      });
      this.$modal.classList.remove("open-modal");
    }
  }

  handleArchiving(event) {
    const $selectedNote = event.target.closest(".note");
    if ($selectedNote && event.target.closest(".archive")) {
      this.selectedNoteId = $selectedNote.id;
      this.archiveNote(this.selectedNoteId);
    } else {
      return;
    }
  }

  addNote({ title, text }) {
    if (text != "") {
      const newNote = new Note(
        cuid(),
        title,
        text,
        "notes",
        "#ffffff",
        this.getNextOrder(),
      );
      this.notes = [...this.notes, newNote];
      this.render();
    }
  }

  editNote(id, { title, text }) {
    this.notes = this.notes.map((note) => {
      if (note.id == id) {
        note.title = title;
        note.text = text;
      }
      return note;
    });
    this.render();
  }

  handleMouseOverNote(element) {
    const $note = document.querySelector("#" + element.id);
    const $checkNote = $note.querySelector(".check-circle");
    const $noteFooter = $note.querySelector(".note-footer");
    $checkNote.style.visibility = "visible";
    $noteFooter.style.visibility = "visible";
  }

  handleMouseOutNote(element) {
    const $note = document.querySelector("#" + element.id);
    const $checkNote = $note.querySelector(".check-circle");
    const $noteFooter = $note.querySelector(".note-footer");
    $checkNote.style.visibility = "hidden";
    $noteFooter.style.visibility = "hidden";
  }

  toggleSidebar() {
    this.sidebarPinned = !this.sidebarPinned;

    if (this.sidebarPinned) {
      this.$sidebar.style.width = "250px";
      this.$sidebar.classList.add("sidebar-hover");
      this.$sidebarActiveItem.classList.add("sidebar-active-item");
    } else {
      this.$sidebar.style.width = "80px";
      this.$sidebar.classList.remove("sidebar-hover");
      this.$sidebarActiveItem.classList.remove("sidebar-active-item");
    }
  }

  saveNotes() {
    localStorage.setItem("notes", JSON.stringify(this.notes));
  }

  render() {
    this.saveNotes();
    this.displayNotes();
  }

  getFilteredNotes() {
    let statusForView = "notes";
    if (this.currentView === "archive") {
      statusForView = "archived";
    } else if (this.currentView === "trash") {
      statusForView = "trashed";
    }
    const filtered = this.notes.filter((note) => note.status === statusForView);

    if (this.currentView === "notes") {
      return filtered.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return filtered;
  }

  displayNotes() {
    const filteredNotes = this.getFilteredNotes();

    this.$notes.innerHTML = filteredNotes
      .map(
        (note) =>
          `
        <div class="note" id="${note.id}" data-id="${note.id}" style="background-color: ${note.color};" >
          <span class="material-symbols-outlined check-circle"
            >check_circle</span
          >
          <div class="title">${note.title}</div>
          <div class="text">${note.text}</div>
          <div class="note-footer">
            <div class="tooltip color-container">
              <span class="material-symbols-outlined hover small-icon"
                >palette</span
              >
              <span class="tooltip-text">Background options</span>

              <div class="color-menu">
                <div class="color-option" data-color="#ffffff" style="background-color: #ffffff;"></div>
                <div class="color-option" data-color="#f28b82" style="background-color: #f28b82;"></div>
                <div class="color-option" data-color="#fdd663" style="background-color: #fdd663;"></div>
                <div class="color-option" data-color="#fff475" style="background-color: #fff475;"></div>
                <div class="color-option" data-color="#ccff90" style="background-color: #ccff90;"></div>
                <div class="color-option" data-color="#a7ffeb" style="background-color: #a7ffeb;"></div>
              </div>
            </div>
            <div class="tooltip">
              <span class="material-symbols-outlined hover small-icon"
                >add_alert</span
              >
              <span class="tooltip-text">Remind me</span>
            </div>
            <div class="tooltip">
              <span class="material-symbols-outlined hover small-icon"
                >person_add</span
              >
              <span class="tooltip-text">Collaborator</span>
            </div>
            <div class="tooltip">
              <span class="material-symbols-outlined hover small-icon"
                >image</span
              >
              <span class="tooltip-text">Add Image</span>
            </div>
            <div class="tooltip archive">
              <span class="material-symbols-outlined hover small-icon"
                >archive</span
              >
              <span class="tooltip-text">Archive</span>
            </div>
            <div class="tooltip more-container">
              <span class="material-symbols-outlined hover small-icon more-btn">
                more_vert
              </span>
              <span class="tooltip-text">More</span>

              <div class="more-menu">
                <div class="delete-note">Delete note</div>
              </div>
            </div>
          </div>
        </div>
        `,
      )
      .join("");
  }

  archiveNote(id) {
    this.notes = this.notes.map((note) => {
      if (note.id == id) {
        if (note.status === "notes" || note.status === "trashed") {
          note.status = "archived";
        } else if (note.status === "archived") {
          note.status = "notes";
        }
      }
      return note;
    });
    this.render();
  }

  trashNote(id) {
    this.notes = this.notes.map((note) => {
      if (note.id == id) {
        note.status = "trashed";
      }
      return note;
    });
    this.render();
  }

  handleMoreMenu(event) {
    const allMenus = document.querySelectorAll(".more-menu");

    if (event.target.closest(".more-btn")) {
      event.stopPropagation();

      const clickedMore = event.target.closest(".more-container");
      const menu = clickedMore.querySelector(".more-menu");

      allMenus.forEach((item) => {
        if (item !== menu) {
          item.classList.remove("show");
        }
      });

      menu.classList.toggle("show");
      return;
    }

    if (event.target.closest(".delete-note")) {
      const $selectedNote = event.target.closest(".note");
      if ($selectedNote) {
        this.selectedNoteId = $selectedNote.id;
        this.trashNote(this.selectedNoteId);
      }
      this.closeAllMoreMenus();
      return;
    }

    allMenus.forEach((item) => item.classList.remove("show"));
  }

  closeAllMoreMenus() {
    document
      .querySelectorAll(".more-menu.show")
      .forEach((menu) => menu.classList.remove("show"));
  }

  handleSidebarNavigation(event) {
    const sidebarItem = event.target.closest(".sidebar-item[data-view]");
    if (!sidebarItem) return;

    const view = sidebarItem.getAttribute("data-view");
    const pageMap = {
      notes: "index.html",
      archive: "archive.html",
      trash: "trash.html",
    };

    const target = pageMap[view];
    if (target) {
      window.location.href = target;
    }
  }

  getNextOrder() {
    if (this.notes.length === 0) return 0;
    const maxOrder = this.notes.reduce(
      (max, note) =>
        typeof note.order === "number" && note.order > max ? note.order : max,
      0,
    );
    return maxOrder + 1;
  }

  isInteractiveControl(target) {
    return !!(
      target.closest(".archive") ||
      target.closest(".more-container") ||
      target.closest(".delete-note") ||
      target.closest(".color-container") ||
      target.closest(".color-option")
    );
  }

  // my note color changer manual feature

  changeNoteColor(id, color) {
    this.notes = this.notes.map((note) => {
      if (note.id == id) {
        note.color = color;
      }
      return note;
    });
    this.render();
  }

  handleColorMenu(event) {
    const allColorMenus = document.querySelectorAll(".color-menu");

    if (event.target.closest(".color-container .small-icon")) {
      event.stopPropagation();

      const clickedPalette = event.target.closest(".color-container");
      const menu = clickedPalette.querySelector(".color-menu");

      allColorMenus.forEach((item) => {
        if (item !== menu) {
          item.classList.remove("show");
        }
      });

      menu.classList.toggle("show");
      return;
    }

    if (event.target.closest(".color-option")) {
      event.stopPropagation();

      const colorOption = event.target.closest(".color-option");
      const note = event.target.closest(".note");

      if (note) {
        const noteId = note.id;
        const selectedColor = colorOption.dataset.color;
        this.changeNoteColor(noteId, selectedColor);
      }

      this.closeAllColorMenus();
      return;
    }

    allColorMenus.forEach((item) => item.classList.remove("show"));
  }

  closeAllColorMenus() {
    document
      .querySelectorAll(".color-menu.show")
      .forEach((menu) => menu.classList.remove("show"));
  }

  // AI note drag code

  setNoSelect(on) {
    document.body.classList.toggle("no-select", on);
  }

  clearDragOver() {
    document.querySelectorAll(".note.drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
    this.dragOverId = null;
  }

  createGhostFromNote(noteEl) {
    const rect = noteEl.getBoundingClientRect();
    const ghost = noteEl.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  destroyGhost() {
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
  }

  isMobileUi() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  closeAllToolkits(exceptNoteId = null) {
    document.querySelectorAll(".note.tools-open").forEach((el) => {
      if (!exceptNoteId || el.id !== exceptNoteId)
        el.classList.remove("tools-open");
    });
  }

  openToolkit(noteEl) {
    if (!noteEl) return;
    this.closeAllToolkits(noteEl.id);
    noteEl.classList.add("tools-open");
  }

  handleNotePointerDown(event) {
    if (this.currentView !== "notes") return;

    const isTouch = event.type.startsWith("touch");
    if (!isTouch && event.button !== 0 && event.button !== undefined) return;

    const point = isTouch ? event.touches?.[0] : event;
    if (!point) return;

    this.dragStartClientX = point.clientX;
    this.dragStartClientY = point.clientY;

    const baseTarget = isTouch
      ? document.elementFromPoint(point.clientX, point.clientY)
      : event.target;

    const noteEl = baseTarget?.closest(".note");
    if (!noteEl) return;

    if (this.isInteractiveControl(baseTarget || event.target)) return;

    this.cancelLongPress();

    const noteId = noteEl.id;

    this.longPressTimer = setTimeout(() => {
      const sourceEl = document.getElementById(noteId);
      if (!sourceEl) return;

      const rect = sourceEl.getBoundingClientRect();
      this.dragOffsetX = this.dragStartClientX - rect.left;
      this.dragOffsetY = this.dragStartClientY - rect.top;

      this.isMoveMode = true;
      this.moveSourceId = noteId;
      this.ignoreNextClick = true;
      sourceEl.classList.add("drag-source");
      this.dragGhostEl = this.createGhostFromNote(sourceEl);
      this.setNoSelect(true);

      if (isTouch) this.$notes.style.touchAction = "none";
    }, 350);
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  handleNotePointerMove(event) {
    const isTouch = event.type.startsWith("touch");

    if (!this.isMoveMode) {
      this.cancelLongPress();
      return;
    }
    if (!this.dragGhostEl) return;

    const point = isTouch ? event.touches?.[0] : event;
    if (!point) return;

    event.preventDefault();

    const clientX = point.clientX;
    const clientY = point.clientY;

    const x = clientX - this.dragOffsetX;
    const y = clientY - this.dragOffsetY;

    this.dragGhostEl.style.left = `${x}px`;
    this.dragGhostEl.style.top = `${y}px`;
    const under = document.elementFromPoint(clientX, clientY);
    const targetNote = under?.closest(".note");

    this.clearDragOver();

    if (
      targetNote &&
      this.moveSourceId &&
      targetNote.id !== this.moveSourceId
    ) {
      targetNote.classList.add("drag-over");
      this.dragOverId = targetNote.id;
    }
  }

  handleNotePointerUp(event) {
    this.cancelLongPress();

    if (!this.isMoveMode) return;

    const isTouch = event.type.startsWith("touch");
    const point = isTouch ? event.changedTouches?.[0] : event;
    if (point) event.preventDefault();

    const sourceId = this.moveSourceId;
    const targetId = this.dragOverId;

    if (sourceId && targetId && targetId !== sourceId) {
      const sourceNote = this.notes.find((n) => n.id === sourceId);
      const targetNoteObj = this.notes.find((n) => n.id === targetId);

      if (sourceNote && targetNoteObj) {
        const tempOrder = sourceNote.order;
        sourceNote.order = targetNoteObj.order;
        targetNoteObj.order = tempOrder;
        this.render();
      }
    }

    const sourceEl = sourceId ? document.getElementById(sourceId) : null;
    if (sourceEl) sourceEl.classList.remove("drag-source");

    this.clearDragOver();
    this.destroyGhost();
    this.setNoSelect(false);
    this.$notes.style.touchAction = "";

    this.isMoveMode = false;
    this.moveSourceId = null;
  }
}

const app = new App();

(() => {
  const nav = document.querySelector("nav");
  if (!nav) return;

  const openBtn = document.getElementById("mobile-search-btn");
  const closeBtn = document.getElementById("mobile-search-close");
  const input = document.getElementById("nav-search-input");

  const open = () => {
    nav.classList.add("search-open");
    if (input) input.focus();
  };

  const close = () => {
    nav.classList.remove("search-open");
    if (input) input.blur();
  };

  openBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("search-open")) return;
    const inSearch = e.target.closest(".search-area");
    const inOpenBtn = e.target.closest(".mobile-search-btn");
    if (!inSearch && !inOpenBtn) close();
  });
})();
