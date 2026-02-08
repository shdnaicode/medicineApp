(function () {
	"use strict";

	const STORAGE_KEY = "medicineapp.herbStock.v1";

	function normalize(text) {
		return String(text ?? "").trim().toLowerCase();
	}

	/** @returns {{name: string, part: string, weightBeforeDry: number|null}[]} */
	function loadHerbStock() {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	/** @param {{name: string, part: string, weightBeforeDry: number|null}[]} rows */
	function saveHerbStock(rows) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
	}

	/**
	 * Ensure localStorage has herb stock, using provided seed if empty.
	 * @param {{name: string, part: string, weightBeforeDry: number|null}[]} seed
	 */
	function ensureHerbStockSeed(seed) {
		const existing = loadHerbStock();
		if (existing.length > 0) return;
		if (Array.isArray(seed) && seed.length > 0) saveHerbStock(seed);
	}

	window.MedicineAppData = {
		normalize,
		loadHerbStock,
		saveHerbStock,
		ensureHerbStockSeed,
		STORAGE_KEY,
	};
})();
