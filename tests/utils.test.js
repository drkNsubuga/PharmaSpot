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
jest.mock("fs");
jest.mock("crypto");

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

// File tests
describe('checkImageExists', () => {
  // Mocking fs.accessSync to control its behavior during tests
 
  fs.accessSync = jest.fn();

  afterEach(() => {
    // Clear the mock implementation and mock calls after each test
    fs.accessSync.mockReset();
  });

  it('should return true if the image exists', () => {
    // Set up the mock to simulate a successful file access
    fs.accessSync.mockImplementation(() => {});

    const imageUrl = 'path/to/existing/image.jpg';
    const result = checkImageExists(imageUrl);

    expect(result).toBe(true);
    expect(fs.accessSync).toHaveBeenCalledWith(imageUrl, fs.constants.F_OK);
  });

  it('should return false if the image does not exist', () => {
    // Set up the mock to simulate a failed file access
    fs.accessSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const imageUrl = 'path/to/nonexistent/image.jpg';
    const result = checkImageExists(imageUrl);

    expect(result).toBe(false);
    expect(fs.accessSync).toHaveBeenCalledWith(imageUrl, fs.constants.F_OK);
  });
});


describe('getFileHash', () => {
  const filePath = 'test-file.txt';
  const fileData = 'Test file content';
  const hashValue = 'mocked-hash-value';

  beforeEach(() => {
    // Mock fs.readFileSync
    fs.readFileSync.mockReturnValue(fileData);

    // Mock crypto.createHash().update().digest()
    const digestMock = jest.fn(() => hashValue);
    const updateMock = jest.fn().mockReturnValue({ digest: digestMock });
    const createHashMock = jest.fn().mockReturnValue({ update: updateMock });
    crypto.createHash.mockReturnValue(createHashMock);
  });

  afterEach(() => {
    // Clear mock function calls after each test
    jest.clearAllMocks();
  });

  it('should read file and return hash', () => {
    const result = getFileHash(filePath);

    // Verify that fs.readFileSync is called with the correct file path
    expect(fs.readFileSync).toHaveBeenCalledWith(filePath);

    // Verify that crypto.createHash().update().digest() is called with the correct file data
    expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    expect(crypto.createHash().update).toHaveBeenCalledWith(fileData);
    expect(crypto.createHash().update().digest).toHaveBeenCalledWith('hex');

    // Verify that the result matches the mocked hash value
    expect(result).toEqual(hashValue);
  });
});