/**
 * Character Sheet Rest Handler
 * Manages short rest, long rest, and recovery mechanics
 */
class CharacterSheetRest {
	constructor (page) {
		this._page = page;
		this._state = page.getState();

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	_initEventListeners () {
		// Short rest button
		$(document).on("click", "#charsheet-btn-short-rest", () => this._showShortRestDialog());

		// Long rest button
		$(document).on("click", "#charsheet-btn-long-rest", () => this._showLongRestDialog());
	}

	async _showShortRestDialog () {
		const currentHp = this._state.getHp().current;
		const maxHp = this._state.getHp().max;
		const hitDice = this._state.getHitDice();
		const availableHitDice = hitDice.filter(hd => hd.current > 0);
		const conditions = this._state.getConditionNames?.() || [];
		const isConcentrating = this._state.isConcentrating?.();
		const concentration = this._state.getConcentration?.();

		if (currentHp >= maxHp && !availableHitDice.length && !conditions.length && !isConcentrating) {
			JqueryUtil.doToast({type: "info", content: "You're already at full health with no hit dice to spend."});
			return;
		}

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "😴 Short Rest",
			isMinHeight0: true,
			isWidth100: true,
		});

		let totalHealing = 0;
		// Track spent dice by type
		const spentDice = {};

		const $totalHealing = $(`<span class="charsheet__rest-healing-value">0</span>`);

		// Track which conditions to remove
		const conditionsToRemove = new Set();
		let shouldBreakConcentration = false;

		$$`<div class="charsheet__rest-modal">
			<div class="charsheet__rest-intro">
				<p class="mb-1">During a short rest (typically 1 hour), you can spend Hit Dice to recover hit points.</p>
				<p class="mb-0">Current HP: <span class="charsheet__rest-current-hp">❤️ ${currentHp}/${maxHp}</span></p>
			</div>
			
			<div class="charsheet__rest-section">
				<div class="charsheet__rest-section-title">🎲 Available Hit Dice</div>
				<div id="short-rest-hit-dice-container"></div>
			</div>
			
			<div class="charsheet__rest-healing-display">
				<span class="charsheet__rest-healing-icon">💚</span>
				<span class="charsheet__rest-healing-label">Total Healing:</span>
				${$totalHealing}
				<span class="charsheet__rest-healing-label">HP</span>
			</div>
			
			${conditions.length > 0 || isConcentrating ? `
			<div class="charsheet__rest-section">
				<div class="charsheet__rest-section-title">🛡️ Conditions & Effects</div>
				<div class="charsheet__rest-options" id="short-rest-conditions-container">
					<p class="ve-muted ve-small mb-2">Select conditions or effects to remove during rest:</p>
				</div>
			</div>
			` : ""}
		</div>`.appendTo($modalInner);

		// Render condition checkboxes
		if (conditions.length > 0 || isConcentrating) {
			const $condContainer = $modalInner.find("#short-rest-conditions-container");
			
			// Concentration first
			if (isConcentrating) {
				const $cbConc = $(`<input type="checkbox">`);
				$cbConc.on("change", () => { shouldBreakConcentration = $cbConc.is(":checked"); });
				$$`<label class="charsheet__rest-option">
					${$cbConc}
					<span>🔮 Break Concentration (${concentration?.spellName || "unknown spell"})</span>
				</label>`.appendTo($condContainer);
			}
			
			// Conditions
			conditions.forEach(condition => {
				const $cb = $(`<input type="checkbox">`);
				$cb.on("change", () => {
					if ($cb.is(":checked")) conditionsToRemove.add(condition);
					else conditionsToRemove.delete(condition);
				});
				$$`<label class="charsheet__rest-option">
					${$cb}
					<span>⚠️ Remove: ${condition}</span>
				</label>`.appendTo($condContainer);
			});
		}

		// Render hit dice options
		const $hdContainer = $modalInner.find("#short-rest-hit-dice-container");
		if (!hitDice.length) {
			$hdContainer.append(`<p class="ve-muted ve-text-center">No hit dice available</p>`);
		} else {
			hitDice.forEach((hd, idx) => {
				// Track remaining locally for display
				let remaining = hd.current;
				const $remaining = $(`<span>${remaining}</span>`);
				const $btn = $(`<button class="ve-btn ve-btn-sm ve-btn-primary" ${hd.current <= 0 ? "disabled" : ""}>🎲 Roll</button>`);

				$btn.on("click", () => {
					if (remaining <= 0) {
						JqueryUtil.doToast({type: "warning", content: "No hit dice remaining!"});
						return;
					}

					const roll = this._page.rollDice(1, hd.die);
					const conMod = this._state.getAbilityMod("con");
					const healing = Math.max(1, roll + conMod);

					totalHealing += healing;
					remaining--;

					// Track spent by die type
					if (!spentDice[hd.type]) spentDice[hd.type] = 0;
					spentDice[hd.type]++;

					$remaining.text(remaining);
					$totalHealing.text(totalHealing);

					if (remaining <= 0) $btn.prop("disabled", true);

					JqueryUtil.doToast({
						type: "success",
						content: `🎲 Rolled d${hd.die} (${roll}) + CON (${conMod >= 0 ? "+" : ""}${conMod}) = ${healing} HP`,
					});
				});

				$$`<div class="charsheet__hit-die-row">
					<div class="charsheet__hit-die-info">
						<span class="charsheet__hit-die-class">${hd.className}:</span>
						<span class="charsheet__hit-die-die">d${hd.die}</span>
					</div>
					<span class="charsheet__hit-die-remaining">${$remaining} / ${hd.max} remaining</span>
					${$btn}
				</div>`.appendTo($hdContainer);
			});
		}

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary">✓ Finish Short Rest</button>`)
			.on("click", () => {
				// Apply hit dice spending using spentDice tracker
				Object.entries(spentDice).forEach(([dieType, count]) => {
					for (let i = 0; i < count; i++) {
						this._state.useHitDie(dieType);
					}
				});

				if (totalHealing > 0) {
					this._state.heal(totalHealing);
				}
				this._restoreResources("short");

				// Restore Warlock pact slots on short rest
				const pactSlots = this._state.getPactSlots();
				if (pactSlots && pactSlots.max > 0) {
					this._state.setPactSlotsCurrent(pactSlots.max);
				}

				// Remove selected conditions
				conditionsToRemove.forEach(condition => {
					this._state.removeCondition?.(condition);
				});

				// Break concentration if requested
				if (shouldBreakConcentration) {
					this._state.breakConcentration?.();
				}

				this._page.saveCharacter();
				this._page.renderCharacter();
				doClose(true);
				
				let message = `😴 Short rest complete!`;
				if (totalHealing > 0) message += ` Recovered ${totalHealing} HP.`;
				if (conditionsToRemove.size > 0) message += ` Removed ${conditionsToRemove.size} condition(s).`;
				if (shouldBreakConcentration) message += ` Broke concentration.`;
				
				JqueryUtil.doToast({
					type: "success",
					content: message,
				});
			});

		$$`<div class="charsheet__modal-footer">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);
	}

	async _showLongRestDialog () {
		const currentHp = this._state.getHp().current;
		const maxHp = this._state.getHp().max;
		const hitDice = this._state.getHitDice();
		const totalMaxHd = hitDice.reduce((sum, hd) => sum + hd.max, 0);
		const totalCurrentHd = hitDice.reduce((sum, hd) => sum + hd.current, 0);
		const currentExhaustion = this._state.getExhaustion();
		const newHdTotal = Math.min(totalMaxHd, totalCurrentHd + Math.max(1, Math.floor(totalMaxHd / 2)));
		const conditions = this._state.getConditionNames?.() || [];
		const isConcentrating = this._state.isConcentrating?.();
		const concentration = this._state.getConcentration?.();

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "🌙 Long Rest",
			isMinHeight0: true,
			isWidth100: true,
		});

		const $cbResetTempHp = $(`<input type="checkbox" checked>`);
		const $cbClearExhaustion = $(`<input type="checkbox" ${currentExhaustion > 0 ? "checked" : "disabled"}>`);
		const $cbBreakConcentration = isConcentrating ? $(`<input type="checkbox" checked>`) : null;

		// Track which conditions to remove
		const conditionsToRemove = new Set(conditions); // All checked by default for long rest
		const conditionCheckboxes = [];

		$$`<div class="charsheet__rest-modal">
			<div class="charsheet__rest-intro">
				<p class="mb-0">A long rest (typically 8 hours) restores all hit points and recovers spent Hit Dice.</p>
			</div>
			
			<div class="charsheet__rest-section">
				<div class="charsheet__rest-section-title">📊 Recovery Summary</div>
				<ul class="charsheet__rest-recovery-list">
					<li class="charsheet__rest-recovery-item">
						<span class="charsheet__rest-recovery-label">❤️ Hit Points</span>
						<div class="charsheet__rest-recovery-values">
							<span class="charsheet__rest-recovery-old">${currentHp}</span>
							<span class="charsheet__rest-recovery-arrow">→</span>
							<span class="charsheet__rest-recovery-new">${maxHp}</span>
							<span class="ve-muted">(full)</span>
						</div>
					</li>
					<li class="charsheet__rest-recovery-item">
						<span class="charsheet__rest-recovery-label">🎲 Hit Dice</span>
						<div class="charsheet__rest-recovery-values">
							<span class="charsheet__rest-recovery-old">${totalCurrentHd}/${totalMaxHd}</span>
							<span class="charsheet__rest-recovery-arrow">→</span>
							<span class="charsheet__rest-recovery-new">${newHdTotal}/${totalMaxHd}</span>
						</div>
					</li>
					<li class="charsheet__rest-recovery-item">
						<span class="charsheet__rest-recovery-label">✨ Spell Slots</span>
						<div class="charsheet__rest-recovery-values">
							<span class="charsheet__rest-recovery-new">All recovered</span>
						</div>
					</li>
					<li class="charsheet__rest-recovery-item">
						<span class="charsheet__rest-recovery-label">⚡ Class Resources</span>
						<div class="charsheet__rest-recovery-values">
							<span class="charsheet__rest-recovery-new">All recovered</span>
						</div>
					</li>
					${currentExhaustion > 0 ? `
					<li class="charsheet__rest-recovery-item">
						<span class="charsheet__rest-recovery-label">😫 Exhaustion</span>
						<div class="charsheet__rest-recovery-values">
							<span class="charsheet__rest-recovery-old">${currentExhaustion}</span>
							<span class="charsheet__rest-recovery-arrow">→</span>
							<span class="charsheet__rest-recovery-new">${currentExhaustion - 1}</span>
						</div>
					</li>
					` : ""}
				</ul>
			</div>
			
			<div class="charsheet__rest-section">
				<div class="charsheet__rest-section-title">⚙️ Options</div>
				<div class="charsheet__rest-options">
					<label class="charsheet__rest-option">
						${$cbResetTempHp}
						<span>Reset temporary HP to 0</span>
					</label>
					<label class="charsheet__rest-option ${currentExhaustion === 0 ? "charsheet__rest-option--disabled" : ""}">
						${$cbClearExhaustion}
						<span>Reduce exhaustion by 1 level ${currentExhaustion === 0 ? "(none to reduce)" : ""}</span>
					</label>
				</div>
			</div>
			
			${conditions.length > 0 || isConcentrating ? `
			<div class="charsheet__rest-section">
				<div class="charsheet__rest-section-title">🛡️ Conditions & Effects</div>
				<div class="charsheet__rest-options" id="long-rest-conditions-container">
					<p class="ve-muted ve-small mb-2">Conditions to remove during rest (uncheck to keep):</p>
				</div>
			</div>
			` : ""}
		</div>`.appendTo($modalInner);

		// Render condition checkboxes
		if (conditions.length > 0 || isConcentrating) {
			const $condContainer = $modalInner.find("#long-rest-conditions-container");
			
			// Concentration first
			if (isConcentrating) {
				$$`<label class="charsheet__rest-option">
					${$cbBreakConcentration}
					<span>🔮 Break Concentration (${concentration?.spellName || "unknown spell"})</span>
				</label>`.appendTo($condContainer);
			}
			
			// Conditions (checked by default for long rest)
			conditions.forEach(condition => {
				const $cb = $(`<input type="checkbox" checked>`);
				conditionCheckboxes.push({condition, $cb});
				$cb.on("change", () => {
					if ($cb.is(":checked")) conditionsToRemove.add(condition);
					else conditionsToRemove.delete(condition);
				});
				$$`<label class="charsheet__rest-option">
					${$cb}
					<span>⚠️ Remove: ${condition}</span>
				</label>`.appendTo($condContainer);
			});
		}

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary">🌙 Finish Long Rest</button>`)
			.on("click", () => {
				// Full HP recovery
				this._state.setHp(maxHp, maxHp, $cbResetTempHp.is(":checked") ? 0 : this._state.getHp().temp);

				// Recover half hit dice (minimum 1)
				hitDice.forEach(hd => {
					const recovery = Math.max(1, Math.floor(hd.max / 2));
					hd.current = Math.min(hd.max, hd.current + recovery);
				});
				this._state.setHitDice(hitDice);

				// Restore all spell slots
				for (let level = 1; level <= 9; level++) {
					const max = this._state.getSpellSlotsMax(level);
					if (max > 0) {
						this._state.setSpellSlots(level, max, max);
					}
				}

				// Restore Warlock pact slots on long rest as well
				const pactSlots = this._state.getPactSlots();
				if (pactSlots && pactSlots.max > 0) {
					this._state.setPactSlotsCurrent(pactSlots.max);
				}

				// Restore long-rest and short-rest resources
				this._restoreResources("long");

				// Clear one level of exhaustion using the dedicated exhaustion tracker
				if ($cbClearExhaustion.is(":checked")) {
					const currentExhaustion = this._state.getExhaustion();
					if (currentExhaustion > 0) {
						this._state.setExhaustion(currentExhaustion - 1);
					}
				}

				// Remove selected conditions
				conditionsToRemove.forEach(condition => {
					this._state.removeCondition?.(condition);
				});

				// Break concentration if requested
				if ($cbBreakConcentration?.is(":checked")) {
					this._state.breakConcentration?.();
				}

				// Reset death saves
				this._state.setDeathSaves({successes: 0, failures: 0});

				// Save changes
				this._page.saveCharacter();
				this._page.renderCharacter();

				doClose(true);

				let message = "🌙 Long rest complete! All resources restored.";
				if (conditionsToRemove.size > 0) message += ` Removed ${conditionsToRemove.size} condition(s).`;
				if ($cbBreakConcentration?.is(":checked")) message += ` Broke concentration.`;

				JqueryUtil.doToast({
					type: "success",
					content: message,
				});
			});

		$$`<div class="charsheet__modal-footer">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);
	}

	_restoreResources (restType) {
		// Restore class resources
		const resources = this._state.getResources();
		resources.forEach(resource => {
			if (restType === "long" || resource.recharge === "short") {
				// Use state method to persist the change
				this._state.setResourceCurrent(resource.id, resource.max);
			}
		});

		// Also restore feature uses
		const features = this._state.getFeatures();
		features.forEach(feature => {
			if (feature.uses) {
				if (restType === "long" || feature.uses.recharge === "short") {
					// Use state method to persist the change
					this._state.setFeatureUses(feature.id, feature.uses.max);
				}
			}
		});

		// Restore exertion (Combat Methods system) - recovers on both short and long rests
		if (this._state.usesCombatSystem?.()) {
			this._state.restoreExertion?.();
		}

		// Restore item charges
		const items = this._state.getItems();
		const restoredItems = [];
		items.forEach(item => {
			if (item.charges && item.recharge) {
				let shouldRestore = false;
				// Map recharge types to rest types
				if (restType === "long") {
					// Long rest restores items that recharge on long rest, dawn, dusk, or midnight
					shouldRestore = ["restLong", "dawn", "dusk", "midnight"].includes(item.recharge);
				} else if (restType === "short") {
					// Short rest only restores items that recharge on short rest
					shouldRestore = item.recharge === "restShort";
				}

				if (shouldRestore) {
					const currentCharges = item.chargesCurrent ?? 0;
					// Only restore if not already at max
					if (currentCharges < item.charges) {
						// Parse rechargeAmount - could be a dice expression like "{@dice 1d6 + 1}" or a number
						let rechargeAmount = item.charges; // Default to full restore
						if (item.rechargeAmount) {
							if (typeof item.rechargeAmount === "number") {
								rechargeAmount = item.rechargeAmount;
							} else if (typeof item.rechargeAmount === "string") {
								// Parse dice notation like "{@dice 1d6 + 1}" or "1d6+1"
								const diceMatch = item.rechargeAmount.match(/(\d+)d(\d+)\s*(?:\+\s*(\d+))?/i);
								if (diceMatch) {
									const numDice = parseInt(diceMatch[1]);
									const dieSize = parseInt(diceMatch[2]);
									const bonus = parseInt(diceMatch[3]) || 0;
									// Roll the dice
									let total = bonus;
									for (let i = 0; i < numDice; i++) {
										total += Math.floor(Math.random() * dieSize) + 1;
									}
									rechargeAmount = total;
								} else {
									// Try parsing as a plain number
									rechargeAmount = parseInt(item.rechargeAmount) || item.charges;
								}
							}
						}

						const newCharges = Math.min(currentCharges + rechargeAmount, item.charges);
						this._state.setItemCharges(item.id, newCharges);
						restoredItems.push({name: item.name, restored: newCharges - currentCharges, total: newCharges, max: item.charges});
					}
				}
			}
		});

		// Show toast for restored item charges
		if (restoredItems.length > 0) {
			const itemList = restoredItems.map(i => `${i.name}: +${i.restored} (${i.total}/${i.max})`).join(", ");
			JqueryUtil.doToast({
				type: "info",
				content: `Item charges restored: ${itemList}`,
			});
		}
	}
}

globalThis.CharacterSheetRest = CharacterSheetRest;

export {CharacterSheetRest};
