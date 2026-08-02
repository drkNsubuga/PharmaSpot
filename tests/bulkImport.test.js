// Mock the NeDB-backed modules before requiring inventoryBulk. The bulk
// module attaches side-effecting middleware at import time, and we want
// unit tests of the pure helpers to run without spinning up a real DB.
jest.mock("../api/inventory", () => ({
	inventoryDB: {},
	generateUniqueProductId: jest.fn(),
}));
jest.mock("../api/categories", () => ({
	categoryDB: {},
}));

const {
	validateRow,
	resolveCategories,
	dedupeInPayload,
	MAX_ROWS,
	DATE_FORMAT,
} = require("../api/inventoryBulk");

/** validateRow ---------------------------------------------------------------- */

describe("validateRow", () => {
	test("returns valid with all defaults when only required fields are present", () => {
		const result = validateRow(
			{ name: "Aspirin", barcode: "12345", price: "10" },
			2,
		);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.data).toMatchObject({
			name: "Aspirin",
			barcode: 12345,
			price: "10",
			quantity: "0",
			categoryName: null,
			supplier: "",
			expirationDate: "",
			minStock: "0",
			stock: 0,
		});
	});

	test("rejects when name is missing", () => {
		const result = validateRow(
			{ name: "", barcode: "1", price: "1" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("name is required");
		expect(result.data).toBeNull();
	});

	test("rejects when name exceeds 200 chars", () => {
		const result = validateRow(
			{ name: "x".repeat(201), barcode: "1", price: "1" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("name must be at most 200 characters");
	});

	test("rejects when barcode is missing", () => {
		const result = validateRow(
			{ name: "A", barcode: "", price: "1" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("barcode is required");
	});

	test("rejects when barcode is not an integer", () => {
		const result = validateRow(
			{ name: "A", barcode: "abc", price: "1" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("barcode must be an integer");
	});

	test("rejects when barcode is a float", () => {
		const result = validateRow(
			{ name: "A", barcode: "3.14", price: "1" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("barcode must be an integer");
	});

	test("rejects when price is missing", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("price is required");
	});

	test("rejects when price is negative", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "-5" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("price must be a non-negative number");
	});

	test("accepts price of zero", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "0" },
			2,
		);
		expect(result.valid).toBe(true);
	});

	test("rejects non-integer quantity", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "1", quantity: "abc" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("quantity must be a non-negative integer");
	});

	test("rejects stock values other than 0 or 1", () => {
		const r1 = validateRow(
			{ name: "A", barcode: "1", price: "1", stock: "2" },
			2,
		);
		expect(r1.valid).toBe(false);
		expect(r1.errors).toContain("stock must be 0 or 1");

		const r2 = validateRow(
			{ name: "A", barcode: "1", price: "1", stock: "-1" },
			2,
		);
		expect(r2.valid).toBe(false);
	});

	test("rejects expirationDate in wrong format", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "1", expirationDate: "2027-03-15" },
			2,
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			`expirationDate must be in ${DATE_FORMAT} format`,
		);
	});

	test("accepts expirationDate in DD-MMM-YYYY format", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "1", expirationDate: "15-Mar-2027" },
			2,
		);
		expect(result.valid).toBe(true);
		expect(result.data.expirationDate).toBe("15-Mar-2027");
	});

	test("row with all optional fields empty is valid with defaults", () => {
		const result = validateRow(
			{ name: "A", barcode: "42", price: "9.99" },
			2,
		);
		expect(result.valid).toBe(true);
		expect(result.data.quantity).toBe("0");
		expect(result.data.minStock).toBe("0");
		expect(result.data.stock).toBe(0);
		expect(result.data.categoryName).toBeNull();
	});

	test("passes through the line number unchanged", () => {
		const result = validateRow(
			{ name: "A", barcode: "1", price: "1" },
			17,
		);
		expect(result.line).toBe(17);
	});
});

/** resolveCategories --------------------------------------------------------- */

describe("resolveCategories", () => {
	test("matches existing category by exact name (case-insensitive)", () => {
		const rows = [validateRow(
			{ name: "A", barcode: "1", price: "1", category: "Analgesics" },
			2,
		)];
		const existing = [{ _id: 100, name: "Analgesics" }];
		const out = resolveCategories(rows, existing);
		expect(out[0].data.categoryId).toBe(100);
		expect(out[0].data.categoryWasCreated).toBe(false);
		expect(out[0].data.categoryName).toBe("Analgesics");
	});

	test("matches existing category with different case", () => {
		const rows = [validateRow(
			{ name: "A", barcode: "1", price: "1", category: "VITAMINS" },
			2,
		)];
		const existing = [{ _id: 200, name: "Vitamins" }];
		const out = resolveCategories(rows, existing);
		expect(out[0].data.categoryId).toBe(200);
		expect(out[0].data.categoryWasCreated).toBe(false);
	});

	test("auto-creates a new category when name is unknown", () => {
		const rows = [validateRow(
			{ name: "A", barcode: "1", price: "1", category: "First Aid" },
			2,
		)];
		const out = resolveCategories(rows, []);
		expect(out[0].data.categoryWasCreated).toBe(true);
		expect(typeof out[0].data.categoryId).toBe("number");
		expect(out[0].data.categoryId).toBeGreaterThan(0);
	});

	test("two rows with the same new category share an id", () => {
		const rows = [
			validateRow({ name: "A", barcode: "1", price: "1", category: "Vitamins" }, 2),
			validateRow({ name: "B", barcode: "2", price: "1", category: "vitamins" }, 3),
		];
		const out = resolveCategories(rows, []);
		expect(out[0].data.categoryId).toBe(out[1].data.categoryId);
		expect(out[0].data.categoryWasCreated).toBe(true);
		expect(out[1].data.categoryWasCreated).toBe(true);
	});

	test("null/empty category leaves categoryId absent and row valid", () => {
		const rows = [validateRow({ name: "A", barcode: "1", price: "1" }, 2)];
		const out = resolveCategories(rows, []);
		expect(out[0].valid).toBe(true);
		expect(out[0].data.categoryName).toBeNull();
		expect(out[0].data.categoryId).toBeUndefined();
		expect(out[0].data.categoryWasCreated).toBeUndefined();
	});

	test("skips invalid rows (does not crash on missing data)", () => {
		const rows = [
			{ line: 2, valid: false, errors: ["name is required"], data: null },
			validateRow({ name: "A", barcode: "1", price: "1", category: "X" }, 3),
		];
		const out = resolveCategories(rows, []);
		expect(out[0].valid).toBe(false);
		expect(out[1].data.categoryWasCreated).toBe(true);
	});
});

/** dedupeInPayload ----------------------------------------------------------- */

describe("dedupeInPayload", () => {
	test("first occurrence stays valid, second is flagged as duplicate", () => {
		const rows = [
			validateRow({ name: "A", barcode: "100", price: "1" }, 2),
			validateRow({ name: "B", barcode: "100", price: "1" }, 3),
		];
		const out = dedupeInPayload(rows);
		expect(out[0].valid).toBe(true);
		expect(out[1].valid).toBe(false);
		expect(out[1].errors).toContain("Duplicate barcode within file");
	});

	test("no duplicates leaves all rows valid", () => {
		const rows = [
			validateRow({ name: "A", barcode: "1", price: "1" }, 2),
			validateRow({ name: "B", barcode: "2", price: "1" }, 3),
			validateRow({ name: "C", barcode: "3", price: "1" }, 4),
		];
		const out = dedupeInPayload(rows);
		expect(out.every((r) => r.valid)).toBe(true);
	});

	test("handles two pairs of duplicates in a four-row file", () => {
		const rows = [
			validateRow({ name: "A", barcode: "1", price: "1" }, 2),
			validateRow({ name: "B", barcode: "1", price: "1" }, 3),
			validateRow({ name: "C", barcode: "2", price: "1" }, 4),
			validateRow({ name: "D", barcode: "2", price: "1" }, 5),
		];
		const out = dedupeInPayload(rows);
		expect(out[0].valid).toBe(true);
		expect(out[1].valid).toBe(false);
		expect(out[2].valid).toBe(true);
		expect(out[3].valid).toBe(false);
	});

	test("invalid rows are passed through untouched", () => {
		const rows = [
			{ line: 2, valid: false, errors: ["name is required"], data: null },
			validateRow({ name: "A", barcode: "1", price: "1" }, 3),
		];
		const out = dedupeInPayload(rows);
		expect(out[0].valid).toBe(false);
		expect(out[0].errors).toEqual(["name is required"]);
		expect(out[1].valid).toBe(true);
	});
});

/** constants ----------------------------------------------------------------- */

describe("module constants", () => {
	test("MAX_ROWS is 5000", () => {
		expect(MAX_ROWS).toBe(5000);
	});
	test("DATE_FORMAT is DD-MMM-YYYY", () => {
		expect(DATE_FORMAT).toBe("DD-MMM-YYYY");
	});
});
