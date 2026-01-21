/**
 * Character Sheet Export/Import Handler
 * Handles saving, loading, exporting, and importing character data
 */
class CharacterSheetExport {
	constructor (page) {
		this._page = page;
		this._state = page.getState();

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	_initEventListeners () {
		// Export button
		$(document).on("click", "#charsheet-btn-export", () => this._showExportDialog());

		// Import button
		$(document).on("click", "#charsheet-btn-import", () => this._showImportDialog());

		// Print button
		$(document).on("click", "#charsheet-btn-print", () => this._printCharacter());

		// Save button (if exists)
		$(document).on("click", "#charsheet-btn-save", () => this._saveCharacter());
	}

	async _showExportDialog () {
		const characterData = this._state.toJSON();
		const jsonStr = JSON.stringify(characterData, null, 2);
		const characterName = this._state.getName() || "character";

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "📤 Export Character",
			isMinHeight0: true,
			isWidth100: true,
		});

		let isPdfFormat = false;

		const $btnJson = $(`<button class="ve-btn ve-btn-default active">JSON File</button>`)
			.on("click", () => {
				isPdfFormat = false;
				$btnJson.addClass("active");
				$btnPdf.removeClass("active");
				$jsonSection.show();
				$pdfSection.hide();
			});

		const $btnPdf = $(`<button class="ve-btn ve-btn-default">Print / PDF</button>`)
			.on("click", () => {
				isPdfFormat = true;
				$btnPdf.addClass("active");
				$btnJson.removeClass("active");
				$pdfSection.show();
				$jsonSection.hide();
			});

		const $jsonSection = $$`<div>
			<div class="charsheet__export-info mb-3">
				<p class="ve-muted mb-1"><strong>💾 JSON Export</strong> - Create a backup file to:</p>
				<ul class="ve-muted" style="margin: 0; padding-left: 1.5rem;">
					<li>Transfer your character to another device</li>
					<li>Share your character with another player</li>
					<li>Keep a backup of your character</li>
				</ul>
			</div>
			<div class="charsheet__export-preview">
				<label class="ve-muted mb-1">Character Data Preview:</label>
				<textarea class="form-control" rows="12" readonly style="font-family: monospace; font-size: 0.8rem;">${jsonStr}</textarea>
			</div>
		</div>`;

		const $pdfSection = $$`<div style="display: none;">
			<div class="charsheet__export-info">
				<p class="ve-muted mb-1"><strong>🖨️ Print / PDF</strong> - Opens print dialog to:</p>
				<ul class="ve-muted" style="margin: 0; padding-left: 1.5rem;">
					<li>Print a physical character sheet</li>
					<li>Save as PDF (choose "Save as PDF" in print dialog)</li>
				</ul>
			</div>
		</div>`;

		$$`<div>
			<div class="mb-3">
				<div class="charsheet__export-format-label mb-2">Export Format:</div>
				<div class="ve-btn-group">
					${$btnJson}
					${$btnPdf}
				</div>
			</div>
			${$jsonSection}
			${$pdfSection}
		</div>`.appendTo($modalInner);

		// Footer buttons
		const $btnClose = $(`<button class="ve-btn ve-btn-default">Close</button>`)
			.on("click", () => doClose(false));
		const $btnCopy = $(`<button class="ve-btn ve-btn-default"><span class="glyphicon glyphicon-copy"></span> Copy to Clipboard</button>`)
			.on("click", async () => {
				if (isPdfFormat) {
					this._printCharacter();
				} else {
					await MiscUtil.pCopyTextToClipboard(jsonStr);
					JqueryUtil.doToast({type: "success", content: "Character data copied to clipboard!"});
				}
			});
		const $btnDownload = $(`<button class="ve-btn ve-btn-primary"><span class="glyphicon glyphicon-download"></span> Download</button>`)
			.on("click", () => {
				if (isPdfFormat) {
					this._printCharacter();
				} else {
					const filename = `${characterName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
					DataUtil.userDownload(filename, characterData, {fileType: "character"});
					JqueryUtil.doToast({type: "success", content: `Downloaded ${filename}`});
				}
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnClose}
			${$btnCopy}
			${$btnDownload}
		</div>`.appendTo($modalInner);
	}

	async _showImportDialog () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "📥 Import Character",
			isMinHeight0: true,
		});

		const $fileInput = $(`<input type="file" class="form-control" accept=".json">`);
		const $jsonTextarea = $(`<textarea class="form-control" rows="8" placeholder="Paste character JSON data here..." style="font-family: monospace; font-size: 0.85rem;"></textarea>`);
		const $cbReplace = $(`<input type="checkbox" class="mr-2">`);

		// File input handler
		$fileInput.on("change", (e) => {
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (evt) => {
				$jsonTextarea.val(evt.target.result);
				JqueryUtil.doToast({type: "info", content: `Loaded: ${file.name}`});
			};
			reader.readAsText(file);
		});

		$$`<div>
			<div class="charsheet__import-info mb-3">
				<p class="ve-muted mb-1"><strong>📂 Import a character</strong> from a previously exported JSON file.</p>
				<p class="ve-muted" style="font-size: 0.85rem;">Characters are saved locally in your browser. Use this to restore a backup or import a character from another device.</p>
			</div>
			
			<div class="mb-3">
				<label class="ve-muted mb-1"><strong>Option 1:</strong> Select a file</label>
				${$fileInput}
			</div>
			
			<div class="text-center ve-muted mb-3" style="font-size: 0.85rem;">— or —</div>
			
			<div class="mb-3">
				<label class="ve-muted mb-1"><strong>Option 2:</strong> Paste JSON data</label>
				${$jsonTextarea}
			</div>
			
			<div class="charsheet__import-option mt-3">
				<label class="ve-flex-v-center">
					${$cbReplace}
					<span>
						<strong>Replace current character</strong>
						<span class="ve-muted" style="font-size: 0.85rem;"> — Overwrites the character you're currently editing (cannot be undone)</span>
					</span>
				</label>
			</div>
		</div>`.appendTo($modalInner);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnImport = $(`<button class="ve-btn ve-btn-primary">Import</button>`)
			.on("click", async () => {
				const jsonStr = $jsonTextarea.val().trim();
				const replaceExisting = $cbReplace.is(":checked");

				if (!jsonStr) {
					JqueryUtil.doToast({type: "warning", content: "Please provide character data to import."});
					return;
				}

				try {
					const data = JSON.parse(jsonStr);

					// Validate basic structure
					if (!data.name && !data.classes && !data.race) {
						throw new Error("Invalid character data structure");
					}

					if (replaceExisting) {
						this._state.fromJSON(data);
					} else {
						const newState = new CharacterSheetState();
						newState.fromJSON(data);
						await this._page.addCharacter(newState);
					}

					this._page.renderCharacter();
					await this._page.saveCharacter();

					doClose(true);
					JqueryUtil.doToast({type: "success", content: `Imported ${data.name || "character"} successfully!`});

				} catch (err) {
					console.error("Import error:", err);
					JqueryUtil.doToast({type: "danger", content: "Failed to import: Invalid JSON data."});
				}
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnCancel}
			${$btnImport}
		</div>`.appendTo($modalInner);
	}

	_printCharacter () {
		// Add print class for styling
		$("body").addClass("charsheet-printing");

		// Open print dialog
		window.print();

		// Remove print class after a delay
		setTimeout(() => {
			$("body").removeClass("charsheet-printing");
		}, 1000);
	}

	async _saveCharacter () {
		try {
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: "Character saved!"});
		} catch (err) {
			console.error("Save error:", err);
			JqueryUtil.doToast({type: "danger", content: "Failed to save character."});
		}
	}

	// Export to various formats
	toFoundryVTT () {
		// Convert character data to Foundry VTT format
		const data = this._state.toJSON();

		return {
			name: data.name,
			type: "character",
			system: {
				abilities: {
					str: {value: data.abilities.str.base + (data.abilities.str.bonus || 0)},
					dex: {value: data.abilities.dex.base + (data.abilities.dex.bonus || 0)},
					con: {value: data.abilities.con.base + (data.abilities.con.bonus || 0)},
					int: {value: data.abilities.int.base + (data.abilities.int.bonus || 0)},
					wis: {value: data.abilities.wis.base + (data.abilities.wis.bonus || 0)},
					cha: {value: data.abilities.cha.base + (data.abilities.cha.bonus || 0)},
				},
				attributes: {
					hp: {value: data.hp.current, max: data.hp.max, temp: data.hp.temp},
					ac: {value: this._state.getArmorClass()},
					speed: data.speed,
				},
				details: {
					level: this._state.getTotalLevel(),
					race: data.race?.name,
					background: data.background?.name,
				},
			},
			items: [
				...data.classes.map(cls => ({
					name: cls.name,
					type: "class",
					system: {levels: cls.level},
				})),
				...data.inventory.items.map(item => ({
					name: item.name,
					type: item.type === "weapon" ? "weapon" : item.type === "armor" ? "equipment" : "loot",
					system: {quantity: item.quantity},
				})),
			],
		};
	}

	toRoll20 () {
		// Convert to Roll20 character JSON format
		const data = this._state.toJSON();

		return {
			schema_version: 2,
			name: data.name,
			attribs: [
				{name: "strength", current: this._state.getAbilityTotal("str")},
				{name: "dexterity", current: this._state.getAbilityTotal("dex")},
				{name: "constitution", current: this._state.getAbilityTotal("con")},
				{name: "intelligence", current: this._state.getAbilityTotal("int")},
				{name: "wisdom", current: this._state.getAbilityTotal("wis")},
				{name: "charisma", current: this._state.getAbilityTotal("cha")},
				{name: "hp", current: data.hp.current, max: data.hp.max},
				{name: "ac", current: this._state.getArmorClass()},
				{name: "speed", current: data.speed.walk},
				{name: "level", current: this._state.getTotalLevel()},
				{name: "race", current: data.race?.name || ""},
				{name: "class", current: data.classes.map(c => c.name).join("/") || ""},
			],
		};
	}
}

globalThis.CharacterSheetExport = CharacterSheetExport;

export {CharacterSheetExport};
