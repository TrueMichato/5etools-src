/**
 * Character Sheet Notes Handler
 * Manages sticky notes and entity notes (on items, spells, features, etc.)
 */
export class CharacterSheetNotes {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._activeTab = null;

		// Tab ID to name mapping
		this._tabMap = {
			"charsheet-tab-overview": "overview",
			"charsheet-tab-abilities": "abilities",
			"charsheet-tab-combat": "combat",
			"charsheet-tab-spells": "spells",
			"charsheet-tab-inventory": "inventory",
			"charsheet-tab-features": "features",
			"charsheet-tab-notes": "notes",
			"charsheet-tab-companions": "companions",
			"charsheet-tab-builder": "builder",
			"charsheet-tab-respec": "respec",
		};

		// Sticky note colors with better contrast for readability
		this._colors = {
			yellow: {bg: "#fffde7", border: "#f9a825", text: "#4a3800", headerBg: "#fff59d"},
			blue: {bg: "#e3f2fd", border: "#1976d2", text: "#0d3c61", headerBg: "#90caf9"},
			green: {bg: "#e8f5e9", border: "#388e3c", text: "#1b4d1f", headerBg: "#a5d6a7"},
			pink: {bg: "#fce4ec", border: "#c2185b", text: "#5c0a2e", headerBg: "#f48fb1"},
			purple: {bg: "#f3e5f5", border: "#7b1fa2", text: "#3d0f51", headerBg: "#ce93d8"},
		};

		this._init();
	}

	_init () {
		this._initEventListeners();
		// Detect initial tab
		this._detectCurrentTab();
		this._renderStickyNotes();
	}

	_initEventListeners () {
		// Add sticky note button - from toolbar
		$(document).on("click", "#charsheet-add-sticky-note", () => this._showAddStickyNoteModal());

		// Tab change listener - handle both Bootstrap events and direct clicks
		$(document).on("shown.bs.tab", 'a[data-toggle="tab"]', (e) => {
			const href = $(e.target).attr("href");
			if (href) {
				const tabId = href.replace("#", "");
				this._activeTab = this._tabMap[tabId] || null;
				this._renderStickyNotes();
			}
		});

		// Also listen for click events on tabs (backup)
		$(document).on("click", '.ve-nav-tabs a[data-toggle="tab"]', (e) => {
			const href = $(e.currentTarget).attr("href");
			if (href) {
				const tabId = href.replace("#", "");
				this._activeTab = this._tabMap[tabId] || null;
				// Small delay to let tab become active
				setTimeout(() => this._renderStickyNotes(), 50);
			}
		});
	}

	/**
	 * Detect the currently active tab
	 */
	_detectCurrentTab () {
		// Try to get active tab from visible tab pane
		const $activePane = $(".tab-pane.active, .tab-pane.in");
		if ($activePane.length) {
			const tabId = $activePane.attr("id");
			this._activeTab = this._tabMap[tabId] || null;
			return;
		}

		// Fallback: check active tab link
		const $activeTab = $(".ve-nav-tabs li.active a[data-toggle='tab']");
		if ($activeTab.length) {
			const href = $activeTab.attr("href");
			if (href) {
				const tabId = href.replace("#", "");
				this._activeTab = this._tabMap[tabId] || null;
				return;
			}
		}

		// Default to overview
		this._activeTab = "overview";
	}

	/**
	 * Render all sticky notes for the current tab
	 */
	_renderStickyNotes () {
		// Clear all sticky note containers first
		$(".charsheet__sticky-notes-container").empty();

		const allNotes = this._state.getStickyNotes();

		// Group notes by tab
		const notesByTab = {};
		allNotes.forEach(note => {
			const tab = note.tab || "all";
			if (!notesByTab[tab]) notesByTab[tab] = [];
			notesByTab[tab].push(note);
		});

		// Render "all tabs" notes in the current tab's container
		const currentTabNotes = [
			...(notesByTab["all"] || []),
			...(notesByTab[this._activeTab] || []),
		];

		if (currentTabNotes.length === 0) return;

		const $container = this._getOrCreateStickyNoteContainer();
		if (!$container.length) return;

		currentTabNotes.forEach(note => {
			const $note = this._buildStickyNote(note);
			$container.append($note);
		});
	}

	/**
	 * Get or create the sticky note container for the CURRENT tab
	 */
	_getOrCreateStickyNoteContainer () {
		// Find the currently active tab pane
		let $tabPane = $(".tab-pane.active");
		if (!$tabPane.length) {
			$tabPane = $(".tab-pane.in");
		}
		if (!$tabPane.length) {
			// Fallback to any visible tab pane
			$tabPane = $(".tab-pane:visible").first();
		}
		if (!$tabPane.length) {
			// Last resort: overview tab
			$tabPane = $("#charsheet-tab-overview");
		}

		if (!$tabPane.length) return $();

		// Look for existing container in this tab
		let $container = $tabPane.find("> .charsheet__sticky-notes-container");
		if (!$container.length) {
			// Create container at the top of the tab
			$container = $(`<div class="charsheet__sticky-notes-container"></div>`);
			$tabPane.prepend($container);
		}
		return $container;
	}

	/**
	 * Build a single sticky note element
	 */
	_buildStickyNote (note) {
		const colorConfig = this._colors[note.color] || this._colors.yellow;

		// Render content with markdown and 5etools support
		const renderedContent = this._renderNoteContent(note.content);

		// Tab indicator
		const tabLabel = note.tab ? this._getTabLabel(note.tab) : "All Tabs";

		const $note = $(`
			<div class="charsheet__sticky-note ${note.collapsed ? "charsheet__sticky-note--collapsed" : ""}" 
				 data-note-id="${note.id}"
				 style="--note-bg: ${colorConfig.bg}; --note-border: ${colorConfig.border}; --note-text: ${colorConfig.text}; --note-header-bg: ${colorConfig.headerBg};">
				<div class="charsheet__sticky-note-header">
					<div class="charsheet__sticky-note-title-row">
						<span class="charsheet__sticky-note-icon">📌</span>
						<span class="charsheet__sticky-note-title" title="Double-click to edit">${note.title || "Note"}</span>
					</div>
					<div class="charsheet__sticky-note-controls">
						<button class="charsheet__sticky-note-btn charsheet__sticky-note-btn-collapse" 
								title="${note.collapsed ? "Expand" : "Collapse"}">
							<span class="glyphicon glyphicon-${note.collapsed ? "chevron-down" : "chevron-up"}"></span>
						</button>
						<button class="charsheet__sticky-note-btn charsheet__sticky-note-btn-edit" title="Edit">
							<span class="glyphicon glyphicon-pencil"></span>
						</button>
						<button class="charsheet__sticky-note-btn charsheet__sticky-note-btn-delete" title="Delete">
							<span class="glyphicon glyphicon-trash"></span>
						</button>
					</div>
				</div>
				<div class="charsheet__sticky-note-body">
					<div class="charsheet__sticky-note-content">
						${renderedContent}
					</div>
					<div class="charsheet__sticky-note-footer">
						<span class="charsheet__sticky-note-tab-badge">📍 ${tabLabel}</span>
					</div>
				</div>
			</div>
		`);

		// Make draggable if positioned
		if (note.position) {
			$note.css({
				position: "absolute",
				left: `${note.position.x}px`,
				top: `${note.position.y}px`,
			});
			this._makeDraggable($note, note.id);
		}

		// Event handlers
		$note.find(".charsheet__sticky-note-btn-collapse").on("click", (e) => {
			e.stopPropagation();
			this._toggleNoteCollapse(note.id);
		});

		$note.find(".charsheet__sticky-note-btn-edit").on("click", (e) => {
			e.stopPropagation();
			this._showEditStickyNoteModal(note.id);
		});

		$note.find(".charsheet__sticky-note-btn-delete").on("click", (e) => {
			e.stopPropagation();
			this._deleteStickyNote(note.id);
		});

		// Double-click title to edit
		$note.find(".charsheet__sticky-note-title").on("dblclick", () => {
			this._showEditStickyNoteModal(note.id);
		});

		return $note;
	}

	/**
	 * Get human-readable tab label
	 */
	_getTabLabel (tabKey) {
		const labels = {
			overview: "Overview",
			abilities: "Abilities",
			combat: "Combat",
			spells: "Spells",
			inventory: "Inventory",
			features: "Features",
			notes: "Notes",
			companions: "Companions",
			builder: "Builder",
			respec: "Respec",
		};
		return labels[tabKey] || tabKey;
	}

	/**
	 * Render note content with markdown and 5etools tag support
	 * @param {string} content - Raw content
	 * @returns {string} Rendered HTML
	 */
	_renderNoteContent (content) {
		if (!content || !content.trim()) return "<em class='ve-muted'>(empty)</em>";

		try {
			// Process line by line to handle block-level elements
			const lines = content.split("\n");
			const processedLines = [];
			let inList = false;

			for (const line of lines) {
				// Check for list items (- or * at start)
				const listMatch = line.match(/^[-*]\s+(.+)$/);
				if (listMatch) {
					if (!inList) {
						processedLines.push("<ul class='charsheet__note-list'>");
						inList = true;
					}
					const itemContent = this._processInlineFormatting(listMatch[1]);
					processedLines.push(`<li>${itemContent}</li>`);
					continue;
				}

				// Close list if we were in one
				if (inList) {
					processedLines.push("</ul>");
					inList = false;
				}

				// Check for headers (# at start)
				const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
				if (headerMatch) {
					const level = Math.min(headerMatch[1].length, 3);
					const headerContent = this._processInlineFormatting(headerMatch[2]);
					processedLines.push(`<strong class='charsheet__note-header charsheet__note-header--${level}'>${headerContent}</strong>`);
					continue;
				}

				// Empty line = paragraph break
				if (!line.trim()) {
					processedLines.push("<br>");
					continue;
				}

				// Regular line - process inline formatting
				const processedLine = this._processInlineFormatting(line);
				processedLines.push(processedLine);
			}

			// Close any open list
			if (inList) {
				processedLines.push("</ul>");
			}

			return processedLines.join("\n");
		} catch (e) {
			console.error("[Notes] Error rendering content:", e);
			// Fallback to escaped text with line breaks
			return content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
		}
	}

	/**
	 * Process inline formatting (bold, italic, code, 5etools tags)
	 * @param {string} text - Text to process
	 * @returns {string} Processed HTML
	 */
	_processInlineFormatting (text) {
		if (!text) return "";

		let processed = text;

		// Process markdown inline formatting
		// Order matters: bold before italic to handle **text** vs *text*
		processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		processed = processed.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
		processed = processed.replace(/__(.+?)__/g, "<strong>$1</strong>");
		processed = processed.replace(/_([^_]+?)_/g, "<em>$1</em>");
		processed = processed.replace(/`([^`]+?)`/g, "<code>$1</code>");

		// Process 5etools tags using the Renderer
		// Only if text contains 5etools tag syntax
		if (processed.includes("{@")) {
			try {
				processed = Renderer.get().render(processed);
			} catch (e) {
				// If renderer fails, leave the tags as-is
				console.warn("[Notes] Error rendering 5etools tags:", e);
			}
		}

		return processed;
	}

	/**
	 * Make a sticky note draggable
	 */
	_makeDraggable ($note, noteId) {
		let isDragging = false;
		let startX, startY, startLeft, startTop;

		const $header = $note.find(".charsheet__sticky-note-header");

		$header.css("cursor", "move");

		$header.on("mousedown", (e) => {
			if ($(e.target).closest("button").length) return; // Don't drag when clicking buttons

			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;
			startLeft = parseInt($note.css("left")) || 0;
			startTop = parseInt($note.css("top")) || 0;

			$note.addClass("charsheet__sticky-note--dragging");
			e.preventDefault();
		});

		$(document).on("mousemove.stickynote" + noteId, (e) => {
			if (!isDragging) return;

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			$note.css({
				left: Math.max(0, startLeft + dx) + "px",
				top: Math.max(0, startTop + dy) + "px",
			});
		});

		$(document).on("mouseup.stickynote" + noteId, () => {
			if (!isDragging) return;
			isDragging = false;
			$note.removeClass("charsheet__sticky-note--dragging");

			// Save new position
			const newPosition = {
				x: parseInt($note.css("left")) || 0,
				y: parseInt($note.css("top")) || 0,
			};
			this._state.updateStickyNote(noteId, {position: newPosition});
			this._page.saveCharacter();
		});
	}

	/**
	 * Toggle note collapsed state
	 */
	_toggleNoteCollapse (noteId) {
		const note = this._state.getStickyNote(noteId);
		if (!note) return;

		this._state.updateStickyNote(noteId, {collapsed: !note.collapsed});
		this._page.saveCharacter();
		this._renderStickyNotes();
	}

	/**
	 * Delete a sticky note
	 */
	async _deleteStickyNote (noteId) {
		const confirmed = await InputUiUtil.pGetUserBoolean({
			title: "Delete Note",
			htmlDescription: "Are you sure you want to delete this note?",
			textYes: "Delete",
			textNo: "Cancel",
		});

		if (!confirmed) return;

		this._state.removeStickyNote(noteId);
		this._page.saveCharacter();
		this._renderStickyNotes();
		JqueryUtil.doToast({type: "info", content: "Note deleted."});
	}

	/**
	 * Show modal to add a new sticky note
	 */
	async _showAddStickyNoteModal () {
		await this._showEditStickyNoteModal(null);
	}

	/**
	 * Show modal to edit or create a sticky note
	 * @param {string|null} noteId - ID of note to edit, or null for new note
	 */
	async _showEditStickyNoteModal (noteId) {
		const existingNote = noteId ? this._state.getStickyNote(noteId) : null;
		const isNew = !existingNote;

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: isNew ? "� Add Sticky Note" : "📌 Edit Sticky Note",
			isMinHeight0: true,
			isWidth100: true,
		});

		// Get tab options for dropdown
		const tabOptions = [
			{value: "", label: "📌 All Tabs (always visible)"},
			{value: "overview", label: "📊 Overview"},
			{value: "combat", label: "⚔️ Combat"},
			{value: "spells", label: "✨ Spells"},
			{value: "inventory", label: "🎒 Inventory"},
			{value: "features", label: "📜 Features"},
			{value: "notes", label: "📝 Notes"},
			{value: "companions", label: "🐾 Companions"},
		];

		// Build form
		const $form = $(`<div class="charsheet__note-edit-form"></div>`);

		// Title
		const $title = $(`<input type="text" class="form-control mb-2" placeholder="Note title..." value="${existingNote?.title || ""}">`);
		$form.append(`<label class="ve-small ve-muted">Title</label>`);
		$form.append($title);

		// Content with markdown hint
		const $content = $(`<textarea class="form-control mb-2" rows="6" placeholder="Note content...&#10;&#10;Supports: **bold**, *italic*, \`code\`, and 5etools tags like {@spell fireball}">${existingNote?.content || ""}</textarea>`);
		$form.append(`<label class="ve-small ve-muted mt-2">Content <span class="text-info">(Markdown & 5etools tags supported)</span></label>`);
		$form.append($content);

		// Tab selection - default to current tab for new notes
		const defaultTab = isNew ? (this._activeTab || "") : (existingNote?.tab || "");
		const $tabSelect = $(`<select class="form-control mb-2"></select>`);
		tabOptions.forEach(opt => {
			const selected = opt.value === defaultTab;
			$tabSelect.append(`<option value="${opt.value}" ${selected ? "selected" : ""}>${opt.label}</option>`);
		});
		$form.append(`<label class="ve-small ve-muted mt-2">Show on Tab</label>`);
		$form.append($tabSelect);

		// Color selection
		const $colorRow = $(`<div class="ve-flex ve-flex-wrap mb-2" style="gap: 8px;"></div>`);
		$form.append(`<label class="ve-small ve-muted mt-2">Color</label>`);
		$form.append($colorRow);

		let selectedColor = existingNote?.color || "yellow";
		Object.entries(this._colors).forEach(([colorName, colorConfig]) => {
			const isSelected = selectedColor === colorName;
			const $colorBtn = $(`
				<button type="button" class="charsheet__note-color-btn ${isSelected ? "charsheet__note-color-btn--selected" : ""}" 
						style="background: ${colorConfig.bg}; border-color: ${colorConfig.border}; color: ${colorConfig.text};"
						data-color="${colorName}">
					${isSelected ? "✓ " : ""}${colorName.charAt(0).toUpperCase() + colorName.slice(1)}
				</button>
			`);
			$colorBtn.on("click", (e) => {
				e.preventDefault();
				selectedColor = colorName;
				$colorRow.find("button").removeClass("charsheet__note-color-btn--selected").each(function () {
					$(this).text($(this).data("color").charAt(0).toUpperCase() + $(this).data("color").slice(1));
				});
				$colorBtn.addClass("charsheet__note-color-btn--selected").text("✓ " + colorName.charAt(0).toUpperCase() + colorName.slice(1));
			});
			$colorRow.append($colorBtn);
		});

		// Position toggle
		const isPositioned = existingNote?.position != null;
		const $positionCb = $(`<input type="checkbox" id="note-position-cb" ${isPositioned ? "checked" : ""}>`);
		const $positionLabel = $(`
			<div class="ve-flex ve-flex-v-center mt-2" style="gap: 8px;">
				<label for="note-position-cb" class="ve-flex ve-flex-v-center m-0" style="gap: 8px; cursor: pointer;">
					<span class="ve-small">📍 Free positioning (drag to move)</span>
				</label>
			</div>
		`);
		$positionLabel.prepend($positionCb);
		$form.append($positionLabel);

		$modalInner.append($form);

		// Button row
		const $btnRow = $(`<div class="ve-flex ve-flex-h-right mt-3" style="gap: 8px;"></div>`).appendTo($modalInner);

		$(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose())
			.appendTo($btnRow);

		$(`<button class="ve-btn ve-btn-primary">${isNew ? "Add Note" : "Save Changes"}</button>`)
			.on("click", () => {
				const title = $title.val().trim() || "Note";
				const content = $content.val();
				const tab = $tabSelect.val() || null;
				const usePosition = $positionCb.is(":checked");
				const position = usePosition ? (existingNote?.position || {x: 20, y: 60}) : null;

				if (isNew) {
					this._state.addStickyNote({
						title,
						content,
						tab,
						position,
						color: selectedColor,
					});
					JqueryUtil.doToast({type: "success", content: "Sticky note added!"});
				} else {
					this._state.updateStickyNote(noteId, {
						title,
						content,
						tab,
						position,
						color: selectedColor,
					});
					JqueryUtil.doToast({type: "success", content: "Note updated!"});
				}

				this._page.saveCharacter();
				this._renderStickyNotes();
				doClose();
			})
			.appendTo($btnRow);

		$title.focus();
	}

	/**
	 * Show inline note editor for an entity
	 * @param {jQuery} $container - The container to append editor to
	 * @param {string} entityType - "item", "spell", "feature", "feat", etc.
	 * @param {string} entityId - The entity ID
	 * @param {Function} [onSave] - Optional callback after save
	 */
	showInlineNoteEditor ($container, entityType, entityId, onSave) {
		// Remove any existing editor
		$container.find(".charsheet__inline-note-editor").remove();

		const currentNote = this._state.getEntityNote(entityType, entityId);

		const $editor = $(`
			<div class="charsheet__inline-note-editor">
				<textarea class="form-control form-control-sm" rows="2" placeholder="Add a note...">${currentNote}</textarea>
				<div class="ve-flex ve-flex-h-right mt-1" style="gap: 4px;">
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__inline-note-cancel">Cancel</button>
					<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__inline-note-save">Save</button>
				</div>
			</div>
		`);

		const $textarea = $editor.find("textarea");

		$editor.find(".charsheet__inline-note-cancel").on("click", () => {
			$editor.remove();
		});

		$editor.find(".charsheet__inline-note-save").on("click", () => {
			const note = $textarea.val();
			this._state.updateEntityNote(entityType, entityId, note);
			this._page.saveCharacter();
			$editor.remove();
			if (onSave) onSave(note);
			JqueryUtil.doToast({type: "success", content: note ? "Note saved!" : "Note cleared."});
		});

		$container.append($editor);
		$textarea.focus();
	}

	/**
	 * Show modal note editor for an entity
	 * @param {string} entityType - "item", "spell", "feature", "feat", etc.
	 * @param {string} entityId - The entity ID
	 * @param {string} entityName - Display name for the entity
	 * @param {Function} [onSave] - Optional callback after save
	 */
	async showNoteModal (entityType, entityId, entityName, onSave) {
		const currentNote = this._state.getEntityNote(entityType, entityId);

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `📝 Note: ${entityName}`,
			isMinHeight0: true,
		});

		const $textarea = $(`<textarea class="form-control" rows="6" placeholder="Add notes about this ${entityType}...">${currentNote}</textarea>`);
		$modalInner.append($textarea);

		const $btnRow = $(`<div class="ve-flex ve-flex-h-right mt-3" style="gap: 8px;"></div>`).appendTo($modalInner);

		if (currentNote) {
			$(`<button class="ve-btn ve-btn-danger">Clear Note</button>`)
				.on("click", () => {
					this._state.updateEntityNote(entityType, entityId, "");
					this._page.saveCharacter();
					if (onSave) onSave("");
					JqueryUtil.doToast({type: "info", content: "Note cleared."});
					doClose();
				})
				.appendTo($btnRow);
		}

		$(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose())
			.appendTo($btnRow);

		$(`<button class="ve-btn ve-btn-primary">Save Note</button>`)
			.on("click", () => {
				const note = $textarea.val();
				this._state.updateEntityNote(entityType, entityId, note);
				this._page.saveCharacter();
				if (onSave) onSave(note);
				JqueryUtil.doToast({type: "success", content: "Note saved!"});
				doClose();
			})
			.appendTo($btnRow);

		$textarea.focus();
	}

	/**
	 * Build a note indicator button for an entity
	 * @param {string} entityType - "item", "spell", "feature", "feat", etc.
	 * @param {string} entityId - The entity ID
	 * @param {string} entityName - Display name for the entity
	 * @returns {jQuery} The note button element
	 */
	buildNoteIndicator (entityType, entityId, entityName) {
		const hasNote = !!this._state.getEntityNote(entityType, entityId);

		const $btn = $(`
			<button class="ve-btn ve-btn-xxs ${hasNote ? "ve-btn-primary" : "ve-btn-default"} charsheet__note-indicator" 
					title="${hasNote ? "View/Edit Note" : "Add Note"}"
					data-entity-type="${entityType}"
					data-entity-id="${entityId}">
				<span class="glyphicon glyphicon-${hasNote ? "sticky-note" : "file"}"></span>
			</button>
		`);

		$btn.on("click", (e) => {
			e.stopPropagation();
			this.showNoteModal(entityType, entityId, entityName, (note) => {
				// Update button appearance
				$btn.toggleClass("ve-btn-primary", !!note)
					.toggleClass("ve-btn-default", !note)
					.attr("title", note ? "View/Edit Note" : "Add Note")
					.find(".glyphicon")
					.toggleClass("glyphicon-sticky-note", !!note)
					.toggleClass("glyphicon-file", !note);
			});
		});

		return $btn;
	}

	/**
	 * Refresh the sticky notes display
	 */
	refresh () {
		this._renderStickyNotes();
	}
}
