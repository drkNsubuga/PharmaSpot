const moment = require("moment");
const fs = require("fs");
const crypto = require("crypto");
const {
	DATE_FORMAT,
	moneyFormat,
	isExpired,
	daysToExpire,
	checkImageExists,
	getFileHash,
} = require("../assets/js/utils");

//Mock fs and crypto for controlled testig
// jest.mock("fs");
// jest.mock("crypto");

describe("moneyFormat", () => {
	test("formats currency correctly", () => {
		expect(moneyFormat(1234.56)).toBe("1,234.56");
		expect(moneyFormat(1234.56, "de-DE")).toBe("1.234,56");
	});
});

/** DATE FUNCTIONS **/

// Mock today's date
jest.mock("moment", () => {
	const mockMoment = jest.requireActual("moment");
	return (date) => (date ? mockMoment(date) : mockMoment("2023-12-23"));
});

describe("daysToExpire", () => {
	test("returns positive difference when expiry date is in the future", () => {
		const dueDate = "2023-12-25";
		const result = daysToExpire(dueDate);
		expect(result).toBe(2);
	});

	test("returns 0 when expiry date is today", () => {
		const dueDate = "2023-12-23";
		const result = daysToExpire(dueDate);
		expect(result).toBe(0);
	});

	test("returns 0 when expiry date is in the past", () => {
		const dueDate = "2023-12-20";
		const result = daysToExpire(dueDate);
		expect(result).toBe(0);
	});
});

// Test if product is Expired
describe("isExpired", () => {
	test("returns false when due date is in the future", () => {
		const dueDate = "2023-12-25";
		const result = isExpired(dueDate, DATE_FORMAT);
		expect(result).toBe(false);
	});

	test("returns true when due date is today", () => {
		const dueDate = "2023-12-23";
		const result = isExpired(dueDate, DATE_FORMAT);
		expect(result).toBe(true);
	});

	test("returns true when due date is in the past", () => {
		const dueDate = "2023-12-20";
		const result = isExpired(dueDate, DATE_FORMAT);
		expect(result).toBe(true);
	});
});

// describe("checkImageExists", () => {
// 	test("returns true for existing image", () => {
// 		fs.accessSync.mockReturnValue(true);
// 		expect(checkImageExists("../assets/images/default.jpg")).toBe(true);
// 	});

// 	test("returns false for non-existent image", () => {
// 		fs.accessSync.mockRejectedValue(new Error());
// 		expect(checkImageExists("invalid/path")).toBe(false);
// 	});
// });

// describe("getFileHash", () => {
// 	test("generates SHA-256 hash", () => {
// 		const mockFileData = Buffer.from("test data");
// 		crypto.createHash.mockReturnValue({
// 			update: jest.fn(),
// 			digest: jest.fn().mockReturnValue("mock-hash"),
// 		});
// 		fs.readFileSync.mockReturnValue(mockFileData);

// 		expect(getFileHash("../assets/images/default.jpg")).toBe("mock-hash");
// 	});
// });