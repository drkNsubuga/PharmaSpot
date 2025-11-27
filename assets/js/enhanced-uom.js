/**
 * Enhanced UoM (Unit of Measure) Management for PharmaSpot
 * Handles packages, bulk upload, and stock management
 */

const notiflix = require("notiflix");

let packageCounter = 0;

// Helper function to get API URL
function getApiUrl() {
    return window.api || "http://localhost:" + process.env.PORT + "/api/";
}

// Helper function to get allProducts
function getAllProducts() {
    return window.allProducts || [];
}

// Helper function to get allCategories
function getAllCategories() {
    return window.allCategories || [];
}

/**
 * Add a package definition row to the form
 */
function addPackageRow(packageData = null) {
    packageCounter++;
    const packageId = packageData ? packageData.id || packageCounter : packageCounter;
    
    const packageRow = `
        <div class="package-definition" id="package_row_${packageId}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px; background: #f9f9f9;">
            <div class="row">
                <div class="col-md-3">
                    <label>Package Name</label>
                    <input type="text" class="form-control package-name" placeholder="e.g., Strip, Box" value="${packageData ? packageData.package_name : ''}" required>
                </div>
                <div class="col-md-2">
                    <label>Units Contained</label>
                    <input type="number" class="form-control package-units" placeholder="10" min="1" value="${packageData ? packageData.units_contained : ''}" required>
                </div>
                <div class="col-md-3">
                    <label>Retail Price</label>
                    <input type="number" class="form-control package-retail package-retail-price" placeholder="0.00" step="0.01" min="0" value="${packageData ? packageData.retail_price : ''}">
                </div>
                <div class="col-md-3">
                    <label>Wholesale Price</label>
                    <input type="number" class="form-control package-wholesale package-wholesale-price" placeholder="0.00" step="0.01" min="0" value="${packageData ? packageData.wholesale_price : ''}">
                </div>
                <div class="col-md-1">
                    <label>&nbsp;</label>
                    <button type="button" class="btn btn-danger btn-sm btn-block" onclick="removePackageRow(${packageId})">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    $('#packages_container').append(packageRow);
}

/**
 * Remove a package definition row
 */
function removePackageRow(packageId) {
    $(`#package_row_${packageId}`).remove();
}

/**
 * Collect package definitions from the form
 */
function collectPackagesFromForm() {
    const packages = [];
    $('.package-definition').each(function() {
        const packageName = $(this).find('.package-name').val();
        const unitsContained = parseInt($(this).find('.package-units').val());
        const retailPrice = parseFloat($(this).find('.package-retail-price').val()) || 0;
        const wholesalePrice = parseFloat($(this).find('.package-wholesale-price').val()) || 0;
        
        if (packageName && unitsContained > 0) {
            packages.push({
                package_name: packageName,
                units_contained: unitsContained,
                retail_price: retailPrice,
                wholesale_price: wholesalePrice
            });
        }
    });
    return packages;
}

/**
 * Open the bulk upload modal
 */
function openBulkUpload() {
    $('#BulkUpload').modal('show');
}

/**
 * Download CSV template for bulk upload
 */
function downloadBulkUploadTemplate() {
    const fs = require('fs');
    const path = require('path');
    const {app} = require('@electron/remote');
    
    // Read template from public folder
    const templatePath = path.join(process.cwd(), 'public', 'bulk-upload-template.csv');
    
    if (fs.existsSync(templatePath)) {
        // Copy to Downloads folder
        const downloadsPath = path.join(app.getPath('downloads'), 'PharmaSpot_Bulk_Upload_Template.csv');
        fs.copyFileSync(templatePath, downloadsPath);
        notiflix.Notify.success('Template downloaded to: ' + downloadsPath);
    } else {
        notiflix.Notify.failure('Template file not found at: ' + templatePath);
        // Fallback: create template inline
        const csvContent = `Name,Category,Base Unit,Cost Price,Selling Price,Wholesale Price,Stock,Barcode,Expiry Date (YYYY-MM-DD),Min Stock,Packages (JSON)
Paracetamol 500mg,Analgesics,Tablet,50,100,80,500,PAR500MG,2026-12-31,50,"[{""package_name"":""Strip"",""units_contained"":10,""retail_price"":120,""wholesale_price"":95},{""package_name"":""Box"",""units_contained"":100,""retail_price"":1000,""wholesale_price"":850}]"
Amoxicillin 250mg,Antibiotics,Capsule,80,150,120,300,AMOX250,2026-06-30,30,"[{""package_name"":""Strip"",""units_contained"":10,""retail_price"":180,""wholesale_price"":140}]"
Vitamin C 1000mg,Vitamins & Supplements,Tablet,30,60,45,1000,VITC1000,2027-03-15,100,[]
Bandage Roll,First Aid,Roll,100,200,150,50,BAND001,2028-01-01,10,[]`;
        
        const downloadsPath = path.join(app.getPath('downloads'), 'PharmaSpot_Bulk_Upload_Template.csv');
        fs.writeFileSync(downloadsPath, csvContent);
        notiflix.Notify.success('Template created at: ' + downloadsPath);
    }
}

/**
 * Download CSV template for bulk upload (legacy browser method)
 */
function downloadTemplate() {
    const csvContent = `Name,Category,Base Unit,Cost Price,Selling Price,Wholesale Price,Stock,Barcode,Expiry Date,Min Stock,Packages
Paracetamol 500mg,Analgesics,Tablet,50,100,85,500,PAR500,2025-12-31,250,"[{""package_name"":""Strip"",""units_contained"":10,""retail_price"":120,""wholesale_price"":100},{""package_name"":""Box"",""units_contained"":100,""retail_price"":1100,""wholesale_price"":950}]"
Amoxicillin 250mg,Antibiotics,Capsule,80,150,130,300,AMX250,2025-06-30,150,"[{""package_name"":""Strip"",""units_contained"":10,""retail_price"":180,""wholesale_price"":150}]"
Ibuprofen 400mg,Analgesics,Tablet,30,60,50,1000,IBU400,2026-03-15,500,"[{""package_name"":""Strip"",""units_contained"":10,""retail_price"":70,""wholesale_price"":60},{""package_name"":""Bottle"",""units_contained"":100,""retail_price"":650,""wholesale_price"":550}]"
Vitamin C 500mg,Supplements,Tablet,20,40,35,800,VITC500,2026-01-20,400,[]`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'pharmaspot_products_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notiflix.Notify.success('Template downloaded! Check your Downloads folder.');
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    
    return values;
}

/**
 * Process bulk upload from CSV file
 */
function processBulkUpload() {
    const api = getApiUrl();
    const allProducts = getAllProducts();
    const allCategories = getAllCategories();
    
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files.length) {
        notiflix.Notify.failure('Please select a CSV file');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Validate headers
            const requiredHeaders = ['Name', 'Category', 'Base Unit', 'Cost Price', 'Selling Price', 'Stock'];
            const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));
            
            if (!hasRequiredHeaders) {
                notiflix.Notify.failure('CSV missing required columns: ' + requiredHeaders.join(', '));
                return;
            }
            
            let successCount = 0;
            let errorCount = 0;
            let updatedCount = 0;
            const totalProducts = lines.filter(line => line.trim()).length - 1;
            
            if (totalProducts === 0) {
                notiflix.Notify.warning('No products found in CSV file');
                return;
            }
            
            document.getElementById('uploadProgress').style.display = 'block';
            
            // Process each line
            const processLine = (lineIndex) => {
                if (lineIndex >= lines.length) {
                    finishBulkUpload(successCount, updatedCount, errorCount);
                    return;
                }
                
                const line = lines[lineIndex];
                if (!line.trim()) {
                    processLine(lineIndex + 1);
                    return;
                }
                
                try {
                    const values = parseCSVLine(line);
                    const product = {};
                    
                    headers.forEach((header, index) => {
                        product[header] = values[index] ? values[index].trim() : '';
                    });
                    
                    // Validate required fields
                    if (!product.Name || !product['Selling Price'] || !product.Stock) {
                        console.warn('Missing required fields for row:', lineIndex + 1);
                        errorCount++;
                        updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                        processLine(lineIndex + 1);
                        return;
                    }
                    
                    // Find or create category
                    let categoryId = '';
                    if (product.Category && product.Category.trim()) {
                        const existingCategory = allCategories.find(c => 
                            c.name && c.name.toLowerCase().trim() === product.Category.toLowerCase().trim()
                        );
                        
                        if (existingCategory) {
                            categoryId = existingCategory._id;
                            processProduct(categoryId);
                        } else {
                            // Create new category
                            $.ajax({
                                type: "POST",
                                url: api + "categories/category",
                                contentType: "application/json",
                                data: JSON.stringify({ name: product.Category }),
                                success: function(newCategory) {
                                    allCategories.push(newCategory);
                                    categoryId = newCategory._id;
                                    processProduct(categoryId);
                                },
                                error: function(jqXHR) {
                                    console.error('Failed to create category:', product.Category, jqXHR.responseJSON);
                                    processProduct('');
                                }
                            });
                        }
                    } else {
                        processProduct('');
                    }
                    
                    function processProduct(catId) {
                        // Check if product already exists (same name and category)
                        const currentProducts = getAllProducts();
                        const existingProduct = currentProducts.find(p => 
                            p.name.toLowerCase().trim() === product.Name.toLowerCase().trim() &&
                            (p.category_id === catId || p.category === catId)
                        );
                        
                        // Parse packages if exists
                        let packages = [];
                        if (product.Packages) {
                            try {
                                packages = JSON.parse(product.Packages);
                            } catch (e) {
                                console.warn('Invalid package JSON for product:', product.Name);
                            }
                        }
                        
                        const stockToAdd = parseInt(product.Stock) || 0;
                        const minStock = parseInt(product['Min Stock']) || Math.floor(stockToAdd / 2);
                        
                        if (existingProduct) {
                            // UPDATE: INCREMENT STOCK
                            const updatedStock = (existingProduct.total_stock_base_units || existingProduct.quantity || 0) + stockToAdd;
                            
                            const updateData = {
                                _id: existingProduct._id,
                                total_stock_base_units: updatedStock,
                                quantity: updatedStock,
                                cost_price: parseFloat(product['Cost Price']) || existingProduct.cost_price,
                                selling_price: parseFloat(product['Selling Price']) || existingProduct.selling_price,
                                wholesale_price: parseFloat(product['Wholesale Price']) || existingProduct.wholesale_price,
                                barcode: product.Barcode || existingProduct.barcode,
                                expirationDate: product['Expiry Date'] || existingProduct.expirationDate,
                                min_stock_base_units: minStock,
                                minStock: minStock
                            };
                            
                            $.ajax({
                                type: "POST",
                                url: api + "inventory/product",
                                data: JSON.stringify(updateData),
                                contentType: "application/json",
                                success: function() {
                                    updatedCount++;
                                    updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                                    processLine(lineIndex + 1);
                                },
                                error: function() {
                                    errorCount++;
                                    updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                                    processLine(lineIndex + 1);
                                }
                            });
                        } else {
                            // CREATE NEW PRODUCT
                            const newProduct = {
                                name: product.Name,
                                category_id: catId,
                                category: catId,
                                base_unit_name: product['Base Unit'] || 'Unit',
                                cost_price: parseFloat(product['Cost Price']) || 0,
                                selling_price: parseFloat(product['Selling Price']),
                                wholesale_price: parseFloat(product['Wholesale Price']) || parseFloat(product['Selling Price']),
                                stock: 1,
                                quantity: stockToAdd,
                                total_stock_base_units: stockToAdd,
                                barcode: product.Barcode || '',
                                expirationDate: product['Expiry Date'] || '',
                                minStock: minStock,
                                min_stock_base_units: minStock,
                                packages: JSON.stringify(packages),
                                img: ''
                            };
                            
                            // Use FormData to work with multer upload middleware
                            const formData = new FormData();
                            Object.keys(newProduct).forEach(key => {
                                formData.append(key, newProduct[key]);
                            });
                            
                            $.ajax({
                                type: "POST",
                                url: api + "inventory/product",
                                data: formData,
                                processData: false,
                                contentType: false,
                                success: function() {
                                    successCount++;
                                    updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                                    processLine(lineIndex + 1);
                                },
                                error: function(xhr, status, error) {
                                    console.error('Error creating product:', error, xhr.responseText);
                                    errorCount++;
                                    updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                                    processLine(lineIndex + 1);
                                }
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error('Error processing line:', lineIndex + 1, error);
                    errorCount++;
                    updateUploadProgress(successCount, updatedCount, errorCount, totalProducts);
                    processLine(lineIndex + 1);
                }
            };
            
            // Start processing from line 1 (skip header at line 0)
            processLine(1);
            
        } catch (error) {
            notiflix.Notify.failure('Error processing CSV file: ' + error.message);
            console.error(error);
            document.getElementById('uploadProgress').style.display = 'none';
        }
    };
    
    reader.onerror = function() {
        notiflix.Notify.failure('Failed to read file');
    };
    
    reader.readAsText(file);
}

/**
 * Update the upload progress display
 */
function updateUploadProgress(success, updated, error, total) {
    const processed = success + updated + error;
    const percentage = Math.round((processed / total) * 100);
    
    $('.progress-bar').css('width', percentage + '%');
    $('.progress-bar .sr-only').text(percentage + '% Complete');
    $('#uploadStatus').text(`Processed: ${processed}/${total} | New: ${success} | Updated: ${updated} | Errors: ${error}`);
}

/**
 * Finish bulk upload and show results
 */
function finishBulkUpload(success, updated, error) {
    setTimeout(() => {
        document.getElementById('uploadProgress').style.display = 'none';
        $('.progress-bar').css('width', '0%');
        $('#csvFileInput').val('');
        
        const totalProcessed = success + updated;
        if (totalProcessed > 0) {
            let message = '';
            if (success > 0 && updated > 0) {
                message = `Created ${success} new products, updated ${updated} existing products`;
            } else if (success > 0) {
                message = `Successfully created ${success} products`;
            } else {
                message = `Successfully updated ${updated} products`;
            }
            
            if (error > 0) {
                message += ` (${error} errors)`;
            }
            
            notiflix.Notify.success(message);
            
            // Reload products using the global function from pos.js
            if (typeof window.loadProducts === 'function') {
                window.loadProducts();
            }
            if (typeof window.loadProductList === 'function') {
                window.loadProductList();
            }
        } else {
            notiflix.Notify.failure('No products were processed');
        }
        
        $('#BulkUpload').modal('hide');
    }, 1000);
}

/**
 * Open stock update modal for a product
 */
function openStockUpdate(productId) {
    // Get allProducts from window scope (defined in pos.js)
    const allProducts = getAllProducts();
    const product = allProducts.find(p => p._id === productId);
    
    if (!product) {
        notiflix.Notify.failure('Product not found');
        return;
    }
    
    notiflix.Confirm.prompt(
        'Update Stock',
        `Current: ${product.total_stock_base_units || product.quantity} ${product.base_unit_name || 'units'}. Enter new stock:`,
        product.total_stock_base_units || product.quantity,
        'Update',
        'Cancel',
        function(newStock) {
            updateProductStock(productId, parseInt(newStock));
        },
        function() {},
        {
            inputPlaceholder: 'Enter new stock quantity'
        }
    );
}

/**
 * Update product stock via API
 */
function updateProductStock(productId, newStock) {
    const api = getApiUrl();
    
    $.ajax({
        type: "POST",
        url: api + "inventory/update-stock",
        data: JSON.stringify({
            product_id: productId,
            new_stock: newStock
        }),
        contentType: "application/json",
        success: function() {
            notiflix.Notify.success('Stock updated successfully');
            // Reload products using the global function from pos.js
            if (typeof window.loadProducts === 'function') {
                window.loadProducts();
            } else if (typeof loadProducts === 'function') {
                loadProducts();
            }
        },
        error: function() {
            notiflix.Notify.failure('Failed to update stock');
        }
    });
}

// Export functions for global use
if (typeof window.EnhancedPharmaPos === 'undefined') {
    window.EnhancedPharmaPos = {};
}

window.EnhancedPharmaPos.addPackageDefinition = addPackageRow;
window.EnhancedPharmaPos.removePackageDefinition = removePackageRow;
window.EnhancedPharmaPos.collectPackages = collectPackagesFromForm;

// Export bulk upload functions to global scope for onclick handlers
window.openBulkUpload = openBulkUpload;
window.processBulkUpload = processBulkUpload;
window.downloadBulkUploadTemplate = downloadBulkUploadTemplate;
