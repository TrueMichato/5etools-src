/**
 * Character Sheet Inventory - Unit Tests
 * Tests for item management, encumbrance, AC calculation, and attunement
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Inventory Management", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.addClass({name: "Fighter", source: "PHB", level: 5});
		state.setAbilityBase("str", 15); // 15 STR for encumbrance tests
		state.setAbilityBase("dex", 14);
	});

	// ==========================================================================
	// Basic Item Operations
	// ==========================================================================
	describe("Basic Item Operations", () => {
		it("should add an item to inventory", () => {
			state.addItem({
				name: "Longsword",
				source: "PHB",
				quantity: 1,
				weight: 3,
			});
			const items = state.getInventory();
			expect(items).toHaveLength(1);
			expect(items[0].name).toBe("Longsword");
		});

		it("should remove an item from inventory", () => {
			state.addItem({id: "item1", name: "Shield", source: "PHB", quantity: 1});
			state.removeItem("item1");
			expect(state.getInventory()).toHaveLength(0);
		});

		it("should update item quantity", () => {
			state.addItem({id: "item1", name: "Arrows", source: "PHB", quantity: 20});
			state.updateItemQuantity("item1", 15);
			expect(state.getInventory()[0].quantity).toBe(15);
		});

		it("should remove item when quantity reaches 0", () => {
			state.addItem({id: "item1", name: "Rations", source: "PHB", quantity: 5});
			state.updateItemQuantity("item1", 0);
			expect(state.getInventory()).toHaveLength(0);
		});

		it("should increase item quantity", () => {
			state.addItem({id: "item1", name: "Gold Pieces", source: "PHB", quantity: 50});
			state.changeItemQuantity("item1", 25);
			expect(state.getInventory()[0].quantity).toBe(75);
		});

		it("should decrease item quantity", () => {
			state.addItem({id: "item1", name: "Torches", source: "PHB", quantity: 10});
			state.changeItemQuantity("item1", -3);
			expect(state.getInventory()[0].quantity).toBe(7);
		});
	});

	// ==========================================================================
	// Equipment (Equip/Unequip)
	// ==========================================================================
	describe("Equipment", () => {
		it("should equip an item", () => {
			state.addItem({id: "item1", name: "Chain Mail", source: "PHB", equipped: false});
			state.equipItem("item1");
			expect(state.getInventory()[0].equipped).toBe(true);
		});

		it("should unequip an item", () => {
			state.addItem({id: "item1", name: "Plate Armor", source: "PHB", equipped: true});
			state.unequipItem("item1");
			expect(state.getInventory()[0].equipped).toBe(false);
		});

		it("should toggle equipped status", () => {
			state.addItem({id: "item1", name: "Leather Armor", source: "PHB", equipped: false});
			state.toggleEquipped("item1");
			expect(state.getInventory()[0].equipped).toBe(true);
			state.toggleEquipped("item1");
			expect(state.getInventory()[0].equipped).toBe(false);
		});

		it("should get all equipped items", () => {
			state.addItem({id: "item1", name: "Sword", equipped: true});
			state.addItem({id: "item2", name: "Bow", equipped: false});
			state.addItem({id: "item3", name: "Shield", equipped: true});
			const equipped = state.getEquippedItems();
			expect(equipped).toHaveLength(2);
		});
	});

	// ==========================================================================
	// Attunement
	// ==========================================================================
	describe("Attunement", () => {
		it("should attune to a magic item", () => {
			state.addItem({id: "item1", name: "Ring of Protection", requiresAttunement: true, attuned: false});
			state.attuneItem("item1");
			expect(state.getInventory()[0].attuned).toBe(true);
		});

		it("should unattune from a magic item", () => {
			state.addItem({id: "item1", name: "Cloak of Elvenkind", requiresAttunement: true, attuned: true});
			state.unattuneItem("item1");
			expect(state.getInventory()[0].attuned).toBe(false);
		});

		it("should count attuned items", () => {
			state.addItem({id: "item1", name: "Amulet", requiresAttunement: true, attuned: true});
			state.addItem({id: "item2", name: "Ring", requiresAttunement: true, attuned: true});
			state.addItem({id: "item3", name: "Sword", requiresAttunement: false, attuned: false});
			expect(state.getAttunedCount()).toBe(2);
		});

		it("should enforce attunement limit of 3", () => {
			state.addItem({id: "item1", name: "Item 1", requiresAttunement: true, attuned: true});
			state.addItem({id: "item2", name: "Item 2", requiresAttunement: true, attuned: true});
			state.addItem({id: "item3", name: "Item 3", requiresAttunement: true, attuned: true});
			state.addItem({id: "item4", name: "Item 4", requiresAttunement: true, attuned: false});

			const result = state.attuneItem("item4");
			expect(result).toBe(false);
			expect(state.getAttunedCount()).toBe(3);
		});

		it("should check if can attune more items", () => {
			state.addItem({id: "item1", name: "Item 1", requiresAttunement: true, attuned: true});
			expect(state.canAttuneMore()).toBe(true);

			state.addItem({id: "item2", name: "Item 2", requiresAttunement: true, attuned: true});
			state.addItem({id: "item3", name: "Item 3", requiresAttunement: true, attuned: true});
			expect(state.canAttuneMore()).toBe(false);
		});

		it("should get all attuned items", () => {
			state.addItem({id: "item1", name: "Ring", requiresAttunement: true, attuned: true});
			state.addItem({id: "item2", name: "Amulet", requiresAttunement: true, attuned: false});
			state.addItem({id: "item3", name: "Cloak", requiresAttunement: true, attuned: true});
			const attuned = state.getAttunedItems();
			expect(attuned).toHaveLength(2);
		});
	});

	// ==========================================================================
	// Encumbrance
	// ==========================================================================
	describe("Encumbrance", () => {
		it("should calculate total inventory weight", () => {
			state.addItem({name: "Longsword", weight: 3, quantity: 1});
			state.addItem({name: "Shield", weight: 6, quantity: 1});
			state.addItem({name: "Arrows", weight: 1, quantity: 20}); // 20 arrows = 1 lb per 20
			expect(state.getTotalWeight()).toBe(10); // 3 + 6 + 1
		});

		it("should multiply weight by quantity", () => {
			state.addItem({name: "Daggers", weight: 1, quantity: 5});
			expect(state.getTotalWeight()).toBe(5);
		});

		it("should calculate carrying capacity (15 x STR)", () => {
			// STR 15 = 225 lb capacity
			expect(state.getCarryingCapacity()).toBe(225);
		});

		it("should calculate encumbered threshold (5 x STR)", () => {
			// STR 15 = 75 lb before encumbered
			expect(state.getEncumberedThreshold()).toBe(75);
		});

		it("should calculate heavily encumbered threshold (10 x STR)", () => {
			// STR 15 = 150 lb before heavily encumbered
			expect(state.getHeavilyEncumberedThreshold()).toBe(150);
		});

		it("should detect encumbered status", () => {
			state.addItem({name: "Heavy Load", weight: 80, quantity: 1});
			expect(state.isEncumbered()).toBe(true);
		});

		it("should detect heavily encumbered status", () => {
			state.addItem({name: "Heavy Load", weight: 160, quantity: 1});
			expect(state.isHeavilyEncumbered()).toBe(true);
		});

		it("should not be encumbered under threshold", () => {
			state.addItem({name: "Light Load", weight: 50, quantity: 1});
			expect(state.isEncumbered()).toBe(false);
		});

		it("should get encumbrance level", () => {
			expect(state.getEncumbranceLevel()).toBe("none");

			state.addItem({name: "Load 1", weight: 80, quantity: 1});
			expect(state.getEncumbranceLevel()).toBe("encumbered");

			state.addItem({name: "Load 2", weight: 80, quantity: 1});
			expect(state.getEncumbranceLevel()).toBe("heavily encumbered");
		});
	});

	// ==========================================================================
	// Armor and AC
	// ==========================================================================
	describe("Armor and AC", () => {
		it("should update AC when equipping light armor", () => {
			state.addItem({
				id: "armor1",
				name: "Leather Armor",
				type: "light armor",
				ac: 11,
				equipped: false,
			});
			state.equipItem("armor1");
			state.setArmor({name: "Leather Armor", ac: 11, type: "light"});
			// AC = 11 + DEX (14 = +2) = 13
			expect(state.getAC()).toBe(13);
		});

		it("should cap DEX bonus for medium armor", () => {
			state.setAbilityBase("dex", 18); // +4 DEX
			state.setArmor({name: "Half Plate", ac: 15, type: "medium"});
			// AC = 15 + 2 (max DEX for medium) = 17
			expect(state.getAC()).toBe(17);
		});

		it("should ignore DEX for heavy armor", () => {
			state.setAbilityBase("dex", 18); // +4 DEX (ignored)
			state.setArmor({name: "Plate", ac: 18, type: "heavy"});
			expect(state.getAC()).toBe(18);
		});

		it("should add shield bonus", () => {
			state.setArmor({name: "Chain Mail", ac: 16, type: "heavy"});
			state.setShield(true);
			expect(state.getAC()).toBe(18);
		});

		it("should handle magic armor bonus", () => {
			state.setArmor({name: "Plate +1", ac: 18, type: "heavy", bonus: 1});
			expect(state.getAC()).toBe(19);
		});

		it("should handle magic shield bonus", () => {
			state.setArmor({name: "Chain Mail", ac: 16, type: "heavy"});
			state.setShield(true, 2); // +2 Shield
			expect(state.getAC()).toBe(20);
		});

		it("should track when armor is equipped", () => {
			expect(state.isWearingArmor()).toBe(false);
			state.setArmor({name: "Leather", ac: 11, type: "light"});
			expect(state.isWearingArmor()).toBe(true);
		});

		it("should track when shield is equipped", () => {
			expect(state.isUsingShield()).toBe(false);
			state.setShield(true);
			expect(state.isUsingShield()).toBe(true);
		});
	});

	// ==========================================================================
	// Currency
	// ==========================================================================
	describe("Currency", () => {
		it("should initialize currency to 0", () => {
			const currency = state.getCurrency();
			expect(currency.cp).toBe(0);
			expect(currency.sp).toBe(0);
			expect(currency.ep).toBe(0);
			expect(currency.gp).toBe(0);
			expect(currency.pp).toBe(0);
		});

		it("should set currency amounts", () => {
			state.setCurrency({gp: 100, sp: 50, cp: 25});
			const currency = state.getCurrency();
			expect(currency.gp).toBe(100);
			expect(currency.sp).toBe(50);
			expect(currency.cp).toBe(25);
		});

		it("should add currency", () => {
			state.setCurrency({gp: 50});
			state.addCurrency("gp", 25);
			expect(state.getCurrency().gp).toBe(75);
		});

		it("should subtract currency", () => {
			state.setCurrency({gp: 100});
			state.subtractCurrency("gp", 30);
			expect(state.getCurrency().gp).toBe(70);
		});

		it("should not go below 0", () => {
			state.setCurrency({gp: 10});
			state.subtractCurrency("gp", 50);
			expect(state.getCurrency().gp).toBe(0);
		});

		it("should calculate total wealth in GP", () => {
			state.setCurrency({pp: 1, gp: 10, ep: 2, sp: 10, cp: 100});
			// 1 pp = 10 gp, 2 ep = 1 gp, 10 sp = 1 gp, 100 cp = 1 gp
			// Total = 10 + 10 + 1 + 1 + 1 = 23 gp
			expect(state.getTotalWealthInGP()).toBe(23);
		});

		it("should calculate currency weight", () => {
			// 50 coins = 1 lb
			state.setCurrency({gp: 100}); // 100 coins = 2 lb
			expect(state.getCurrencyWeight()).toBe(2);
		});
	});

	// ==========================================================================
	// Item Charges
	// ==========================================================================
	describe("Item Charges", () => {
		it("should track item charges", () => {
			state.addItem({
				id: "item1",
				name: "Wand of Magic Missiles",
				charges: {current: 7, max: 7},
			});
			const item = state.getInventory()[0];
			expect(item.charges.current).toBe(7);
			expect(item.charges.max).toBe(7);
		});

		it("should use item charge", () => {
			state.addItem({
				id: "item1",
				name: "Staff of Fire",
				charges: {current: 10, max: 10},
			});
			state.useItemCharge("item1", 3);
			expect(state.getInventory()[0].charges.current).toBe(7);
		});

		it("should not use more charges than available", () => {
			state.addItem({
				id: "item1",
				name: "Rod of Wonder",
				charges: {current: 2, max: 10},
			});
			const result = state.useItemCharge("item1", 5);
			expect(result).toBe(false);
		});

		it("should restore item charges", () => {
			state.addItem({
				id: "item1",
				name: "Wand of Fireballs",
				charges: {current: 2, max: 7},
			});
			state.restoreItemCharges("item1", 3);
			expect(state.getInventory()[0].charges.current).toBe(5);
		});

		it("should not exceed max charges", () => {
			state.addItem({
				id: "item1",
				name: "Decanter of Endless Water",
				charges: {current: 5, max: 7},
			});
			state.restoreItemCharges("item1", 10);
			expect(state.getInventory()[0].charges.current).toBe(7);
		});
	});

	// ==========================================================================
	// Item Bonuses
	// ==========================================================================
	describe("Item Bonuses", () => {
		it("should apply AC bonus from equipped magic items", () => {
			state.addItem({
				id: "item1",
				name: "Ring of Protection",
				requiresAttunement: true,
				attuned: true,
				equipped: true,
				bonusAc: 1,
			});
			// This would be checked through getAC calculations
			expect(state.getItemBonus("ac")).toBeGreaterThanOrEqual(1);
		});

		it("should apply saving throw bonus from attuned items", () => {
			state.addItem({
				id: "item1",
				name: "Cloak of Protection",
				requiresAttunement: true,
				attuned: true,
				bonusSavingThrow: 1,
			});
			expect(state.getItemBonus("savingThrow")).toBeGreaterThanOrEqual(1);
		});

		it("should only apply bonus when attuned (if required)", () => {
			state.addItem({
				id: "item1",
				name: "Ring of Protection",
				requiresAttunement: true,
				attuned: false,
				bonusAc: 1,
			});
			// Not attuned, bonus should not apply
			expect(state.getItemBonus("ac")).toBe(0);
		});
	});

	// ==========================================================================
	// Item Filtering and Searching
	// ==========================================================================
	describe("Item Filtering", () => {
		beforeEach(() => {
			state.addItem({id: "1", name: "Longsword", type: "weapon", equipped: true});
			state.addItem({id: "2", name: "Chain Mail", type: "armor", equipped: true});
			state.addItem({id: "3", name: "Healing Potion", type: "potion", equipped: false});
			state.addItem({id: "4", name: "Dagger", type: "weapon", equipped: false});
		});

		it("should filter by type", () => {
			const weapons = state.getItemsByType("weapon");
			expect(weapons).toHaveLength(2);
		});

		it("should filter by equipped status", () => {
			const equipped = state.getEquippedItems();
			expect(equipped).toHaveLength(2);
		});

		it("should search by name", () => {
			const results = state.searchItems("sword");
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Longsword");
		});

		it("should search case-insensitively", () => {
			const results = state.searchItems("CHAIN");
			expect(results).toHaveLength(1);
		});
	});
});
