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

		if (currentHp >= maxHp && !availableHitDice.length) {
			JqueryUtil.doToast({type: "info", content: "You're already at full health with no hit dice to spend."});
			return;
		}

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Short Rest",
			isMinHeight0: true,
		});

		let totalHealing = 0;
		// Track spent dice by type
		const spentDice = {};

		const $totalHealing = $(`<span class="bold">0</span>`);

		$$`<div>
			<p>During a short rest, you can spend hit dice to recover hit points.</p>
			<p class="ve-muted">Current HP: ${currentHp}/${maxHp}</p>
			
			<div class="mt-3">
				<h5>Available Hit Dice</h5>
				<div id="short-rest-hit-dice-container"></div>
			</div>
			
			<div class="mt-3">
				<h5>Healing</h5>
				<p>Total healing: ${$totalHealing} HP</p>
			</div>
		</div>`.appendTo($modalInner);

		// Render hit dice options
		const $hdContainer = $modalInner.find("#short-rest-hit-dice-container");
		if (!hitDice.length) {
			$hdContainer.append(`<p class="ve-muted">No hit dice available</p>`);
		} else {
			hitDice.forEach((hd, idx) => {
				// Track remaining locally for display
				let remaining = hd.current;
				const $remaining = $(`<span>${remaining}</span>`);
				const $btn = $(`<button class="ve-btn ve-btn-sm ve-btn-primary" ${hd.current <= 0 ? "disabled" : ""}>Roll d${hd.die}</button>`);

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
						content: `Rolled d${hd.die} + ${conMod} = ${healing} HP`,
					});
				});

				$$`<div class="ve-flex-v-center mb-2">
					<span style="width: 120px;">${hd.className}: d${hd.die}</span>
					<span class="mr-2">${$remaining}/${hd.max}</span>
					${$btn}
				</div>`.appendTo($hdContainer);
			});
		}

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary">Finish Short Rest</button>`)
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
				this._page.saveCharacter();
				this._page.renderCharacter();
				doClose(true);
				JqueryUtil.doToast({
					type: "success",
					content: `Short rest complete! Recovered ${totalHealing} HP.`,
				});
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
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

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Long Rest",
			isMinHeight0: true,
		});

		const $cbResetTempHp = $(`<input type="checkbox" checked class="mr-2">`);
		const $cbClearExhaustion = $(`<input type="checkbox" checked class="mr-2">`);

		$$`<div>
			<p>A long rest restores all hit points and recovers half your total hit dice (minimum 1).</p>
			
			<div class="charsheet__section">
				<h5>Recovery Summary</h5>
				<ul>
					<li>HP: ${currentHp} → <strong>${maxHp}</strong> (full)</li>
					<li>Hit Dice: ${totalCurrentHd}/${totalMaxHd} → <strong>${Math.min(totalMaxHd, totalCurrentHd + Math.max(1, Math.floor(totalMaxHd / 2)))}/${totalMaxHd}</strong></li>
					<li>Spell Slots: All recovered</li>
					<li>Class Resources: All recovered</li>
				</ul>
			</div>
			
			<div class="charsheet__section mt-3">
				<h5>Additional Options</h5>
				<label class="ve-flex-v-center">
					${$cbResetTempHp}
					Reset temporary HP to 0
				</label>
				<label class="ve-flex-v-center mt-1">
					${$cbClearExhaustion}
					Clear exhaustion (1 level)
				</label>
			</div>
		</div>`.appendTo($modalInner);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary">Finish Long Rest</button>`)
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

				// Restore long-rest and short-rest resources
				this._restoreResources("long");

				// Clear one level of exhaustion
				if ($cbClearExhaustion.is(":checked")) {
					const conditions = this._state.getConditions();
					const exhaustionIdx = conditions.findIndex(c => c.toLowerCase().includes("exhaustion"));
					if (exhaustionIdx >= 0) {
						const match = conditions[exhaustionIdx].match(/exhaustion\s*(\d+)?/i);
						if (match) {
							const level = parseInt(match[1]) || 1;
							if (level <= 1) {
								conditions.splice(exhaustionIdx, 1);
							} else {
								conditions[exhaustionIdx] = `Exhaustion ${level - 1}`;
							}
							this._state.setConditions(conditions);
						}
					}
				}

				// Reset death saves
				this._state.setDeathSaves({successes: 0, failures: 0});

				// Save changes
				this._page.saveCharacter();
				this._page.renderCharacter();

				doClose(true);

				JqueryUtil.doToast({
					type: "success",
					content: "Long rest complete! All resources restored.",
				});
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
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
