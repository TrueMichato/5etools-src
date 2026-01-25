/**
 * Test Setup for Character Sheet Tests
 * Provides mocks for global utilities used by charactersheet-state.js
 */

// Add String.prototype.toTitleCase if not present
if (!String.prototype.toTitleCase) {
	String.prototype.toTitleCase = function () {
		return this.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
	};
}

// Mock RollerUtil before CryptUtil needs it
globalThis.RollerUtil = {
	isCrypto: () => typeof crypto !== "undefined" && crypto.getRandomValues,
};

// Mock CryptUtil.uid() for generating unique IDs
globalThis.CryptUtil = {
	uid: () => {
		// Simple UUID-like generator for tests
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
			const r = Math.random() * 16 | 0;
			const v = c === "x" ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	},
	md5: (s) => s, // Simple passthrough for tests
	hashCode: (obj) => {
		if (typeof obj === "string") {
			if (!obj) return 0;
			let h = 0;
			for (let i = 0; i < obj.length; ++i) h = 31 * h + obj.charCodeAt(i);
			return h;
		} else if (typeof obj === "number") return obj;
		return 0;
	},
};

// Mock Parser if needed
globalThis.Parser = globalThis.Parser || {
	ABIL_ABVS: ["str", "dex", "con", "int", "wis", "cha"],
	ATB_ABV_TO_FULL: {
		str: "Strength",
		dex: "Dexterity",
		con: "Constitution",
		int: "Intelligence",
		wis: "Wisdom",
		cha: "Charisma",
	},
	SRC_PHB: "PHB",
	SRC_XPHB: "XPHB",
	attAbvToFull: (abv) => globalThis.Parser.ATB_ABV_TO_FULL[abv] || abv,
	getAbilityModNumber: (score) => Math.floor((score - 10) / 2),
	spLevelToFull: (level) => {
		if (level === 0) return "Cantrip";
		const suffixes = ["st", "nd", "rd"];
		const suffix = level <= 3 ? suffixes[level - 1] : "th";
		return `${level}${suffix}`;
	},
	sourceJsonToAbv: (source) => source,
	sourceJsonToFull: (source) => source,
	getOrdinalForm: (n) => {
		const suffixes = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
	},
};

// Mock MiscUtil if needed
globalThis.MiscUtil = globalThis.MiscUtil || {
	copyFast: (obj) => JSON.parse(JSON.stringify(obj)),
	copy: (obj) => JSON.parse(JSON.stringify(obj)),
	getProperty: (obj, path) => {
		const parts = path.split(".");
		let current = obj;
		for (const part of parts) {
			if (current == null) return undefined;
			current = current[part];
		}
		return current;
	},
	setProperty: (obj, path, value) => {
		const parts = path.split(".");
		let current = obj;
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (current[part] == null) current[part] = {};
			current = current[part];
		}
		current[parts[parts.length - 1]] = value;
	},
};

// Mock StorageUtil if needed for serialization
globalThis.StorageUtil = globalThis.StorageUtil || {
	pGetForPage: async () => null,
	pSetForPage: async () => {},
	getForPage: () => null,
	setForPage: () => {},
};

// Mock Renderer if needed
globalThis.Renderer = globalThis.Renderer || {
	get: () => ({
		render: (entry) => typeof entry === "string" ? entry : JSON.stringify(entry),
		recursiveRender: (entry) => typeof entry === "string" ? entry : JSON.stringify(entry),
	}),
};

// Mock UrlUtil if needed
globalThis.UrlUtil = globalThis.UrlUtil || {
	autoEncodeHash: (it) => it?.name?.toLowerCase().replace(/\s+/g, "-") || "",
	PG_SPELLS: "spells.html",
	PG_ITEMS: "items.html",
};
