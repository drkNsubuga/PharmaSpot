// SECURITY: Per the 2026-08 audit, this endpoint should be moved behind auth
// middleware once available. It currently inherits the same unauthenticated
// state as the rest of the /api/* surface.
//
// Bulk product import via CSV. Two-step UX: clients first call /bulk/preview
// to validate + resolve categories server-side, then /bulk/import to commit
// only the rows the user explicitly confirmed. This keeps the preview path
// side-effect-free and the import path the only place that writes to disk.

const app = require("express")();
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const async = require("async");
const validator = require("validator");
const moment = require("moment");
const { parse } = require("csv-parse/sync");

const inventoryApp = require("./inventory");
const categoriesApp = require("./categories");

const inventoryDB = inventoryApp.inventoryDB;
const generateUniqueProductId = inventoryApp.generateUniqueProductId;
const categoryDB = categoriesApp.categoryDB;

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;

// Limits and column schema (also re-exported for tests).
const MAX_ROWS = 5000;
const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB
const DATE_FORMAT = "DD-MMM-YYYY";
const TEMPLATE_FILENAME = "products_template.csv";

app.use(bodyParser.json());

// Ensure the CSV upload directory exists. Skip if env vars are absent
// (e.g. unit tests loading this module without server.js having set them).
const csvUploadDir = path.join(appData || "", appName || "", "uploads", "csv");
if (appData && appName) {
    try { fs.mkdirSync(csvUploadDir, { recursive: true }); } catch (_) {}
}

// Multer config: server-chosen filename (no path-traversal surface), CSV-only
// fileFilter, single 5MB cap. fileFilter rejects on extension mismatch; a
// renamed .txt will not pass.
const csvStorage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, csvUploadDir);
    },
    filename: function (req, file, callback) {
        const ext = path.extname(file.originalname).toLowerCase();
        const rand = Math.floor(Math.random() * 1e9).toString(36);
        callback(null, `bulk_${Date.now()}_${rand}${ext}`);
    },
});

const csvFilter = function (req, file, callback) {
    const okExt = path.extname(file.originalname).toLowerCase() === ".csv";
    if (!okExt) {
        return callback(new Error("Only .csv files are allowed."));
    }
    callback(null, true);
};

const csvUpload = multer({
    storage: csvStorage,
    limits: { fileSize: MAX_CSV_BYTES, files: 1 },
    fileFilter: csvFilter,
}).single("csvfile");

// ---- Pure helpers (exported for unit tests) --------------------------------

/**
 * Parse a value as a finite number, returning null on failure or empty input.
 */
function parseNumeric(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Parse a value as an integer, returning null on non-integer / non-numeric input.
 */
function parseInteger(value) {
    const n = parseNumeric(value);
    if (n === null) return null;
    if (!Number.isInteger(n)) return null;
    return n;
}

/**
 * Validate a single parsed CSV row. Returns { line, valid, errors, data }.
 * `data` is non-null only when `valid` is true.
 */
function validateRow(row, lineNo) {
    const errors = [];

    // name (required, max 200)
    const name = String(row.name || "").trim();
    if (!name) errors.push("name is required");
    if (name.length > 200) errors.push("name must be at most 200 characters");

    // barcode (required, integer)
    const barcodeRaw = String(row.barcode == null ? "" : row.barcode).trim();
    let barcode = null;
    if (!barcodeRaw) {
        errors.push("barcode is required");
    } else {
        barcode = parseInteger(barcodeRaw);
        if (barcode === null) errors.push("barcode must be an integer");
    }

    // price (required, non-negative)
    const priceRaw = String(row.price == null ? "" : row.price).trim();
    let price = null;
    if (!priceRaw) {
        errors.push("price is required");
    } else {
        price = parseNumeric(priceRaw);
        if (price === null || price < 0) errors.push("price must be a non-negative number");
    }

    // quantity (optional, integer, default "0")
    const quantityRaw = String(row.quantity == null ? "" : row.quantity).trim();
    let quantity = "0";
    if (quantityRaw !== "") {
        const q = parseInteger(quantityRaw);
        if (q === null || q < 0) {
            errors.push("quantity must be a non-negative integer");
        } else {
            quantity = String(q);
        }
    }

    // category (optional name, max 80)
    const category = String(row.category || "").trim();
    if (category.length > 80) errors.push("category must be at most 80 characters");

    // supplier (optional, max 200)
    const supplier = String(row.supplier || "").trim();
    if (supplier.length > 200) errors.push("supplier must be at most 200 characters");

    // expirationDate (optional, strict DD-MMM-YYYY)
    const expirationDate = String(row.expirationDate || "").trim();
    if (expirationDate) {
        const m = moment(expirationDate, DATE_FORMAT, true);
        if (!m.isValid()) errors.push(`expirationDate must be in ${DATE_FORMAT} format`);
    }

    // minStock (optional, integer, default "0")
    const minStockRaw = String(row.minStock == null ? "" : row.minStock).trim();
    let minStock = "0";
    if (minStockRaw !== "") {
        const m = parseInteger(minStockRaw);
        if (m === null || m < 0) {
            errors.push("minStock must be a non-negative integer");
        } else {
            minStock = String(m);
        }
    }

    // stock (optional, 0 or 1, default 0)
    const stockRaw = String(row.stock == null ? "" : row.stock).trim();
    let stock = 0;
    if (stockRaw !== "") {
        const s = parseInteger(stockRaw);
        if (s === null || (s !== 0 && s !== 1)) {
            errors.push("stock must be 0 or 1");
        } else {
            stock = s;
        }
    }

    const valid = errors.length === 0;
    return {
        line: lineNo,
        valid,
        errors,
        data: valid ? {
            name,
            barcode,
            price: String(price),
            quantity,
            categoryName: category || null,
            supplier,
            expirationDate,
            minStock,
            stock,
        } : null,
    };
}

/**
 * Resolve category names to IDs on the validated rows. New categories are
 * allocated sequential IDs starting from `Math.floor(Date.now() / 1000)`. The
 * same name (case-insensitive) gets the same generated ID within a single
 * call. Mutates and returns the rows.
 */
function resolveCategories(rows, existingCategories) {
    const byName = new Map();
    for (const cat of existingCategories) {
        if (cat && cat.name != null) {
            byName.set(String(cat.name).toLowerCase(), cat);
        }
    }

    const newCategories = new Map(); // lowercase name -> new id
    let nextId = Math.floor(Date.now() / 1000);

    return rows.map((row) => {
        if (!row.valid || !row.data || !row.data.categoryName) {
            return row;
        }
        const name = row.data.categoryName;
        const lower = name.toLowerCase();
        const existing = byName.get(lower);
        if (existing) {
            row.data.categoryId = existing._id;
            row.data.categoryName = existing.name;
            row.data.categoryWasCreated = false;
        } else if (newCategories.has(lower)) {
            row.data.categoryId = newCategories.get(lower);
            row.data.categoryWasCreated = true;
        } else {
            const newId = nextId++;
            newCategories.set(lower, newId);
            row.data.categoryId = newId;
            row.data.categoryWasCreated = true;
        }
        return row;
    });
}

/**
 * Dedupe barcodes within the payload. The first valid occurrence of each
 * barcode stays valid; subsequent matches are flagged invalid with an error.
 * Runs before the DB write so the per-line error report is complete.
 */
function dedupeInPayload(rows) {
    const seen = new Set();
    return rows.map((row) => {
        if (!row.valid || !row.data) return row;
        const bc = row.data.barcode;
        if (seen.has(bc)) {
            return {
                ...row,
                valid: false,
                errors: [...(row.errors || []), "Duplicate barcode within file"],
            };
        }
        seen.add(bc);
        return row;
    });
}

// ---- Routes ----------------------------------------------------------------

/**
 * POST /api/inventory/bulk/preview
 * Multipart CSV upload. Parses, validates, resolves categories. Returns a
 * preview payload with per-row validation results. Does NOT write to disk
 * (the uploaded file is deleted after parse). Does NOT insert categories
 * or products. Categories that will be created on import are listed in
 * `categoriesToCreate`.
 */
app.post("/bulk/preview", function (req, res) {
    csvUpload(req, res, function (err) {
        if (err) {
            const status = err instanceof multer.MulterError ? 400 : 400;
            return res.status(status).json({
                error: "Upload Error",
                message: err.message || "File upload failed.",
            });
        }
        if (!req.file) {
            return res.status(400).json({
                error: "Bad Request",
                message: "CSV file is required (form field 'csvfile').",
            });
        }

        // Read then delete the file. Preview is stateless.
        let raw;
        try {
            raw = fs.readFileSync(req.file.path, "utf8");
        } catch (readErr) {
            return res.status(500).json({
                error: "Internal Server Error",
                message: "Failed to read uploaded file.",
            });
        } finally {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }

        if (!raw || !raw.trim()) {
            return res.status(400).json({
                error: "Bad Request",
                message: "CSV is empty.",
            });
        }

        // Parse CSV. strict mode: row widths must match header width.
        let records;
        try {
            records = parse(raw, {
                columns: true,
                trim: true,
                skip_empty_lines: true,
                relax_column_count: false,
            });
        } catch (parseErr) {
            return res.status(400).json({
                error: "Parse Error",
                message: parseErr.message || "Failed to parse CSV.",
            });
        }

        if (records.length === 0) {
            return res.status(400).json({
                error: "Bad Request",
                message: "CSV is empty or has no header row.",
            });
        }
        if (records.length > MAX_ROWS) {
            return res.status(400).json({
                error: "Bad Request",
                message: `CSV exceeds ${MAX_ROWS}-row limit.`,
            });
        }

        // Validate each row. lineNo is 2-indexed (header is line 1).
        const validated = records.map((r, i) => validateRow(r, i + 2));

        // Load existing categories and resolve.
        categoryDB.find({}, function (catErr, existingCategories) {
            if (catErr) {
                return res.status(500).json({
                    error: "Internal Server Error",
                    message: "Failed to load categories.",
                });
            }

            const withCategories = resolveCategories(validated, existingCategories);
            const deduped = dedupeInPayload(withCategories);

            const total = deduped.length;
            const valid = deduped.filter((r) => r.valid).length;
            const invalid = total - valid;

            const categoriesToCreate = [];
            const seenNew = new Set();
            for (const row of deduped) {
                if (row.valid && row.data && row.data.categoryWasCreated) {
                    const name = row.data.categoryName;
                    const lower = String(name).toLowerCase();
                    if (!seenNew.has(lower)) {
                        seenNew.add(lower);
                        categoriesToCreate.push(name);
                    }
                }
            }

            res.json({
                summary: { total, valid, invalid, categoriesToCreate: categoriesToCreate.length },
                categoriesToCreate,
                rows: deduped,
            });
        });
    });
});

/**
 * POST /api/inventory/bulk/import
 * JSON body: { rows: [...previously-previewed valid rows...] }.
 * Re-checks barcode uniqueness against the current DB. Auto-creates any
 * categories flagged in preview. Inserts each valid row. Returns per-row
 * outcomes.
 */
app.post("/bulk/import", function (req, res) {
    if (!req.body || !Array.isArray(req.body.rows)) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Body must be { rows: [...] }",
        });
    }

    const rows = req.body.rows;
    if (rows.length === 0) {
        return res.status(400).json({
            error: "Bad Request",
            message: "rows array is empty.",
        });
    }
    if (rows.length > MAX_ROWS) {
        return res.status(400).json({
            error: "Bad Request",
            message: `rows exceeds ${MAX_ROWS}-row limit.`,
        });
    }

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r || typeof r.name !== "string" || typeof r.barcode !== "number") {
            return res.status(400).json({
                error: "Bad Request",
                message: `Row ${i + 1} is missing required 'name' or 'barcode'.`,
            });
        }
    }

    const inPayloadBarcodes = rows.map((r) => r.barcode);

    // Re-check uniqueness at commit time. NeDB has no multi-doc transactions,
    // so this is the only honest contract: best-effort skip, never overwrite.
    inventoryDB.find(
        { barcode: { $in: inPayloadBarcodes } },
        function (findErr, existing) {
            if (findErr) {
                return res.status(500).json({
                    error: "Internal Server Error",
                    message: "Failed to query inventory.",
                });
            }

            const existingBarcodes = new Set(existing.map((e) => e.barcode));

            // Collect unique categories to create.
            const categoriesToCreate = new Map(); // id -> name
            for (const r of rows) {
                if (r.categoryWasCreated && r.categoryId != null && r.categoryName) {
                    if (!categoriesToCreate.has(r.categoryId)) {
                        categoriesToCreate.set(r.categoryId, r.categoryName);
                    }
                }
            }
            const categoryInsertOps = [];
            for (const [id, name] of categoriesToCreate) {
                categoryInsertOps.push({ _id: id, name });
            }

            async.series([
                function (cb) {
                    // Insert each new category. uniqueViolated (a different
                    // process inserted the same id between preview and import)
                    // is treated as a no-op.
                    async.eachSeries(categoryInsertOps, function (cat, eachCb) {
                        categoryDB.insert(cat, function (insErr) {
                            if (insErr && insErr.errorType === "uniqueViolated") {
                                return eachCb(null);
                            }
                            eachCb(insErr);
                        });
                    }, cb);
                },
                function (cb) {
                    let inserted = 0;
                    let skipped = 0;
                    const errors = [];
                    let idx = 0;

                    async.eachSeries(rows, function (row, rowCb) {
                        idx++;
                        if (existingBarcodes.has(row.barcode)) {
                            skipped++;
                            return rowCb();
                        }
                        existingBarcodes.add(row.barcode);

                        generateUniqueProductId(function (idErr, productId) {
                            if (idErr) {
                                errors.push({
                                    line: idx + 1,
                                    message: "Failed to generate product id",
                                });
                                return rowCb();
                            }

                            const Product = {
                                _id: productId,
                                barcode: Number(row.barcode),
                                name: validator.escape(row.name),
                                price: String(row.price),
                                quantity: row.quantity == null ? "0" : String(row.quantity),
                                category: row.categoryId == null ? "" : String(row.categoryId),
                                supplier: validator.escape(row.supplier || ""),
                                expirationDate: validator.escape(row.expirationDate || ""),
                                minStock: row.minStock == null ? "0" : String(row.minStock),
                                stock: Number(row.stock == null ? 0 : row.stock),
                                img: "",
                            };

                            inventoryDB.insert(Product, function (insErr) {
                                if (insErr) {
                                    errors.push({
                                        line: idx + 1,
                                        message: insErr.message || "Insert failed",
                                    });
                                    return rowCb();
                                }
                                inserted++;
                                rowCb();
                            });
                        });
                    }, function (loopErr) {
                        cb(loopErr, { inserted, skipped, errors });
                    });
                },
            ], function (seriesErr, results) {
                if (seriesErr) {
                    return res.status(500).json({
                        error: "Internal Server Error",
                        message: seriesErr.message || "Import failed.",
                    });
                }
                const result = results[1];
                res.json({
                    inserted: result.inserted,
                    skipped: result.skipped,
                    errors: result.errors,
                    categoriesCreated: Array.from(categoriesToCreate.values()),
                });
            });
        },
    );
});

/**
 * GET /api/inventory/bulk/template
 * Streams a sample CSV with the expected columns and three example rows.
 */
const TEMPLATE_CONTENT = [
    "name,barcode,price,quantity,category,supplier,expirationDate,minStock,stock",
    "Paracetamol 500mg (Box of 20),8901234500017,120.00,50,Analgesics,MediCorp,15-Mar-2027,10,0",
    "Amoxicillin 250mg (Box of 10),8901234500024,450.00,30,Antibiotics,MediCorp,20-Jun-2026,5,0",
    "Cetirizine 10mg (Strip of 10),8901234500031,85.00,0,Antihistamines,,10-Dec-2027,15,1",
].join("\n");

app.get("/bulk/template", function (req, res) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${TEMPLATE_FILENAME}"`);
    res.send(TEMPLATE_CONTENT);
});

module.exports = app;
module.exports.validateRow = validateRow;
module.exports.resolveCategories = resolveCategories;
module.exports.dedupeInPayload = dedupeInPayload;
module.exports.MAX_ROWS = MAX_ROWS;
module.exports.MAX_CSV_BYTES = MAX_CSV_BYTES;
module.exports.DATE_FORMAT = DATE_FORMAT;
