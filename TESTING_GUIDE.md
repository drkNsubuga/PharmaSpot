# Quick Start Testing Guide

## RESTART APPLICATION FIRST! ⚠️

Before testing, you MUST restart the application:

1. In PowerShell, press **Ctrl+C** to stop the current process
2. Run: `npm start`
3. Wait for "Server started" message
4. Open the application fresh

---

## Test Sequence (Follow in Order)

### Test 1: Check if Products Load (30 seconds)

**Steps:**
1. Application opens to POS screen
2. Look at the right side where products should appear
3. **EXPECTED:** You should see product tiles with images, names, stock, and prices

**If products DON'T appear:**
- Press **F12** to open Developer Tools
- Check Console tab for errors
- Tell me what error you see

---

### Test 2: Add a Simple Product (2 minutes)

**Steps:**
1. Click **"Products"** button (green button at top)
2. Click the **"+" button** next to Products
3. Fill in the form:
   - **Category:** Select from dropdown
   - **Product Name:** "Test Medicine"
   - **Base Unit:** "Tablet"
   - **Cost Price:** 50
   - **Retail Price:** 100
   - **Stock:** 1000

4. **Skip packages for now** (leave packages section empty)
5. Click **"Save Product"** (blue button at bottom)

**EXPECTED:**
- Success notification appears
- Modal closes automatically
- Product appears in Products table

**If it fails:**
- Press F12, check Console tab
- Take a screenshot of the error
- Tell me the exact error message

---

### Test 3: Check if New Product Appears in POS (1 minute)

**Steps:**
1. Click **"Open Tabs"** button (blue button at top)
2. Look for your "Test Medicine" tile

**EXPECTED:**
- You see "Test Medicine" tile
- Shows "1000 Tablets" in stock
- Shows price ₦100

---

### Test 4: Add Product to Cart (1 minute)

**Steps:**
1. Click on "Test Medicine" tile
2. Package selection modal should open
3. You'll see: "Base Unit (Tablet) - ₦100"
4. Click **"Add"**

**EXPECTED:**
- Product appears in left cart section
- Shows quantity 1
- Shows price ₦100
- Total shows ₦100

**Test incrementing:**
- Click the **+ button** next to quantity
- Quantity should increase to 2
- Total should show ₦200

---

### Test 5: Add Product with Packages (5 minutes)

**Steps:**
1. Go to **Products** → Click **+**
2. Fill basic info:
   - Category: Select any
   - Name: "Paracetamol 500mg"
   - Base Unit: "Tablet"
   - Cost Price: 5
   - Retail Price: 10
   - Wholesale Price: 8
   - Stock: 1000

3. **Add a Package:**
   - Click **"Add Package"** (green button)
   - Package Name: "Strip"
   - Units Contained: 10
   - Retail Price: 120
   - Wholesale Price: 100

4. **Add another package:**
   - Click **"Add Package"** again
   - Package Name: "Box"
   - Units Contained: 100
   - Retail Price: 1000
   - Wholesale Price: 900

5. Click **"Save Product"**

**EXPECTED:** Product saves with 2 packages

---

### Test 6: Use Package Selection in POS (2 minutes)

**Steps:**
1. Go back to POS (Click "Open Tabs")
2. Click on "Paracetamol 500mg" tile
3. Package selection modal opens

**EXPECTED TO SEE:**
```
Select Package Type:
[Dropdown with 3 options:]
- Base Unit (Tablet) - ₦10
- Strip (10 Tablets) - Retail: ₦120, Wholesale: ₦100  
- Box (100 Tablets) - Retail: ₦1000, Wholesale: ₦900
```

4. Select "Strip" from dropdown
5. **Price Tier selector appears**
6. Choose "Retail"
7. Click "Add"

**EXPECTED IN CART:**
```
Paracetamol 500mg
Strip (10 Tablets)
Retail: ₦120
```

---

### Test 7: Edit Existing Product (2 minutes)

**Steps:**
1. Go to **Products** table
2. Find "Paracetamol 500mg"
3. Click **Edit** button (pencil icon)
4. Modal opens with existing data
5. Change Stock to 2000
6. Click **"Save Product"**

**EXPECTED:**
- Product updates successfully
- Stock now shows 2000 Tablets in POS

---

### Test 8: Stock Update Button (1 minute)

**Steps:**
1. In Products table, find any product
2. Click the **cube icon** (Update Stock button)
3. Prompt appears with current stock
4. Enter a new number (e.g., 5000)
5. Click "Update"

**EXPECTED:**
- Success message
- Stock updates immediately
- Products table refreshes

---

## Common Issues & Solutions

### ❌ "Products not appearing in POS"
**Solution:**
1. Press F12 → Console tab
2. Look for red errors
3. If you see path.join error, restart app
4. Clear browser cache: Ctrl+Shift+Delete

### ❌ "Package selection modal doesn't open"
**Solution:**
1. Check if product has packages defined
2. Press F12 → Console for errors
3. Make sure you saved the product after adding packages

### ❌ "Save Product fails silently"
**Solution:**
1. Check PowerShell terminal for backend errors
2. Look for "Expected a string but received undefined"
3. If you see this, the fix didn't apply - check inventory.js

### ❌ "Cart not showing package info"
**Solution:**
1. Make sure you selected a package (not just clicking product)
2. Package selection modal should have appeared first
3. Check browser console for JavaScript errors

---

## What to Tell Me if Something Fails

**For each failing test, provide:**

1. **Which test number** failed (Test 1, Test 2, etc.)
2. **Screenshot** of the screen when error occurred
3. **Browser Console errors:**
   - Press F12
   - Click "Console" tab
   - Copy ALL red error messages
   - Send to me

4. **PowerShell/Terminal output:**
   - Look at the terminal where npm start is running
   - Copy any "Uncaught Exception" messages
   - Send to me

---

## Success Criteria ✅

After all tests pass, you should be able to:
- ✅ See products in POS
- ✅ Add products with packages
- ✅ Edit products successfully
- ✅ Update stock using stock update button
- ✅ Add products to cart with package selection
- ✅ See wholesale/retail pricing in cart
- ✅ Cart shows package name and units
- ✅ Quantity increment respects stock availability

---

**Start with Test 1 and work through in order. Stop at first failure and report!**
