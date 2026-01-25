/**
 * ILAC REFERANS VERITABANI API
 * TİTCK (Türkiye İlaç ve Tıbbi Cihaz Kurumu) verilerini kullanır
 */

const app = require("express")();
const bodyParser = require("body-parser");
const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require("fs");

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;

// Ilac referans veritabani
const drugDbPath = path.join(appData, appName, "server", "databases", "drugs.db");

app.use(bodyParser.json());

module.exports = app;

let drugDB = new Datastore({
    filename: drugDbPath,
    autoload: true,
});

// Indeksler
drugDB.ensureIndex({ fieldName: "barcode", unique: true, sparse: true });
drugDB.ensureIndex({ fieldName: "name" });
drugDB.ensureIndex({ fieldName: "atcCode" });

/**
 * GET /: API bilgisi
 */
app.get("/", function (req, res) {
    drugDB.count({}, function (err, count) {
        res.json({
            message: "Ilac Referans Veritabani API",
            totalDrugs: count
        });
    });
});

/**
 * GET /search: Ilac ara (isim veya barkod ile)
 * Query params: q (arama terimi), limit (sonuc limiti)
 */
app.get("/search", function (req, res) {
    const query = req.query.q || "";
    const limit = parseInt(req.query.limit) || 20;

    if (query.length < 2) {
        return res.json([]);
    }

    // Barkod araması mı?
    if (/^\d+$/.test(query)) {
        // Barkod ile ara
        drugDB.find({
            barcode: { $regex: new RegExp("^" + query) }
        }).limit(limit).exec(function (err, docs) {
            res.json(docs || []);
        });
    } else {
        // Isim ile ara (case-insensitive)
        drugDB.find({
            name: { $regex: new RegExp(query, "i") }
        }).limit(limit).exec(function (err, docs) {
            res.json(docs || []);
        });
    }
});

/**
 * GET /barcode/:barcode: Barkod ile ilac bul
 */
app.get("/barcode/:barcode", function (req, res) {
    const barcode = req.params.barcode;

    drugDB.findOne({ barcode: barcode }, function (err, doc) {
        if (err) {
            res.status(500).json({ error: "Veritabani hatasi" });
        } else if (!doc) {
            res.status(404).json({ error: "Ilac bulunamadi" });
        } else {
            res.json(doc);
        }
    });
});

/**
 * GET /atc/:code: ATC kodu ile ilaclari listele
 */
app.get("/atc/:code", function (req, res) {
    const code = req.params.code;
    const limit = parseInt(req.query.limit) || 50;

    drugDB.find({
        atcCode: { $regex: new RegExp("^" + code, "i") }
    }).limit(limit).exec(function (err, docs) {
        res.json(docs || []);
    });
});

/**
 * GET /firm/:name: Firma adina gore ilaclari listele
 */
app.get("/firm/:name", function (req, res) {
    const name = req.params.name;
    const limit = parseInt(req.query.limit) || 50;

    drugDB.find({
        firmName: { $regex: new RegExp(name, "i") }
    }).limit(limit).exec(function (err, docs) {
        res.json(docs || []);
    });
});

/**
 * GET /stats: Istatistikler
 */
app.get("/stats", function (req, res) {
    drugDB.count({}, function (err, total) {
        drugDB.count({ prescriptionType: "Normal" }, function (err, normal) {
            drugDB.count({ prescriptionType: "Mor" }, function (err, mor) {
                drugDB.count({ prescriptionType: "Kirmizi" }, function (err, kirmizi) {
                    drugDB.count({ prescriptionType: "Yesil" }, function (err, yesil) {
                        res.json({
                            total: total,
                            byPrescriptionType: {
                                normal: normal,
                                mor: mor,
                                kirmizi: kirmizi,
                                yesil: yesil
                            }
                        });
                    });
                });
            });
        });
    });
});

/**
 * POST /import: JSON dosyasindan ilac verisi yukle
 */
app.post("/import", function (req, res) {
    const jsonPath = path.join(__dirname, "..", "data", "ilac_veritabani.json");

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ error: "Ilac veritabani dosyasi bulunamadi" });
    }

    try {
        const drugs = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        let imported = 0;
        let errors = 0;

        // Mevcut verileri temizle
        drugDB.remove({}, { multi: true }, function (err) {
            // Yeni verileri ekle
            drugs.forEach(function (drug) {
                drugDB.insert(drug, function (err) {
                    if (err) {
                        errors++;
                    } else {
                        imported++;
                    }
                });
            });

            // Bekle ve sonuc dondur
            setTimeout(function () {
                res.json({
                    success: true,
                    imported: imported,
                    errors: errors,
                    total: drugs.length
                });
            }, 2000);
        });
    } catch (err) {
        res.status(500).json({ error: "Import hatasi: " + err.message });
    }
});

/**
 * POST /sync: TİTCK'den guncel listeyi indir ve yukle
 */
app.post("/sync", async function (req, res) {
    res.json({
        message: "Bu ozellik henuz uygulanmadi",
        hint: "Manuel olarak TİTCK'den Excel indirip /import endpoint'ini kullanin"
    });
});
