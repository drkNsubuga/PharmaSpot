# PharmaSpot Enhanced UoM (Unit of Measure) System

## Overview
This enhanced system implements a comprehensive Unit of Measure (UoM) management system for PharmaSpot, allowing for flexible product management with packages, wholesale/retail pricing, and intelligent stock tracking.

## Key Features

### 1. **Unit of Measure (UoM) Management**
- **Base Unit**: Define the smallest measurable unit (e.g., Tablet, Capsule, Pill, ml, mg)
- **Stock Tracking**: All stock is tracked in base units for accuracy
- **Automatic Calculations**: System automatically handles conversions between packages and base units

### 2. **Package Definitions**
Products can have multiple package types, each with:
- **Package Name**: e.g., Strip, Box, Bottle, Carton
- **Units Contained**: Number of base units in each package
- **Retail Price**: Price for individual/retail customers
- **Wholesale Price**: Discounted price for bulk/wholesale customers

**Example:**
- Product: Paracetamol 500mg
- Base Unit: Tablet
- Packages:
  - Strip (10 tablets): Retail ₦120, Wholesale ₦100
  - Box (100 tablets): Retail ₦1100, Wholesale ₦950

### 3. **Pricing Structure**
Each product has three price levels:
- **Cost Price**: Your purchase/acquisition cost (per base unit)
- **Retail/Selling Price**: Default selling price (per base unit)
- **Wholesale Price**: Discounted price for bulk sales (per base unit)

Package prices are defined separately for retail and wholesale.

### 4. **Stock Management**

#### Adding Products
When adding products manually or via CSV:
- Enter stock in base units
- Minimum stock defaults to 50% of initial stock (customizable)
- System alerts when stock falls below minimum

#### Stock Updates
Use the **Update Stock** button (cube icon) to:
- Adjust stock to match physical inventory
- Useful after stock takes or deliveries
- Updates are immediate and reflected across the system

#### Stock Deduction Logic
When selling products:
- Stock is deducted in base units
- System calculates: `quantity sold × package units = base units to deduct`
- Example: Selling 2 Strips (10 tablets each) deducts 20 tablets from stock

### 5. **Bulk Upload System**

#### CSV Template
Download the template which includes columns:
- Name (required)
- Category (required)
- Base Unit (required)
- Cost Price (required)
- Selling Price (required)
- Wholesale Price (optional)
- Stock (required - in base units)
- Barcode (optional)
- Expiry Date (YYYY-MM-DD format)
- Min Stock (optional - defaults to 50% of stock)
- Packages (optional - JSON format)

#### Intelligent Duplicate Handling
**Critical Feature**: The system handles duplicates intelligently:

1. **New Products**: If product name + category doesn't exist, creates new product
2. **Existing Products**: If product name + category exists:
   - **INCREMENTS** stock (does NOT replace)
   - Updates prices if provided
   - Example:
     - Existing: Paracetamol (Analgesics) - 500 tablets
     - Upload: Paracetamol (Analgesics) - 300 tablets
     - Result: Paracetamol (Analgesics) - 800 tablets ✓

This is perfect for:
- Regular stock deliveries
- Multiple upload sessions
- Inventory updates from different sources

#### Package JSON Format
For packages column in CSV:
```json
[{"package_name":"Strip","units_contained":10,"retail_price":120,"wholesale_price":100},{"package_name":"Box","units_contained":100,"retail_price":1100,"wholesale_price":950}]
```

### 6. **Point of Sale (POS) Integration**

#### Adding to Cart
When clicking a product:
1. System shows package selection modal
2. Choose package type (or base unit)
3. For packages: select Retail or Wholesale price tier
4. Product added to cart with selected options

#### Cart Display
Cart shows:
- Product name
- Package type and units
- Selected price tier (Retail/Wholesale)
- Unit price
- Total price
- Stock availability checks

#### Stock Validation
- System checks available stock before allowing quantity increase
- Considers package units when validating
- Shows clear error messages when stock insufficient

## Usage Guide

### Adding a Product Manually

1. Click **"Add Product"** button
2. Fill in basic information:
   - Category (required)
   - Product Name (required)
   - Barcode (optional)
   - Expiry Date (optional)

3. Complete UoM section:
   - **Base Unit**: e.g., "Tablet"
   - **Stock**: Total quantity in base units
   - **Minimum Stock**: Auto-calculated or custom
   - **Cost Price**: Your purchase price per unit
   - **Retail Price**: Selling price per unit
   - **Wholesale Price**: Optional bulk price

4. Add Packages (optional):
   - Click **"Add Package"**
   - Enter package name, units contained, retail and wholesale prices
   - Add multiple packages as needed

5. Upload image (optional)
6. Click **"Save Product"**

### Bulk Upload Process

1. Click **"Products"** → **"CSV Template"** to download template
2. Fill in the CSV file:
   - Required fields: Name, Category, Base Unit, Cost Price, Selling Price, Stock
   - Optional fields: Wholesale Price, Barcode, Expiry Date, Min Stock, Packages

3. Click **"Bulk Upload"**
4. Select your CSV file
5. Click **"Upload Products"**
6. Monitor progress bar:
   - Shows: New products created, Existing products updated, Errors
7. Review results

### Updating Stock

**For individual products:**
1. Go to Products list
2. Click the cube icon (Update Stock) next to the product
3. Enter new stock quantity (in base units)
4. Confirm update

**For bulk updates:**
1. Prepare CSV with current stock levels
2. Upload using bulk upload feature
3. Stock will be incremented from current levels

### Making a Sale

1. Click on product tile or search for product
2. In package selection modal:
   - Select package type (Strip, Box, Base Unit, etc.)
   - Choose price tier (Retail/Wholesale) for packages
3. Product added to cart
4. Adjust quantity if needed (±buttons)
5. Complete sale as normal
6. Stock automatically deducted in base units

## Database Schema

### Product Fields

```javascript
{
  _id: Number,                      // Unique identifier
  name: String,                     // Product name
  category: String,                 // Category ID (legacy)
  category_id: String,              // Category ID (new)
  barcode: String,                  // Product barcode
  
  // UoM Fields
  base_unit_name: String,           // e.g., "Tablet", "Capsule"
  cost_price: Number,               // Purchase cost per base unit
  selling_price: Number,            // Retail price per base unit
  wholesale_price: Number,          // Wholesale price per base unit
  
  // Stock Tracking (in base units)
  total_stock_base_units: Number,   // Current stock
  min_stock_base_units: Number,     // Minimum stock alert level
  
  // Packages (JSON string)
  packages: String,                 // Array of package definitions
  
  // Other Fields
  expirationDate: String,           // Expiry date
  stock: Number,                    // 1 = track stock, 0 = don't track
  img: String,                      // Product image filename
  
  // Legacy fields (for backward compatibility)
  price: Number,                    // Maps to selling_price
  quantity: Number,                 // Maps to total_stock_base_units
  minStock: Number                  // Maps to min_stock_base_units
}
```

### Package Definition

```javascript
{
  package_name: String,             // e.g., "Strip", "Box"
  units_contained: Number,          // Number of base units
  retail_price: Number,             // Retail price for this package
  wholesale_price: Number           // Wholesale price for this package
}
```

### Cart Item

```javascript
{
  id: Number,                       // Product ID
  product_name: String,             // Product name
  sku: String,                      // Product SKU/barcode
  quantity: Number,                 // Number of packages being sold
  
  // Pricing
  price_tier: String,               // "retail" or "wholesale"
  retail_price: Number,             // Retail price per package
  wholesale_price: Number,          // Wholesale price per package
  cost_price: Number,               // Cost price per base unit
  
  // Package Information
  package_name: String,             // Selected package type
  package_units: Number,            // Base units per package
  base_unit: String                 // Base unit name
}
```

## API Endpoints

### Enhanced Endpoints

```javascript
// Search products
GET /api/inventory/search?q=<search_term>

// Update stock
POST /api/inventory/update-stock
Body: { product_id: Number, new_stock: Number }

// Create/Update product (enhanced with UoM fields)
POST /api/inventory/product
Body: Product object with UoM fields
```

## Best Practices

### Stock Management
1. **Always use base units** for stock entry
2. Let system handle package calculations
3. Use "Update Stock" feature for physical inventory adjustments
4. Set realistic minimum stock levels (50% is good default)

### Bulk Upload
1. Download template first - don't create from scratch
2. Use consistent category names to avoid duplicates
3. Test with small batch first
4. Stock values in uploads are ADDED to existing stock
5. Use YYYY-MM-DD format for expiry dates

### Package Setup
1. Start with most common packages (Strip, Box)
2. Set wholesale prices 10-20% below retail as a guideline
3. Ensure wholesale price > cost price for profitability
4. Package prices should reflect actual unit counts

### Pricing Strategy
- **Cost Price**: Always track accurately
- **Retail Price**: Standard selling price
- **Wholesale Price**: For bulk buyers, ensure still profitable
- **Package Pricing**: Consider convenience value (strip vs individual)

## Troubleshooting

### Common Issues

**Q: Stock not updating after upload?**
A: Check that product name and category match exactly. Stock is incremented for matches.

**Q: Package prices not showing in POS?**
A: Ensure packages are saved with both retail and wholesale prices.

**Q: Stock deduction incorrect?**
A: Verify package_units is set correctly. System deducts: quantity × package_units.

**Q: Duplicate products created?**
A: Product matching is by Name + Category. Ensure consistent naming.

**Q: Minimum stock alerts not working?**
A: Check that min_stock_base_units is set and stock tracking is enabled.

## Migration from Old System

Existing products will continue to work:
- `price` → `selling_price`
- `quantity` → `total_stock_base_units`
- `minStock` → `min_stock_base_units`

To fully utilize new features:
1. Edit each product
2. Add base unit name
3. Set cost and wholesale prices
4. Add package definitions
5. Save

Or use bulk upload to recreate with new fields.

## Files Modified

1. **api/inventory.js** - Enhanced product schema, search, stock update
2. **index.html** - New product modal with UoM fields, bulk upload modal
3. **assets/js/pos.js** - Updated cart, product list, form handlers
4. **assets/js/enhanced-uom.js** - New file with bulk upload and package management

## Support

For issues or questions:
1. Check this documentation
2. Review CSV template for correct format
3. Test with sample data first
4. Verify product fields are filled correctly

---

**Version**: 2.0 with UoM Support  
**Last Updated**: November 6, 2025  
**Compatibility**: PharmaSpot v1.5.1+
