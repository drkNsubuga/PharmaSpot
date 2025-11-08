# Receipt Printer Setup Guide for PharmaSpot

## Overview
PharmaSpot now supports automatic receipt printing after payment confirmation. This guide will help you set up and configure receipt printers for optimal performance.

## Recent Auto-Print Enhancement
✅ **New Feature**: Receipts now print automatically after payment confirmation (added: current session)
- When you confirm payment, the receipt modal appears AND automatically sends the receipt to your default printer
- The print happens 500ms after the modal opens to ensure the content is fully rendered
- You can still manually print again using the "Print" button in the modal if needed

## Recommended Printer Types

### 1. Thermal Receipt Printers (Recommended)
**Best for high-volume retail environments**

- **Advantages:**
  - Fast printing (up to 250mm/second)
  - No ink/toner costs
  - Compact footprint
  - Reliable for continuous use
  - Supports standard 80mm receipt paper
  
- **Popular Models:**
  - Epson TM-T20III (USB/Ethernet)
  - Star Micronics TSP143III (USB/Bluetooth/Ethernet)
  - Bixolon SRP-350III (USB/Serial/Ethernet)
  - MUNBYN 80mm Thermal Printer (Budget option)

- **Price Range:** $150 - $400 USD

### 2. Standard Laser/Inkjet Printers
**Suitable for low-volume operations**

- **Advantages:**
  - Multi-purpose (can print invoices, reports, labels)
  - Already available in most offices
  
- **Disadvantages:**
  - Slower printing
  - Ongoing ink/toner costs
  - Larger paper size (wastes paper for small receipts)
  - Less durable for continuous use

## Connection Types

### USB Connection (Simplest)
1. Plug the printer into your computer via USB
2. Install the printer drivers (usually auto-installs on Windows)
3. Set as default printer in Windows Settings
4. PharmaSpot will automatically use this printer

**Setup Steps:**
```
1. Connect printer USB cable to computer
2. Windows > Settings > Devices > Printers & scanners
3. Click "Add a printer or scanner"
4. Select your printer when detected
5. Click "Set as default"
```

### Network/Ethernet Connection (Best for Multiple Terminals)
1. Connect printer to your network router/switch via Ethernet cable
2. Configure printer IP address (check printer manual)
3. Add network printer in Windows
4. Set as default printer

**Setup Steps:**
```
1. Connect printer to network with Ethernet cable
2. Print network configuration page (button on printer)
3. Note the IP address (e.g., 192.168.1.100)
4. Windows > Settings > Devices > Printers & scanners
5. Click "Add a printer or scanner"
6. Click "The printer that I want isn't listed"
7. Select "Add a printer using a TCP/IP address"
8. Enter the printer IP address
9. Set as default
```

### Bluetooth Connection (For Mobile POS)
- Good for countertop setups with minimal cables
- May have connectivity issues in busy RF environments
- Requires Bluetooth-enabled printer and PC

## Windows Printer Configuration

### Setting Default Printer (Critical!)
PharmaSpot uses the **Windows default printer** for auto-print functionality.

**Windows 10/11:**
```
1. Press Windows + I (Settings)
2. Go to Devices > Printers & scanners
3. Click on your receipt printer
4. Click "Manage"
5. Click "Set as default"
6. IMPORTANT: Disable "Let Windows manage my default printer"
```

### Paper Size Configuration
For thermal receipt printers (80mm width):

```
1. Open Printers & scanners
2. Click your printer > Manage > Printing preferences
3. Go to Paper/Quality tab or Layout tab
4. Set paper size to:
   - Width: 80mm (or 3.15 inches)
   - Length: Continuous or 297mm
5. Set orientation to Portrait
6. Click OK and Apply
```

### Print Quality Settings
```
1. Printing preferences > Quality tab
2. Set quality to "Draft" or "Fast" for receipts
3. Disable "Print in grayscale" if needed
4. Set darkness/density to medium (thermal printers)
```

## Browser Print Settings (Important!)

### Enable Pop-up Printing
PharmaSpot uses the `print-js` library which may trigger browser pop-up blockers.

**If receipts don't print:**
1. Check the address bar for a "blocked pop-up" icon
2. Click it and select "Always allow pop-ups from this application"
3. Reload PharmaSpot

### Disable Print Dialog (Optional)
For completely silent printing without confirmation dialogs:

**Windows Only (Advanced):**
1. Use a print helper utility like `SilentPrint` or `PrintNode`
2. These tools intercept print jobs and send directly to printer
3. Configure PharmaSpot to use the helper's virtual printer

## Testing Your Printer

### Test Print from PharmaSpot
1. Add items to cart
2. Click "Pay"
3. Enter payment amount
4. Press Enter or click "Confirm Payment"
5. **Auto-print will trigger immediately**
6. Receipt modal appears with print button for manual reprint
7. Verify receipt prints correctly

### What to Check:
- [ ] Receipt prints within 1-2 seconds of confirmation
- [ ] All text is legible (not cut off)
- [ ] Store logo appears (if configured)
- [ ] Items list is complete with quantities and UoM
- [ ] Total, payment, and change amounts are correct
- [ ] Paper doesn't jam or misalign

## Troubleshooting

### ❌ Receipt Doesn't Auto-Print
**Solution:**
1. Check if manual print button works (click "Print" in receipt modal)
2. If manual works but auto doesn't, check browser console for errors (F12)
3. Verify default printer is set correctly in Windows
4. Check if pop-ups are blocked in your browser

### ❌ Print Dialog Always Appears
**Cause:** Browser security prevents silent printing

**Solutions:**
1. **Chrome/Edge**: Right-click PharmaSpot icon in taskbar > select "Open as Window" (makes it an app, not a webpage)
2. **Use kiosk mode**: Launch PharmaSpot with `--kiosk-printing` flag
3. **Install print helper**: Use PrintNode or similar service

### ❌ Receipt is Cut Off or Too Wide
**Solution:**
1. Check paper size settings (should be 80mm for thermal)
2. Adjust printer margins in printing preferences
3. The receipt HTML is designed for 80mm thermal printers
4. For standard printers, content may appear small on A4/Letter paper

### ❌ Printer Offline or Not Responding
**Solution:**
1. Check USB/network cable connection
2. Windows Settings > Printers > right-click printer > "See what's printing"
3. Click "Printer" menu > "Use Printer Online"
4. Restart printer and computer if needed
5. Update printer drivers

### ❌ Slow Printing
**Solution:**
1. Check printer queue for stuck jobs
2. Set print quality to "Draft" mode
3. Reduce receipt logo size (if large)
4. For network printers, check network speed

## Advanced: Disabling Auto-Print (If Needed)

If you prefer manual printing only, you can disable auto-print:

**Edit `assets/js/pos.js`:**
```javascript
// Around line 1154, comment out the auto-print code:

// Auto-print receipt after successful payment
// setTimeout(function() {
//   printJS({ printable: receipt, type: "raw-html" });
// }, 500);
```

Then reload PharmaSpot. You'll need to manually click "Print" in the modal.

## Best Practices

### For High-Volume Stores:
1. Use dedicated thermal receipt printer
2. Keep spare paper rolls nearby
3. Set printer to auto-cut receipts (if supported)
4. Enable network printing for multiple terminals
5. Test printer daily before opening

### For Small Stores:
1. USB thermal printer is sufficient
2. Standard office printer works for low volume
3. Manually print when needed (still very fast with auto-print)

### Maintenance:
1. Clean thermal print head monthly (use cleaning card)
2. Store thermal paper in cool, dry place
3. Replace paper rolls before they run out
4. Keep printer firmware updated
5. Test receipt legibility weekly

## Paper Specifications

### Thermal Receipt Paper (80mm)
- **Width:** 80mm (standard)
- **Core:** 12mm inner diameter
- **Roll Diameter:** 80mm max (most printers)
- **Paper Type:** Thermal (heat-sensitive, no ink needed)
- **Quality:** Choose BPA-free for health safety
- **Where to Buy:** Amazon, Staples, office supply stores

**Recommended Brands:**
- MUNBYN Thermal Paper
- Gorilla Supply Thermal Rolls
- Sparco Thermal Paper

## Cost Estimate

### Initial Setup (USB Thermal Printer):
| Item | Cost (USD) |
|------|------------|
| Epson TM-T20III Printer | $200 - $250 |
| USB Cable (usually included) | $0 |
| 50 Rolls of 80mm Thermal Paper | $30 - $50 |
| **Total Initial Cost** | **$230 - $300** |

### Ongoing Costs:
- Thermal paper: ~$0.60 - $1.00 per roll
- Average roll: 150-230 feet (600-900 receipts)
- Cost per receipt: ~$0.001 - $0.002 (very cheap!)

## Support and Resources

### PharmaSpot Receipt Configuration:
- Store logo: Settings > Store > Upload Logo
- Receipt header/footer: Settings > Store > Receipt Footer
- Tax settings: Settings > Tax > Enable VAT

### Printer Manufacturer Support:
- **Epson:** https://epson.com/support
- **Star Micronics:** https://www.starmicronics.com/support/
- **Bixolon:** https://www.bixolonusa.com/support/

### Additional Help:
- Check `index.html` line 881 for the print button in receipt modal
- Check `assets/js/pos.js` lines 1145-1160 for auto-print logic
- Check `assets/js/pos.js` line 2290 for manual print function

---

## Summary: Auto-Print Flow

```
User adds items to cart
     ↓
Clicks "Pay" button
     ↓
Payment modal opens (input auto-focused)
     ↓
User types amount and presses Enter
     ↓
Payment confirmed, AJAX saves transaction
     ↓
Receipt modal appears with transaction details
     ↓
**Auto-print triggers (500ms delay)**
     ↓
Receipt sends to default Windows printer
     ↓
User can still click "Print" button for reprint
```

**Key Features:**
✅ Auto-focus payment input (no clicking needed)
✅ Keyboard entry for payment amount
✅ Enter key confirms payment
✅ Automatic receipt printing
✅ Detailed UoM information in receipts
✅ Manual reprint option always available

---

*Last Updated: Current Session*
*PharmaSpot Version: 2.0+*
