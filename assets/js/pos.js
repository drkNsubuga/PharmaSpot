const jsPDF = require("jspdf");
const html2canvas = require("html2canvas");
const JsBarcode = require("jsbarcode");
const macaddress = require("macaddress");
const notiflix = require("notiflix");
const validator = require("validator");
const DOMPurify = require("dompurify");
const _ = require("lodash");
let fs = require("fs");
let path = require("path");
let moment = require("moment");
let { ipcRenderer } = require("electron");
let dotInterval = setInterval(function () {
  $(".dot").text(".");
}, 3000);
let Store = require("electron-store");
const remote = require("@electron/remote");
const app = remote.app;
let cart = [];
let index = 0;
let allUsers = [];
let allProducts = [];
let allCategories = [];
let allTransactions = [];
let sold = [];
let state = [];
let sold_items = [];
let item;
let auth;
let holdOrder = 0;
let vat = 0;
let perms = null;
let deleteId = 0;
let paymentType = 0;
let receipt = "";

// Make allProducts globally accessible for enhanced-uom.js
window.allProducts = allProducts;
window.allCategories = allCategories;
let totalVat = 0;
let subTotal = 0;
let method = "";
let order_index = 0;
let user_index = 0;
let product_index = 0;
let transaction_index;
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
let host = "localhost";
let port = process.env.PORT;
let img_path = path.join(appData, appName, "uploads", "/");
let api = "http://" + host + ":" + port + "/api/";
const bcrypt = require("bcrypt");
let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let totalPrice = 0;
let orderTotal = 0;
let auth_error = "Incorrect username or password";

// Make api globally accessible for enhanced-uom.js
window.api = api;
let auth_empty = "Please enter a username and password";
let holdOrderlocation = $("#renderHoldOrders");
let customerOrderLocation = $("#renderCustomerOrders");
let storage = new Store();
let settings;
let platform;
let user = {};
let start = moment().startOf("month");
let end = moment();
let start_date = moment(start).toDate();
let end_date = moment(end).toDate();
let by_till = 0;
let by_user = 0;
let by_status = 1;
const default_item_img = path.join("assets","images","default.jpg");
const permissions = [
  "perm_products",
  "perm_categories",
  "perm_transactions",
  "perm_users",
  "perm_settings",
];
notiflix.Notify.init({
  position: "right-top",
  cssAnimationDuration: 600,
  messageMaxLength: 150,
  clickToClose: true,
  closeButton: true
});
const {
  DATE_FORMAT,
  moneyFormat,
  isExpired,
  daysToExpire,
  getStockStatus,
  checkFileExists,
  setContentSecurityPolicy,
} = require("./utils");

//set the content security policy of the app
setContentSecurityPolicy();

$(function () {
  function cb(start, end) {
    $("#reportrange span").html(
      start.format("MMMM D, YYYY") + "  -  " + end.format("MMMM D, YYYY"),
    );
  }

  $("#reportrange").daterangepicker(
    {
      startDate: start,
      endDate: end,
      autoApply: true,
      timePicker: true,
      timePicker24Hour: true,
      timePickerIncrement: 10,
      timePickerSeconds: true,
      // minDate: '',
      ranges: {
        Today: [moment().startOf("day"), moment()],
        Yesterday: [
          moment().subtract(1, "days").startOf("day"),
          moment().subtract(1, "days").endOf("day"),
        ],
        "Last 7 Days": [
          moment().subtract(6, "days").startOf("day"),
          moment().endOf("day"),
        ],
        "Last 30 Days": [
          moment().subtract(29, "days").startOf("day"),
          moment().endOf("day"),
        ],
        "This Month": [moment().startOf("month"), moment().endOf("month")],
        "This Month": [moment().startOf("month"), moment()],
        "Last Month": [
          moment().subtract(1, "month").startOf("month"),
          moment().subtract(1, "month").endOf("month"),
        ],
      },
    },
    cb,
  );

  cb(start, end);

  $("#expirationDate").daterangepicker({
    singleDatePicker: true,
    locale: {
      format: DATE_FORMAT,
    },
  });
});

//Allow only numbers in input field
$.fn.allowOnlyNumbers = function() {
  return this.on('keydown', function(e) {
  // Allow: backspace, delete, tab, escape, enter, ., ctrl/cmd+A, ctrl/cmd+C, ctrl/cmd+X, ctrl/cmd+V, end, home, left, right, down, up
    if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190]) !== -1 || 
      (e.keyCode >= 35 && e.keyCode <= 40) || 
      ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && (e.ctrlKey === true || e.metaKey === true))) {
      return;
  }
  // Ensure that it is a number and stop the keypress
  if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
    e.preventDefault();
  }
});
};
$('.number-input').allowOnlyNumbers();

//Serialize Object
$.fn.serializeObject = function () {
  var o = {};
  var a = this.serializeArray();
  $.each(a, function () {
    if (o[this.name]) {
      if (!o[this.name].push) {
        o[this.name] = [o[this.name]];
      }
      o[this.name].push(this.value || "");
    } else {
      o[this.name] = this.value || "";
    }
  });
  return o;
};

auth = storage.get("auth");
user = storage.get("user");

$("#main_app").hide();
if (auth == undefined) {
  // $.get(api + "users/check/", function (data) {}); // Removed - endpoint doesn't exist

  authenticate();
} else {
  $("#login").hide();
  $("#main_app").show();
  platform = storage.get("settings");

  if (platform != undefined) {
    if (platform.app == "Network Point of Sale Terminal") {
      api = "http://" + platform.ip + ":" + port + "/api/";
      perms = true;
    }
  }

  $.get(api + "users/user/" + user._id, function (data) {
    user = data;
    $("#loggedin-user").text(user.fullname);
  });

  $.get(api + "settings/get", function (data) {
    settings = data.settings;
  });

  $.get(api + "users/all", function (users) {
    allUsers = [...users];
  });

  $(document).ready(function () {
    //update title based on company
    let appTitle = !!settings ? `${validator.unescape(settings.store)} - ${appName}` : appName;
    $("title").text(appTitle);

    $(".loading").hide();

    loadCategories();
    loadProducts();
    loadCustomers();

    if (settings && validator.unescape(settings.symbol)) {
      $("#price_curr, #payment_curr, #change_curr").text(validator.unescape(settings.symbol));
    }

    setTimeout(function () {
      if (settings == undefined && auth != undefined) {
        $("#settingsModal").modal("show");
      } else {
        vat = parseFloat(validator.unescape(settings.percentage));
        $("#taxInfo").text(settings.charge_tax ? vat : 0);
      }
    }, 1500);

    $("#settingsModal").on("hide.bs.modal", function () {
      setTimeout(function () {
        if (settings == undefined && auth != undefined) {
          $("#settingsModal").modal("show");
        }
      }, 1000);
    });

    if (0 == user.perm_products) {
      $(".p_one").hide();
    }
    if (0 == user.perm_categories) {
      $(".p_two").hide();
    }
    if (0 == user.perm_transactions) {
      $(".p_three").hide();
    }
    if (0 == user.perm_users) {
      $(".p_four").hide();
    }
    if (0 == user.perm_settings) {
      $(".p_five").hide();
    }

    $.fn.addToCart = function (id, count, stock) {
      // Find product index in allProducts
      const productIndex = allProducts.findIndex(p => p._id === id);
      
      if (productIndex === -1) {
        notiflix.Notify.failure('Product not found');
        return;
      }
      
      const product = allProducts[productIndex];
      
      // Check expiry
      if (isExpired(moment(product.expirationDate, DATE_FORMAT))) {
        notiflix.Report.failure(
          "Expired",
          `${product.name} is expired! Please restock.`,
          "Ok",
        );
        return;
      }
      
      // Check stock
      const currentStock = product.total_stock_base_units || product.quantity || 0;
      if (currentStock <= 0 && product.stock == 1) {
        notiflix.Report.failure(
          "Out of stock!",
          `${product.name} is out of stock! Please restock.`,
          "Ok",
        );
        return;
      }
      
      // Use package selector for products with packages
      $(this).selectProductPackage(productIndex);
    };

    function barcodeSearch(e) {
      e.preventDefault();
      let searchBarCodeIcon = $(".search-barcode-btn").html();
      $(".search-barcode-btn").empty();
      $(".search-barcode-btn").append(
        $("<i>", { class: "fa fa-spinner fa-spin" }),
      );

      let req = {
        skuCode: $("#skuCode").val(),
      };

      $.ajax({
        url: api + "inventory/product/sku",
        type: "POST",
        data: JSON.stringify(req),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (product) {
          $(".search-barcode-btn").html(searchBarCodeIcon);
          const expired = isExpired(product.expirationDate);
          if (product._id != undefined && product.quantity >= 1 && !expired) {
            $(this).addProductToCart(product);
            $("#searchBarCode").get(0).reset();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-ok" }),
            );
          } else if (expired) {
            notiflix.Report.failure(
              "Expired!",
              `${product.name} is expired`,
              "Ok",
            );
          } else if (product.quantity < 1) {
            notiflix.Report.info(
              "Out of stock!",
              "This item is currently unavailable",
              "Ok",
            );
          } else {
            notiflix.Report.warning(
              "Not Found!",
              "<b>" + $("#skuCode").val() + "</b> is not a valid barcode!",
              "Ok",
            );

            $("#searchBarCode").get(0).reset();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-ok" }),
            );
          }
        },
        error: function (err) {
          if (err.status === 422) {
            $(this).showValidationError(data);
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-remove" }),
            );
          } else if (err.status === 404) {
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-remove" }),
            );
          } else {
            $(this).showServerError();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-warning-sign" }),
            );
          }
        },
      });
    }

    $("#searchBarCode").on("submit", function (e) {
      barcodeSearch(e);
    });

    $("body").on("click", "#jq-keyboard button", function (e) {
      let pressed = $(this)[0].className.split(" ");
      if ($("#skuCode").val() != "" && pressed[2] == "enter") {
        barcodeSearch(e);
      }
    });

    // Select product package before adding to cart
    $.fn.selectProductPackage = function (productIndex) {
      const product = allProducts[productIndex];
      
      if (!product) {
        notiflix.Notify.failure('Product not found');
        return;
      }
      
      // Check if product is expired or out of stock
      if (isExpired(moment(product.expirationDate, DATE_FORMAT))) {
        notiflix.Report.failure(
          "Expired!",
          `${product.name} is expired`,
          "Ok"
        );
        return;
      }
      
      const currentStock = product.total_stock_base_units || product.quantity || 0;
      if (currentStock < 1) {
        notiflix.Report.info(
          "Out of stock!",
          "This item is currently unavailable",
          "Ok"
        );
        return;
      }
      
      // Parse packages
      let packages = [];
      try {
        packages = typeof product.packages === 'string' ? JSON.parse(product.packages) : product.packages || [];
      } catch (e) {
        packages = [];
      }
      
      // Check if product has packages
      if (!packages || packages.length === 0) {
        // No packages, add base unit directly
        $(this).addProductToCart(product);
        $('#Products').modal('hide');
        notiflix.Notify.success(`${product.name} added to cart`);
        return;
      }
      
      // Show package selection modal
      let packageOptions = `
        <div class="form-group">
          <label>Select Package Type:</label>
          <select id="packageSelector" class="form-control">
            <option value="base">Base Unit (${product.base_unit_name || 'Unit'}) - ${validator.unescape(settings.symbol)}${product.selling_price || product.price}</option>
      `;
      
      packages.forEach((pkg, idx) => {
        packageOptions += `<option value="${idx}">${pkg.package_name} (${pkg.units_contained} ${product.base_unit_name || 'Units'}) - Retail: ${validator.unescape(settings.symbol)}${pkg.retail_price}, Wholesale: ${validator.unescape(settings.symbol)}${pkg.wholesale_price}</option>`;
      });
      
      packageOptions += `
          </select>
        </div>
        <div class="form-group" id="priceTierGroup" style="display: none;">
          <label>Price Tier:</label>
          <select id="priceTierSelector" class="form-control">
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
      `;
      
      notiflix.Confirm.show(
        'Add to Cart',
        packageOptions,
        'Add',
        'Cancel',
        function() {
          const selectedPackage = $('#packageSelector').val();
          const selectedTier = $('#priceTierSelector').val() || 'retail';
          
          let item = {
            id: product._id,
            product_name: product.name,
            sku: product.sku || product.barcode,
            quantity: 1,
            price_tier: selectedTier,
            base_unit: product.base_unit_name || 'Unit',
            cost_price: parseFloat(product.cost_price) || 0
          };
          
          if (selectedPackage === 'base') {
            // Base unit
            item.package_name = product.base_unit_name || 'Unit';
            item.package_units = 1;
            item.retail_price = parseFloat(product.selling_price) || parseFloat(product.price) || 0;
            item.wholesale_price = item.retail_price;
            item.price = item.retail_price;
          } else {
            // Package
            const pkg = packages[parseInt(selectedPackage)];
            item.package_name = pkg.package_name;
            item.package_units = pkg.units_contained;
            item.retail_price = parseFloat(pkg.retail_price) || 0;
            item.wholesale_price = parseFloat(pkg.wholesale_price) || 0;
            item.price = selectedTier === 'retail' ? item.retail_price : item.wholesale_price;
          }
          
          // Add to cart
          if ($.fn.isExist(item)) {
            $.fn.qtIncrement(index);
          } else {
            cart.push(item);
            $.fn.renderTable(cart);
          }
          
          $('#Products').modal('hide');
          notiflix.Notify.success(`${product.name} added to cart`);
        },
        function() {
          // Cancel
        },
        {
          messageMaxLength: 1000,
          plainText: false
        }
      );
      
      // Show price tier selector when package (not base unit) is selected
      $('#packageSelector').on('change', function() {
        if ($(this).val() === 'base') {
          $('#priceTierGroup').hide();
        } else {
          $('#priceTierGroup').show();
        }
      });
    };

    $.fn.addProductToCart = function (data) {
      item = {
        id: data._id,
        product_name: data.name,
        sku: data.sku || data.barcode,
        price: parseFloat(data.selling_price) || parseFloat(data.price) || 0,
        retail_price: parseFloat(data.selling_price) || parseFloat(data.price) || 0,
        wholesale_price: parseFloat(data.wholesale_price) || parseFloat(data.selling_price) || parseFloat(data.price) || 0,
        cost_price: parseFloat(data.cost_price) || 0,
        quantity: 1,
        price_tier: 'retail',
        package_name: data.base_unit_name || 'Unit',
        package_units: 1,
        base_unit: data.base_unit_name || 'Unit'
      };

      if ($(this).isExist(item)) {
        $(this).qtIncrement(index);
      } else {
        cart.push(item);
        $(this).renderTable(cart);
      }
    };

    $.fn.isExist = function (data) {
      let toReturn = false;
      $.each(cart, function (index, value) {
        if (value.id == data.id) {
          $(this).setIndex(index);
          toReturn = true;
        }
      });
      return toReturn;
    };

    $.fn.setIndex = function (value) {
      index = value;
    };

    $.fn.calculateCart = function () {
      let total = 0;
      let grossTotal;
      let total_items = 0;
      $.each(cart, function (index, data) {
        // Use the appropriate price based on tier
        const itemPrice = data.price_tier === 'wholesale' ? 
          (data.wholesale_price || data.price) : 
          (data.retail_price || data.price);
        total += data.quantity * itemPrice;
        total_items += parseInt(data.quantity);
      });
      $("#total").text(total_items);
      total = total - $("#inputDiscount").val();
      $("#price").text(validator.unescape(settings.symbol) + moneyFormat(total.toFixed(2)));

      subTotal = total;

      if ($("#inputDiscount").val() >= total) {
        $("#inputDiscount").val(0);
      }

      if (settings.charge_tax) {
        totalVat = (total * vat) / 100;
        grossTotal = total + totalVat;
      } else {
        grossTotal = total;
      }

      orderTotal = grossTotal.toFixed(2);

      $("#gross_price").text(validator.unescape(settings.symbol) + moneyFormat(orderTotal));
      $("#payablePrice").val(moneyFormat(grossTotal));
    };

    $.fn.renderTable = function (cartList) {
      $("#cartTable .card-body").empty();
      $(this).calculateCart();
      $.each(cartList, function (index, data) {
        // Determine current price based on tier
        const currentPrice = parseFloat(data.price_tier === 'wholesale' ? (data.wholesale_price || data.price) : (data.retail_price || data.price)) || 0;
        const currencySymbol = settings && settings.symbol ? validator.unescape(settings.symbol) : '₦';
        
        // Package display
        const packageDisplay = data.package_name ? 
          `<small class="text-muted">${data.package_name} (${data.package_units || 1} ${data.base_unit || 'units'})</small>` : '';
        
        // Price tier display
        const priceTierDisplay = data.price_tier ? 
          `<small class="text-info">${data.price_tier === 'wholesale' ? 'Wholesale' : 'Retail'}: ${currencySymbol}${moneyFormat(currentPrice.toFixed(2))}</small>` : '';
        
        $("#cartTable .card-body").append(
          $("<div>", { class: "row m-t-10 border-bottom pb-2" }).append(
            $("<div>", { class: "col-md-1", text: index + 1 }),
            $("<div>", { class: "col-md-3" }).append(
              $("<strong>", { text: data.product_name }),
              $("<br>"),
              packageDisplay ? $(packageDisplay) : '',
              $("<br>"),
              priceTierDisplay ? $(priceTierDisplay) : ''
            ),
            $("<div>", { class: "col-md-3" }).append(
              $("<div>", { class: "input-group input-group-sm" }).append(
                $("<span>", { class: "input-group-btn" }).append(
                  $("<button>", {
                    class: "btn btn-light btn-sm",
                    onclick: "$(this).qtDecrement(" + index + ")",
                  }).append($("<i>", { class: "fa fa-minus" })),
                ),
                $("<input>", {
                  class: "form-control",
                  type: "text",
                  readonly: "",
                  value: data.quantity,
                  min: "1",
                  onInput: "$(this).qtInput(" + index + ")",
                }),
                $("<span>", { class: "input-group-btn" }).append(
                  $("<button>", {
                    class: "btn btn-light btn-sm",
                    onclick: "$(this).qtIncrement(" + index + ")",
                  }).append($("<i>", { class: "fa fa-plus" })),
                ),
              ),
            ),
            $("<div>", {
              class: "col-md-3",
              text:
                currencySymbol +
                moneyFormat((currentPrice * data.quantity).toFixed(2)),
            }),
            $("<div>", { class: "col-md-1" }).append(
              $("<button>", {
                class: "btn btn-light btn-xs",
                onclick: "$(this).deleteFromCart(" + index + ")",
              }).append($("<i>", { class: "fa fa-times" })),
            ),
          ),
        );
      });
    };

    $.fn.deleteFromCart = function (index) {
      cart.splice(index, 1);
      $(this).renderTable(cart);
    };

    $.fn.qtIncrement = function (i) {
      item = cart[i];
      let product = allProducts.filter(function (selected) {
        return selected._id == parseInt(item.id);
      });

      if (product[0] && product[0].stock == 1) {
        // Calculate how many base units are needed
        const packageUnits = item.package_units || 1;
        const baseUnitsNeeded = (parseInt(item.quantity) + 1) * packageUnits;
        const availableStock = product[0].total_stock_base_units || product[0].quantity || 0;
        
        if (baseUnitsNeeded <= availableStock) {
          item.quantity = parseInt(item.quantity) + 1;
          $(this).renderTable(cart);
        } else {
          notiflix.Report.info(
            "No more stock!",
            `Only ${Math.floor(availableStock / packageUnits)} ${item.package_name || 'units'} available.`,
            "Ok",
          );
        }
      } else {
        item.quantity = parseInt(item.quantity) + 1;
        $(this).renderTable(cart);
      }
    };

    $.fn.qtDecrement = function (i) {
      if (item.quantity > 1) {
        item = cart[i];
        item.quantity = parseInt(item.quantity) - 1;
        $(this).renderTable(cart);
      }
    };

    $.fn.qtInput = function (i) {
      item = cart[i];
      item.quantity = $(this).val();
      $(this).renderTable(cart);
    };

    $.fn.cancelOrder = function () {
      if (cart.length > 0) {
        const diagOptions = {
          title: "Are you sure?",
          text: "You are about to remove all items from the cart.",
          icon: "warning",
          showCancelButton: true,
          okButtonText: "Yes, clear it!",
          cancelButtonText: "Cancel",
          options: {
            // okButtonBackground: "#3085d6",
            cancelButtonBackground: "#d33",
          },
        };

        notiflix.Confirm.show(
          diagOptions.title,
          diagOptions.text,
          diagOptions.okButtonText,
          diagOptions.cancelButtonText,
          () => {
            cart = [];
            $(this).renderTable(cart);
            holdOrder = 0;
            notiflix.Report.success(
              "Cleared!",
              "All items have been removed.",
              "Ok",
            );
          },
          "",
          diagOptions.options,
        );
      }
    };

    $("#payButton").on("click", function () {
      if (cart.length != 0) {
        $("#paymentModel").modal("toggle");
        // Auto-focus payment input after modal opens - reduced delay for faster typing
        setTimeout(function() {
          $("#paymentText").focus().select();
        }, 300);
      } else {
        notiflix.Report.warning("Oops!", "There is nothing to pay!", "Ok");
      }
    });

    $("#hold").on("click", function () {
      if (cart.length != 0) {
        $("#dueModal").modal("toggle");
      } else {
        notiflix.Report.warning("Oops!", "There is nothing to hold!", "Ok");
      }
    });

    function printJobComplete() {
      notiflix.Report.success("Done", "print job complete", "Ok");
    }

    $.fn.submitDueOrder = function (status) {
      let items = "";
      let payment = 0;
      paymentType = $('.list-group-item.active').data('payment-type');
      cart.forEach((item) => {
        // Build item display with UoM information
        let itemName = DOMPurify.sanitize(item.product_name);
        let qtyDisplay = DOMPurify.sanitize(item.quantity);
        
        // Add package info if available
        if (item.package_name) {
          qtyDisplay = `${item.quantity} ${item.package_name}`;
          if (item.units_per_package) {
            qtyDisplay += ` (${item.quantity * item.units_per_package} ${item.base_unit || 'units'})`;
          }
        } else if (item.base_unit) {
          qtyDisplay += ` ${item.base_unit}`;
        }
        
        // Show price tier if available
        let priceDisplay = DOMPurify.sanitize(validator.unescape(settings.symbol)) + ' ' + moneyFormat(
          DOMPurify.sanitize(Math.abs(item.price).toFixed(2))
        );
        
        if (item.price_tier) {
          priceDisplay += ` (${item.price_tier})`;
        }
        
        items += `<tr>
          <td>${itemName}</td>
          <td>${qtyDisplay}</td>
          <td class="text-right">${priceDisplay}</td>
        </tr>`;
      });

      let currentTime = new Date(moment());
      let discount = $("#inputDiscount").val();
      let customer = JSON.parse($("#customer").val());
      let date = moment(currentTime).format("YYYY-MM-DD HH:mm:ss");
      let paymentAmount = $("#payment").val().replace(",", "");
      let changeAmount = $("#change").text().replace(",", "");
      let paid =
        $("#payment").val() == "" ? "" : parseFloat(paymentAmount).toFixed(2);
      let change =
        $("#change").text() == "" ? "" : parseFloat(changeAmount).toFixed(2);
      let refNumber = $("#refNumber").val();
      let orderNumber = holdOrder;
      let type = "";
      let tax_row = "";
      switch (paymentType) {
        case 1:
          type = "Cash";
          break;
        case 3:
          type = "Card";
          break;
      }

      if (paid != "") {
        payment = `<tr>
                        <td>Paid</td>
                        <td>:</td>
                        <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                          Math.abs(paid).toFixed(2),
                        )}</td>
                    </tr>
                    <tr>
                        <td>Change</td>
                        <td>:</td>
                        <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                          Math.abs(change).toFixed(2),
                        )}</td>
                    </tr>
                    <tr>
                        <td>Method</td>
                        <td>:</td>
                        <td class="text-right">${type}</td>
                    </tr>`;
      }

      if (settings.charge_tax) {
        tax_row = `<tr>
                    <td>VAT(${validator.unescape(settings.percentage)})% </td>
                    <td>:</td>
                    <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                      parseFloat(totalVat).toFixed(2),
                    )}</td>
                </tr>`;
      }

      if (status == 0) {
        if ($("#customer").val() == 0 && $("#refNumber").val() == "") {
          notiflix.Report.warning(
            "Reference Required!",
            "You either need to select a customer <br> or enter a reference!",
            "Ok",
          );
          return;
        }
      }

      $(".loading").show();

      if (holdOrder != 0) {
        orderNumber = holdOrder;
        method = "PUT";
      } else {
        orderNumber = Math.floor(Date.now() / 1000);
        method = "POST";
      }

      logo = path.join(img_path, validator.unescape(settings.img));

      receipt = `<div style="font-size: 10px">                            
        <p style="text-align: center;">
        ${
          checkFileExists(logo)
            ? `<img style='max-width: 50px' src='${logo}' /><br>`
            : ``
        }
            <span style="font-size: 22px;">${validator.unescape(settings.store)}</span> <br>
            ${validator.unescape(settings.address_one)} <br>
            ${validator.unescape(settings.address_two)} <br>
            ${
              validator.unescape(settings.contact) != "" ? "Tel: " + validator.unescape(settings.contact) + "<br>" : ""
            } 
            ${validator.unescape(settings.tax) != "" ? "Vat No: " + validator.unescape(settings.tax) + "<br>" : ""} 
        </p>
        <hr>
        <left>
            <p>
            Order No : ${orderNumber} <br>
            Ref No : ${refNumber == "" ? orderNumber : _.escape(refNumber)} <br>
            Customer : ${
              customer == 0 ? "Walk in customer" : _.escape(customer.name)
            } <br>
            Cashier : ${user.fullname} <br>
            Date : ${date}<br>
            </p>

        </left>
        <hr>
        <table width="90%">
            <thead>
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th class="text-right">Price</th>
            </tr>
            </thead>
            <tbody>
             ${items}                
            <tr><td colspan="3"><hr></td></tr>
            <tr>                        
                <td><b>Subtotal</b></td>
                <td>:</td>
                <td class="text-right"><b>${validator.unescape(settings.symbol)}${moneyFormat(
                  subTotal.toFixed(2),
                )}</b></td>
            </tr>
            <tr>
                <td>Discount</td>
                <td>:</td>
                <td class="text-right">${
                  discount > 0
                    ? validator.unescape(settings.symbol) +
                      moneyFormat(parseFloat(discount).toFixed(2))
                    : ""
                }</td>
            </tr>
            ${tax_row}
            <tr>
                <td><h5>Total</h5></td>
                <td><h5>:</h5></td>
                <td class="text-right">
                    <h5>${validator.unescape(settings.symbol)} ${moneyFormat(
                      parseFloat(orderTotal).toFixed(2),
                    )}</h3>
                </td>
            </tr>
            ${payment == 0 ? "" : payment}
            </tbody>
            </table>
            <br>
            <hr>
            <br>
            <p style="text-align: center;">
             ${validator.unescape(settings.footer)}
             </p>
            </div>`;

      if (status == 3) {
        if (cart.length > 0) {
          printJS({ printable: receipt, type: "raw-html" });

          $(".loading").hide();
          return;
        } else {
          $(".loading").hide();
          return;
        }
      }

      let data = {
        order: orderNumber,
        ref_number: refNumber,
        discount: discount,
        customer: customer,
        status: status,
        subtotal: parseFloat(subTotal).toFixed(2),
        tax: totalVat,
        order_type: 1,
        items: cart,
        date: currentTime,
        payment_type: type,
        payment_info: $("#paymentInfo").val(),
        total: orderTotal,
        paid: paid,
        change: change,
        _id: orderNumber,
        till: platform.till,
        mac: platform.mac,
        user: user.fullname,
        user_id: user._id,
      };

      $.ajax({
        url: api + "new",
        type: method,
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (data) {
          cart = [];
          receipt = DOMPurify.sanitize(receipt,{ ALLOW_UNKNOWN_PROTOCOLS: true });
          $("#viewTransaction").html("");
          $("#viewTransaction").html(receipt);
          $("#orderModal").modal("show");
          
          // Auto-print receipt after successful payment
          setTimeout(function() {
            printJS({ printable: receipt, type: "raw-html" });
          }, 500);
          
          loadProducts();
          loadCustomers();
          $(".loading").hide();
          $("#dueModal").modal("hide");
          $("#paymentModel").modal("hide");
          $(this).getHoldOrders();
          $(this).getCustomerOrders();
          $(this).renderTable(cart);
        },

        error: function (data) {
          $(".loading").hide();
          $("#dueModal").modal("toggle");
          notiflix.Report.failure(
            "Something went wrong!",
            "Please refresh this page and try again",
            "Ok",
          );
        },
      });

      $("#refNumber").val("");
      $("#change").text("");
      $("#payment,#paymentText").val("");
    };

    $.get(api + "on-hold", function (data) {
      holdOrderList = data;
      holdOrderlocation.empty();
      // clearInterval(dotInterval);
      $(this).renderHoldOrders(holdOrderList, holdOrderlocation, 1);
    });

    $.fn.getHoldOrders = function () {
      $.get(api + "on-hold", function (data) {
        holdOrderList = data;
        clearInterval(dotInterval);
        holdOrderlocation.empty();
        $(this).renderHoldOrders(holdOrderList, holdOrderlocation, 1);
      });
    };

    $.fn.renderHoldOrders = function (data, renderLocation, orderType) {
      $.each(data, function (index, order) {
        $(this).calculatePrice(order);
        renderLocation.append(
          $("<div>", {
            class:
              orderType == 1 ? "col-md-3 order" : "col-md-3 customer-order",
          }).append(
            $("<a>").append(
              $("<div>", { class: "card-box order-box" }).append(
                $("<p>").append(
                  $("<b>", { text: "Ref :" }),
                  $("<span>", { text: order.ref_number, class: "ref_number" }),
                  $("<br>"),
                  $("<b>", { text: "Price :" }),
                  $("<span>", {
                    text: order.total,
                    class: "label label-info",
                    style: "font-size:14px;",
                  }),
                  $("<br>"),
                  $("<b>", { text: "Items :" }),
                  $("<span>", { text: order.items.length }),
                  $("<br>"),
                  $("<b>", { text: "Customer :" }),
                  $("<span>", {
                    text:
                      order.customer != 0
                        ? order.customer.name
                        : "Walk in customer",
                    class: "customer_name",
                  }),
                ),
                $("<button>", {
                  class: "btn btn-danger del",
                  onclick:
                    "$(this).deleteOrder(" + index + "," + orderType + ")",
                }).append($("<i>", { class: "fa fa-trash" })),

                $("<button>", {
                  class: "btn btn-default",
                  onclick:
                    "$(this).orderDetails(" + index + "," + orderType + ")",
                }).append($("<span>", { class: "fa fa-shopping-basket" })),
              ),
            ),
          ),
        );
      });
    };

    $.fn.calculatePrice = function (data) {
      totalPrice = 0;
      $.each(data.products, function (index, product) {
        totalPrice += product.price * product.quantity;
      });

      let vat = (totalPrice * data.vat) / 100;
      totalPrice = (totalPrice + vat - data.discount).toFixed(0);

      return totalPrice;
    };

    $.fn.orderDetails = function (index, orderType) {
      $("#refNumber").val("");

      if (orderType == 1) {
        $("#refNumber").val(holdOrderList[index].ref_number);

        $("#customer option:selected").removeAttr("selected");

        $("#customer option")
          .filter(function () {
            return $(this).text() == "Walk in customer";
          })
          .prop("selected", true);

        holdOrder = holdOrderList[index]._id;
        cart = [];
        $.each(holdOrderList[index].items, function (index, product) {
          item = {
            id: product.id,
            product_name: product.product_name,
            sku: product.sku,
            price: product.price,
            quantity: product.quantity,
          };
          cart.push(item);
        });
      } else if (orderType == 2) {
        $("#refNumber").val("");

        $("#customer option:selected").removeAttr("selected");

        $("#customer option")
          .filter(function () {
            return $(this).text() == customerOrderList[index].customer.name;
          })
          .prop("selected", true);

        holdOrder = customerOrderList[index]._id;
        cart = [];
        $.each(customerOrderList[index].items, function (index, product) {
          item = {
            id: product.id,
            product_name: product.product_name,
            sku: product.sku,
            price: product.price,
            quantity: product.quantity,
          };
          cart.push(item);
        });
      }
      $(this).renderTable(cart);
      $("#holdOrdersModal").modal("hide");
      $("#customerModal").modal("hide");
    };

    $.fn.deleteOrder = function (index, type) {
      switch (type) {
        case 1:
          deleteId = holdOrderList[index]._id;
          break;
        case 2:
          deleteId = customerOrderList[index]._id;
      }

      let data = {
        orderId: deleteId,
      };
      let diagOptions = {
        title: "Delete order?",
        text: "This will delete the order. Are you sure you want to delete!",
        icon: "warning",
        showCancelButton: true,
        okButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        okButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "delete",
            type: "POST",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            cache: false,
            success: function (data) {
              $(this).getHoldOrders();
              $(this).getCustomerOrders();

              notiflix.Report.success(
                "Deleted!",
                "You have deleted the order!",
                "Ok",
              );
            },
            error: function (data) {
              $(".loading").hide();
            },
          });
        },
      );
    };

    $.fn.getCustomerOrders = function () {
      $.get(api + "customer-orders", function (data) {
        //clearInterval(dotInterval);
        customerOrderList = data;
        customerOrderLocation.empty();
        $(this).renderHoldOrders(customerOrderList, customerOrderLocation, 2);
      });
    };

    $("#saveCustomer").on("submit", function (e) {
      e.preventDefault();

      let custData = {
        _id: Math.floor(Date.now() / 1000),
        name: $("#userName").val(),
        phone: $("#phoneNumber").val(),
        email: $("#emailAddress").val(),
        address: $("#userAddress").val(),
      };

      $.ajax({
        url: api + "customers/customer",
        type: "POST",
        data: JSON.stringify(custData),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (data) {
          $("#newCustomer").modal("hide");
          notiflix.Report.success(
            "Customer added!",
            "Customer added successfully!",
            "Ok",
          );
          $("#customer option:selected").removeAttr("selected");
          $("#customer").append(
            $("<option>", {
              text: custData.name,
              value: `{"id": ${custData._id}, "name": ${custData.name}}`,
              selected: "selected",
            }),
          );

          $("#customer")
            .val(`{"id": ${custData._id}, "name": ${custData.name}}`)
            .trigger("chosen:updated");
        },
        error: function (data) {
          $("#newCustomer").modal("hide");
          notiflix.Report.failure(
            "Error",
            "Something went wrong please try again",
            "Ok",
          );
        },
      });
    });

    $("#confirmPayment").hide();

    $("#cardInfo").hide();

    $("#payment").on("input", function () {
      $(this).calculateChange();
    });
    $("#confirmPayment").on("click", function () {
      if ($("#payment").val() == "") {
        notiflix.Report.warning(
          "Nope!",
          "Please enter the amount that was paid!",
          "Ok",
        );
      } else {
        $(this).submitDueOrder(1);
      }
    });

    $("#transactions").on("click", function () {
      loadTransactions();
      loadUserList();

      $("#pos_view").hide();
      $("#pointofsale").show();
      $("#transactions_view").show();
      $(this).hide();
    });

    $("#pointofsale").on("click", function () {
      $("#pos_view").show();
      $("#transactions").show();
      $("#transactions_view").hide();
      $(this).hide();
    });

    $("#viewRefOrders").on("click", function () {
      setTimeout(function () {
        $("#holdOrderInput").focus();
      }, 500);
    });

    $("#viewCustomerOrders").on("click", function () {
      setTimeout(function () {
        $("#holdCustomerOrderInput").focus();
      }, 500);
    });

    $("#newProductModal").on("click", function () {
      $("#saveProduct").get(0).reset();
      $("#current_img").text("");
      $("#packages_container").empty();
      $("#product_id").val("");
      packageCounter = 0;
    });

    $("#saveProduct").submit(function (e) {
      e.preventDefault();

      // Collect packages from form
      const packages = collectPackagesFromForm();
      
      // Get form data
      const productId = $("#product_id").val();
      const isEdit = productId && productId !== "";
      
      // Create a hidden input for packages if it doesn't exist
      if ($('#packages_input').length === 0) {
        $('<input>').attr({
          type: 'hidden',
          id: 'packages_input',
          name: 'packages'
        }).appendTo('#saveProduct');
      }
      $('#packages_input').val(JSON.stringify(packages));
      
      // Set default values for min stock if not provided
      const totalStock = $("#total_stock_base_units").val();
      const minStock = $("#min_stock_base_units").val() || Math.floor(totalStock / 2);
      $("#min_stock_base_units").val(minStock);
      
      // Set wholesale price if not provided
      if (!$("#wholesale_price").val()) {
        $("#wholesale_price").val($("#selling_price").val());
      }
      
      // Set quantity field (for backward compatibility)
      if ($('#quantity_hidden').length === 0) {
        $('<input>').attr({
          type: 'hidden',
          id: 'quantity_hidden',
          name: 'quantity'
        }).appendTo('#saveProduct');
      }
      $('#quantity_hidden').val(totalStock);
      
      // Set minStock field (for backward compatibility)
      if ($('#minStock_hidden').length === 0) {
        $('<input>').attr({
          type: 'hidden',
          id: 'minStock_hidden',
          name: 'minStock'
        }).appendTo('#saveProduct');
      }
      $('#minStock_hidden').val(minStock);

      $(this).attr("action", api + "inventory/product");
      $(this).attr("method", "POST");

      $(this).ajaxSubmit({
        success: function (response) {
          $("#saveProduct").get(0).reset();
          $("#current_img").text("");
          $("#packages_container").empty();
          packageCounter = 0;

          loadProducts();
          
          diagOptions = {
            title: "Product Saved",
            text: "Select an option below to continue.",
            okButtonText: "Add another",
            cancelButtonText: "Close",
          };

          notiflix.Confirm.show(
            diagOptions.title,
            diagOptions.text,
            diagOptions.okButtonText,
            diagOptions.cancelButtonText,
            ()=>{},
            () => {
              $("#newProduct").modal("hide");
            },
          );
        },
        //error for product
       error: function (jqXHR,textStatus, errorThrown) {
      console.error(jqXHR);
      const errorMsg = jqXHR.responseJSON ? jqXHR.responseJSON.message : "Failed to save product";
      const errorTitle = jqXHR.responseJSON ? jqXHR.responseJSON.error : "Error";
      notiflix.Report.failure(
        errorTitle,
        errorMsg,
        "Ok",
      );
      }

      });
    });

    $("#saveCategory").submit(function (e) {
      e.preventDefault();

      if ($("#category_id").val() == "") {
        method = "POST";
      } else {
        method = "PUT";
      }

      $.ajax({
        type: method,
        url: api + "categories/category",
        data: $(this).serialize(),
        success: function (data, textStatus, jqXHR) {
          $("#saveCategory").get(0).reset();
          loadCategories();
          loadProducts();
          diagOptions = {
            title: "Category Saved",
            text: "Select an option below to continue.",
            okButtonText: "Add another",
            cancelButtonText: "Close",
          };

          notiflix.Confirm.show(
            diagOptions.title,
            diagOptions.text,
            diagOptions.okButtonText,
            diagOptions.cancelButtonText,
            ()=>{},

            () => {
                $("#newCategory").modal("hide");
            },
          );
        },
      });
    });

    $.fn.editProduct = function (index) {
      $("#Products").modal("hide");
      
      const product = allProducts[index];

      // Set category
      $("#category option")
        .filter(function () {
          return $(this).val() == product.category || $(this).val() == product.category_id;
        })
        .prop("selected", true);

      // Basic fields
      $("#productName").val(product.name);
      $("#barcode").val(product.barcode || product._id);
      $("#expirationDate").val(product.expirationDate);
      $("#product_id").val(product._id);
      $("#img").val(product.img);
      
      // UoM fields
      $("#base_unit_name").val(product.base_unit_name || "Unit");
      $("#total_stock_base_units").val(product.total_stock_base_units || product.quantity || 0);
      $("#min_stock_base_units").val(product.min_stock_base_units || product.minStock || 0);
      $("#cost_price").val(product.cost_price || product.price || 0);
      $("#selling_price").val(product.selling_price || product.price || 0);
      $("#wholesale_price").val(product.wholesale_price || product.selling_price || product.price || 0);
      
      // Stock check
      if (product.stock == 0) {
        $("#stock").prop("checked", true);
      } else {
        $("#stock").prop("checked", false);
      }

      // Image handling
      if (product.img != "") {
        $("#imagename").hide();
        $("#current_img").html(
          `<img src="${img_path + product.img}" alt="">`,
        );
        $("#rmv_img").show();
      }
      
      // Populate packages
      $("#packages_container").empty();
      packageCounter = 0;
      
      if (product.packages) {
        let packageArray = [];
        try {
          packageArray = typeof product.packages === 'string' ? JSON.parse(product.packages) : product.packages;
        } catch (e) {
          console.error('Error parsing packages:', e);
        }
        
        if (Array.isArray(packageArray) && packageArray.length > 0) {
          packageArray.forEach((pkg) => {
            addPackageRow(pkg);
          });
        }
      }

      $("#newProduct").modal("show");
    };

    $("#userModal").on("hide.bs.modal", function () {
      $(".perms").hide();
    });

    $.fn.editUser = function (index) {
      user_index = index;

      $("#Users").modal("hide");

      $(".perms").show();

      $("#user_id").val(allUsers[index]._id);
      $("#fullname").val(allUsers[index].fullname);
      $("#username").val(validator.unescape(allUsers[index].username));
      $("#password").attr("placeholder", "New Password");
    

      for (perm of permissions) {
        var el = "#" + perm;
        if (allUsers[index][perm] == 1) {
          $(el).prop("checked", true);
        } else {
          $(el).prop("checked", false);
        }
      }

      $("#userModal").modal("show");
    };

    $.fn.editCategory = function (index) {
      $("#Categories").modal("hide");
      $("#categoryName").val(allCategories[index].name);
      $("#category_id").val(allCategories[index]._id);
      $("#newCategory").modal("show");
    };

    $.fn.deleteProduct = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this product.",
        okButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "inventory/product/" + id,
            type: "DELETE",
            success: function (result) {
              loadProducts();
              notiflix.Report.success("Done!", "Product deleted", "Ok");
            },
          });
        },
      );
    };

    $.fn.deleteUser = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this user.",
        cancelButtonColor: "#d33",
        okButtonText: "Yes, delete!",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "users/user/" + id,
            type: "DELETE",
            success: function (result) {
              loadUserList();
              notiflix.Report.success("Done!", "User deleted", "Ok");
            },
          });
        },
      );
    };

    $.fn.deleteCategory = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this category.",
        okButtonText: "Yes, delete it!",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "categories/category/" + id,
            type: "DELETE",
            success: function (result) {
              loadCategories();
              notiflix.Report.success("Done!", "Category deleted", "Ok");
            },
          });
        },
      );
    };

    $("#productModal").on("click", function () {
      loadProductList();
    });

    $("#usersModal").on("click", function () {
      loadUserList();
    });

    $("#categoryModal").on("click", function () {
      loadCategoryList();
    });

    function loadUserList() {
      let counter = 0;
      let user_list = "";
      $("#user_list").empty();
      $("#userList").DataTable().destroy();

      $.get(api + "users/all", function (users) {
        allUsers = [...users];

        users.forEach((user, index) => {
          state = [];
          let class_name = "";

          if (user.status != "") {
            state = user.status.split("_");
            login_status = state[0];
            login_time = state[1];

            switch (login) {
              case "Logged In":
                class_name = "btn-default";

                break;
              case "Logged Out":
                class_name = "btn-light";
                break;
            }
          }

          counter++;
          user_list += `<tr>
            <td>${user.fullname}</td>
            <td>${user.username}</td>
            <td class="${class_name}">${
              state.length > 0 ? login_status : ""
            } <br><small> ${state.length > 0 ? login_time : ""}</small></td>
            <td>${
              user._id == 1
                ? '<span class="btn-group"><button class="btn btn-dark"><i class="fa fa-edit"></i></button><button class="btn btn-dark"><i class="fa fa-trash"></i></button></span>'
                : '<span class="btn-group"><button onClick="$(this).editUser(' +
                  index +
                  ')" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' +
                  user._id +
                  ')" class="btn btn-danger"><i class="fa fa-trash"></i></button></span>'
            }</td></tr>`;

          if (counter == users.length) {
            $("#user_list").html(user_list);

            $("#userList").DataTable({
              order: [[1, "desc"]],
              autoWidth: false,
              info: true,
              JQueryUI: true,
              ordering: true,
              paging: false,
            });
          }
        });
      });
    }

    $("#log-out").on("click", function () {
      const diagOptions = {
        title: "Are you sure?",
        text: "You are about to log out.",
        cancelButtonColor: "#3085d6",
        okButtonText: "Logout",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.get(api + "users/logout/" + user._id, function (data) {
            storage.delete("auth");
            storage.delete("user");
            ipcRenderer.send("app-reload", "");
          });
        },
      );
    });

    $("#settings_form").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();
      let mac_address;

      api = "http://" + host + ":" + port + "/api/";

      macaddress.one(function (err, mac) {
        mac_address = mac;
      });
      const appChoice = $("#app").find("option:selected").text();
    
      formData["app"] = appChoice;
      formData["mac"] = mac_address;
      formData["till"] = 1;

      // Update application field in settings form
      let $appField = $("#settings_form input[name='app']");
      let $hiddenAppField = $('<input>', {
        type: 'hidden',
        name: 'app',
        value: formData.app
    });
        $appField.length 
            ? $appField.val(formData.app) 
            : $("#settings_form").append(`<input type="hidden" name="app" value="${$hiddenAppField}" />`);


      if (formData.percentage != "" && typeof formData.percentage === 'number') {
        notiflix.Report.warning(
          "Oops!",
          "Please make sure the tax value is a number",
          "Ok",
        );
      } else {
        storage.set("settings", formData);

        $(this).attr("action", api + "settings/post");
        $(this).attr("method", "POST");

        $(this).ajaxSubmit({
          contentType: "application/json",
          success: function () {
            ipcRenderer.send("app-reload", "");
          },
          error: function (jqXHR) {
            const errorMsg = jqXHR.responseJSON?.message || jqXHR.statusText || 'An unexpected error occurred';
            const errorTitle = jqXHR.responseJSON?.error || 'Error';
            console.error(errorMsg);
            notiflix.Report.failure(
              errorTitle,
              errorMsg,
              "Ok",
            );
      }
    });
    }
  });

    $("#net_settings_form").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();

      if (formData.till == 0 || formData.till == 1) {
        notiflix.Report.warning(
          "Oops!",
          "Please enter a number greater than 1.",
          "Ok",
        );
      } else {
        if (isNumeric(formData.till)) {
          formData["app"] = $("#app").find("option:selected").text();
          storage.set("settings", formData);
          ipcRenderer.send("app-reload", "");
        } else {
          notiflix.Report.warning(
            "Oops!",
            "Till number must be a number!",
            "Ok",
          );
        }
      }
    });

    $("#saveUser").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();

      if (formData.password != formData.pass) {
        notiflix.Report.warning("Oops!", "Passwords do not match!", "Ok");
      }

      if (
        bcrypt.compare(formData.password, user.password) ||
        bcrypt.compare(formData.password, allUsers[user_index].password)
      ) {
        $.ajax({
          url: api + "users/post",
          type: "POST",
          data: JSON.stringify(formData),
          contentType: "application/json; charset=utf-8",
          cache: false,
          processData: false,
          success: function (data) {
            if (ownUserEdit) {
              ipcRenderer.send("app-reload", "");
            } else {
              $("#userModal").modal("hide");

              loadUserList();

              $("#Users").modal("show");
              notiflix.Report.success("Great!", "User details saved!", "Ok");
            }
          },
          error: function (jqXHR,textStatus, errorThrown) {
            notiflix.Report.failure(
              jqXHR.responseJSON.error,
              jqXHR.responseJSON.message,
              "Ok",
            );
          },
        });
      }
    });

    $("#app").on("change", function () {
      if (
        $(this).find("option:selected").text() ==
        "Network Point of Sale Terminal"
      ) {
        $("#net_settings_form").show(500);
        $("#settings_form").hide(500);
        macaddress.one(function (err, mac) {
          $("#mac").val(mac);
        });
      } else {
        $("#net_settings_form").hide(500);
        $("#settings_form").show(500);
      }
    });

    $("#cashier").on("click", function () {
      ownUserEdit = true;

      $("#userModal").modal("show");

      $("#user_id").val(user._id);
      $("#fullname").val(user.fullname);
      $("#username").val(user.username);
      $("#password").attr("placeholder", "New Password");

      for (perm of permissions) {
        var el = "#" + perm;
        if (allUsers[index][perm] == 1) {
          $(el).prop("checked", true);
        } else {
          $(el).prop("checked", false);
        }
      }
    });

    $("#add-user").on("click", function () {
      if (platform.app != "Network Point of Sale Terminal") {
        $(".perms").show();
      }

      $("#saveUser").get(0).reset();
      $("#userModal").modal("show");
    });

    $("#settings").on("click", function () {
      if (platform.app == "Network Point of Sale Terminal") {
        $("#net_settings_form").show(500);
        $("#settings_form").hide(500);

        $("#ip").val(platform.ip);
        $("#till").val(platform.till);

        macaddress.one(function (err, mac) {
          $("#mac").val(mac);
        });

        $("#app option")
          .filter(function () {
            return $(this).text() == platform.app;
          })
          .prop("selected", true);
      } else {
        $("#net_settings_form").hide(500);
        $("#settings_form").show(500);

        $("#settings_id").val("1");
        $("#store").val(validator.unescape(settings.store));
        $("#address_one").val(validator.unescape(settings.address_one));
        $("#address_two").val(validator.unescape(settings.address_two));
        $("#contact").val(validator.unescape(settings.contact));
        $("#tax").val(validator.unescape(settings.tax));
        $("#symbol").val(validator.unescape(settings.symbol));
        $("#percentage").val(validator.unescape(settings.percentage));
        $("#footer").val(validator.unescape(settings.footer));
        $("#logo_img").val(validator.unescape(settings.img));
        if (settings.charge_tax) {
          $("#charge_tax").prop("checked", true);
        }
        if (validator.unescape(settings.img) != "") {
          $("#logoname").hide();
          $("#current_logo").html(
            `<img src="${img_path + validator.unescape(settings.img)}" alt="">`,
          );
          $("#rmv_logo").show();
        }

        $("#app option")
          .filter(function () {
            return $(this).text() == validator.unescape(settings.app);
          })
          .prop("selected", true);
      }
    });
 });

  $("#rmv_logo").on("click", function () {
    $("#remove_logo").val("1");
    // $("#logo_img").val('');
    $("#current_logo").hide(500);
    $(this).hide(500);
    $("#logoname").show(500);
  });

  $("#rmv_img").on("click", function () {
    $("#remove_img").val("1");
    // $("#img").val('');
    $("#current_img").hide(500);
    $(this).hide(500);
    $("#imagename").show(500);
  });
}

$.fn.print = function () {
  printJS({ printable: receipt, type: "raw-html" });
};

function loadTransactions() {
  let tills = [];
  let users = [];
  let sales = 0;
  let transact = 0;
  let unique = 0;

  sold_items = [];
  sold = [];

  let counter = 0;
  let transaction_list = "";
  let query = `by-date?start=${start_date}&end=${end_date}&user=${by_user}&status=${by_status}&till=${by_till}`;

  $.get(api + query, function (transactions) {
    if (transactions.length > 0) {
      $("#transaction_list").empty();
      $("#transactionList").DataTable().destroy();

      allTransactions = [...transactions];

      transactions.forEach((trans, index) => {
        sales += parseFloat(trans.total);
        transact++;

        trans.items.forEach((item) => {
          sold_items.push(item);
        });

        if (!tills.includes(trans.till)) {
          tills.push(trans.till);
        }

        if (!users.includes(trans.user_id)) {
          users.push(trans.user_id);
        }

        counter++;
        transaction_list += `<tr>
                                <td>${trans.order}</td>
                                <td class="nobr">${moment(trans.date).format(
                                  "DD-MMM-YYYY HH:mm:ss",
                                )}</td>
                                <td>${
                                  validator.unescape(settings.symbol) + moneyFormat(trans.total)
                                }</td>
                                <td>${
                                  trans.paid == ""
                                    ? ""
                                    : validator.unescape(settings.symbol) + moneyFormat(trans.paid)
                                }</td>
                                <td>${
                                  trans.change
                                    ? validator.unescape(settings.symbol) +
                                      moneyFormat(
                                        Math.abs(trans.change).toFixed(2),
                                      )
                                    : ""
                                }</td>
                                <td>${
                                  trans.paid == ""
                                    ? ""
                                    : trans.payment_type
                                }</td>
                                <td>${trans.till}</td>
                                <td>${trans.user}</td>
                                <td>${
                                  trans.paid == ""
                                    ? '<button class="btn btn-dark"><i class="fa fa-search-plus"></i></button>'
                                    : '<button onClick="$(this).viewTransaction(' +
                                      index +
                                      ')" class="btn btn-info"><i class="fa fa-search-plus"></i></button></td>'
                                }</tr>
                    `;

        if (counter == transactions.length) {
          $("#total_sales #counter").text(
            validator.unescape(settings.symbol) + moneyFormat(parseFloat(sales).toFixed(2)),
          );
          $("#total_transactions #counter").text(transact);

          const result = {};

          for (const { product_name, price, quantity, id } of sold_items) {
            if (!result[product_name]) result[product_name] = [];
            result[product_name].push({ id, price, quantity });
          }

          for (item in result) {
            let price = 0;
            let quantity = 0;
            let id = 0;

            result[item].forEach((i) => {
              id = i.id;
              price = i.price;
              quantity = quantity + parseInt(i.quantity);
            });

            sold.push({
              id: id,
              product: item,
              qty: quantity,
              price: price,
            });
          }

          loadSoldProducts();

          if (by_user == 0 && by_till == 0) {
            userFilter(users);
            tillFilter(tills);
          }

          $("#transaction_list").html(transaction_list);
          $("#transactionList").DataTable({
            order: [[1, "desc"]],
            autoWidth: false,
            info: true,
            JQueryUI: true,
            ordering: true,
            paging: true,
            dom: "Bfrtip",
            buttons: ["csv", "excel", "pdf"],
          });
        }
      });
    } else {
      notiflix.Report.warning(
        "No data!",
        "No transactions available within the selected criteria",
        "Ok",
      );
    }
  });
}

function sortDesc(a, b) {
  if (a.qty > b.qty) {
    return -1;
  }
  if (a.qty < b.qty) {
    return 1;
  }
  return 0;
}

function loadSoldProducts() {
  sold.sort(sortDesc);

  let counter = 0;
  let sold_list = "";
  let items = 0;
  let products = 0;
  $("#product_sales").empty();

  sold.forEach((item, index) => {
    items = items + parseInt(item.qty);
    products++;

    let product = allProducts.filter(function (selected) {
      return selected._id == item.id;
    });

    counter++;

    sold_list += `<tr>
            <td>${item.product}</td>
            <td>${item.qty}</td>
            <td>${
              product[0].stock == 1
                ? product.length > 0
                  ? product[0].quantity
                  : ""
                : "N/A"
            }</td>
            <td>${
              validator.unescape(settings.symbol) +
              moneyFormat((item.qty * parseFloat(item.price)).toFixed(2))
            }</td>
            </tr>`;

    if (counter == sold.length) {
      $("#total_items #counter").text(items);
      $("#total_products #counter").text(products);
      $("#product_sales").html(sold_list);
    }
  });
}

function userFilter(users) {
  $("#users").empty();
  $("#users").append(`<option value="0">All</option>`);

  users.forEach((user) => {
    let u = allUsers.filter(function (usr) {
      return usr._id == user;
    });

    // Only add option if user exists
    if (u && u.length > 0 && u[0] && u[0].fullname) {
      $("#users").append(`<option value="${user}">${u[0].fullname}</option>`);
    } else {
      // Fallback: show user ID if user data not found
      $("#users").append(`<option value="${user}">User #${user}</option>`);
    }
  });
}

function tillFilter(tills) {
  $("#tills").empty();
  $("#tills").append(`<option value="0">All</option>`);
  tills.forEach((till) => {
    $("#tills").append(`<option value="${till}">${till}</option>`);
  });
}

$.fn.viewTransaction = function (index) {
  transaction_index = index;

  let discount = allTransactions[index].discount;
  let customer =
    allTransactions[index].customer == 0
      ? "Walk in Customer"
      : allTransactions[index].customer.username;
  let refNumber =
    allTransactions[index].ref_number != ""
      ? allTransactions[index].ref_number
      : allTransactions[index].order;
  let orderNumber = allTransactions[index].order;
  let paymentMethod = "";
  let tax_row = "";
  let items = "";
  let products = allTransactions[index].items;

  products.forEach((item) => {
    // Build item display with UoM information
    let itemName = item.product_name;
    let qtyDisplay = item.quantity;
    
    // Add package info if available
    if (item.package_name) {
      qtyDisplay = `${item.quantity} ${item.package_name}`;
      if (item.units_per_package) {
        qtyDisplay += ` (${item.quantity * item.units_per_package} ${item.base_unit || 'units'})`;
      }
    } else if (item.base_unit) {
      qtyDisplay += ` ${item.base_unit}`;
    }
    
    // Show price tier if available
    let priceDisplay = validator.unescape(settings.symbol) + ' ' + moneyFormat(Math.abs(item.price).toFixed(2));
    if (item.price_tier) {
      priceDisplay += ` (${item.price_tier})`;
    }
    
    items += `<tr>
      <td>${itemName}</td>
      <td>${qtyDisplay}</td>
      <td class="text-right">${priceDisplay}</td>
    </tr>`;
  });

  paymentMethod = allTransactions[index].payment_type;
 

  if (allTransactions[index].paid != "") {
    payment = `<tr>
                    <td>Paid</td>
                    <td>:</td>
                    <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                      Math.abs(allTransactions[index].paid).toFixed(2),
                    )}</td>
                </tr>
                <tr>
                    <td>Change</td>
                    <td>:</td>
                    <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                      Math.abs(allTransactions[index].change).toFixed(2),
                    )}</td>
                </tr>
                <tr>
                    <td>Method</td>
                    <td>:</td>
                    <td class="text-right">${paymentMethod}</td>
                </tr>`;
  }

  if (settings.charge_tax) {
    tax_row = `<tr>
                <td>Vat(${validator.unescape(settings.percentage)})% </td>
                <td>:</td>
                <td class="text-right">${validator.unescape(settings.symbol)}${parseFloat(
                  allTransactions[index].tax,
                ).toFixed(2)}</td>
            </tr>`;
  }

    logo = path.join(img_path, validator.unescape(settings.img));
      
      receipt = `<div style="font-size: 10px">                            
        <p style="text-align: center;">
        ${
          checkFileExists(logo)
            ? `<img style='max-width: 50px' src='${logo}' /><br>`
            : ``
        }
            <span style="font-size: 22px;">${validator.unescape(settings.store)}</span> <br>
            ${validator.unescape(settings.address_one)} <br>
            ${validator.unescape(settings.address_two)} <br>
            ${
              validator.unescape(settings.contact) != "" ? "Tel: " + validator.unescape(settings.contact) + "<br>" : ""
            } 
            ${validator.unescape(settings.tax) != "" ? "Vat No: " + validator.unescape(settings.tax) + "<br>" : ""} 
    </p>
    <hr>
    <left>
        <p>
        Invoice : ${orderNumber} <br>
        Ref No : ${refNumber} <br>
        Customer : ${
          allTransactions[index].customer == 0
            ? "Walk in Customer"
            : allTransactions[index].customer.name
        } <br>
        Cashier : ${allTransactions[index].user} <br>
        Date : ${moment(allTransactions[index].date).format(
          "DD MMM YYYY HH:mm:ss",
        )}<br>
        </p>

    </left>
    <hr>
    <table width="90%">
        <thead>
        <tr>
            <th>Item</th>
            <th>Qty</th>
            <th class="text-right">Price</th>
        </tr>
        </thead>
        <tbody>
        ${items}                
        <tr><td colspan="3"><hr></td></tr>
        <tr>                        
            <td><b>Subtotal</b></td>
            <td>:</td>
            <td class="text-right"><b>${validator.unescape(settings.symbol)}${moneyFormat(
              allTransactions[index].subtotal,
            )}</b></td>
        </tr>
        <tr>
            <td>Discount</td>
            <td>:</td>
            <td class="text-right">${
              discount > 0
                ? validator.unescape(settings.symbol) +
                  moneyFormat(
                    parseFloat(allTransactions[index].discount).toFixed(2),
                  )
                : ""
            }</td>
        </tr>
        
        ${tax_row}
    
        <tr>
            <td><h5>Total</h5></td>
            <td><h5>:</h5></td>
            <td class="text-right">
                <h5>${validator.unescape(settings.symbol)}${moneyFormat(
                  allTransactions[index].total,
                )}</h5>
            </td>
        </tr>
        ${payment == 0 ? "" : payment}
        </tbody>
        </table>
        <br>
        <hr>
        <br>
        <p style="text-align: center;">
         ${validator.unescape(settings.footer)}
         </p>
        </div>`;

        //prevent DOM XSS; allow windows paths in img src
        receipt = DOMPurify.sanitize(receipt,{ ALLOW_UNKNOWN_PROTOCOLS: true });

  $("#viewTransaction").html("");
  $("#viewTransaction").html(receipt);

  $("#orderModal").modal("show");
};

$("#status").on("change", function () {
  by_status = $(this).find("option:selected").val();
  loadTransactions();
});

$("#tills").on("change", function () {
  by_till = $(this).find("option:selected").val();
  loadTransactions();
});

$("#users").on("change", function () {
  by_user = $(this).find("option:selected").val();
  loadTransactions();
});

$("#reportrange").on("apply.daterangepicker", function (ev, picker) {
  start = picker.startDate.format("DD MMM YYYY hh:mm A");
  end = picker.endDate.format("DD MMM YYYY hh:mm A");

  start_date = picker.startDate.toDate().toJSON();
  end_date = picker.endDate.toDate().toJSON();

  loadTransactions();
});

// Global functions - extracted from document.ready for enhanced-uom.js accessibility
function loadProducts() {
  $.get(api + "inventory/products", function (data) {
    data.forEach((item) => {
      item.price = parseFloat(item.price).toFixed(2);
    });

    allProducts = [...data];
    window.allProducts = allProducts;

    loadProductList();

    let delay = 0;
    let expiredCount = 0;
    allProducts.forEach((product) => {
      let todayDate = moment();
      let expiryDate = moment(product.expirationDate, DATE_FORMAT);

      if (!isExpired(expiryDate)) {
        const diffDays = daysToExpire(expiryDate);

        if (diffDays > 0 && diffDays <= 30) {
          var days_noun = diffDays > 1 ? "days" : "day";
          notiflix.Notify.warning(
            `${product.name} has only ${diffDays} ${days_noun} left to expiry`,
          );
        }
      } else {
        expiredCount++;
      }
    });

    if(expiredCount>0) {
       notiflix.Notify.failure(
      `${expiredCount} ${
        expiredCount > 0 ? "products" : "product"
      } expired. Please restock!`,
    );
    }

   
    $("#parent").text("");

    data.forEach((item) => {
      if (!categories.includes(item.category)) {
        categories.push(item.category);
      }
      let item_isExpired = isExpired(item.expirationDate);
      let item_stockStatus = getStockStatus(item.quantity,item.minStock);
      let item_img;
      if(!item.img || item.img === "" || item.img === undefined) {
        item_img = default_item_img;
      } else {
        item_img = path.join(img_path, item.img);
        item_img = checkFileExists(item_img) ? item_img : default_item_img;
      }
      
      const currentStock = item.total_stock_base_units || item.quantity || 0;
      const displayPrice = item.selling_price || item.price || 0;
      const baseUnit = item.base_unit_name || '';
      
      const hasImage = item.img && checkFileExists(item_img);
      const imageHtml = hasImage 
        ? `<img src="${item_img}" id="product_img" alt="" style="width: 100%; height: 100%; object-fit: cover;">` 
        : `<i class="glyphicon glyphicon-shopping-cart" style="font-size: 48px; color: #999; padding: 20px;"></i>`;
      
      let item_info = `<div class="col-lg-2 box ${item.category}"
                            onclick="$(this).addToCart(${item._id}, ${
                              currentStock
                            }, ${item.stock})">
                        <div class="widget-panel widget-style-2 " title="${item.name}">                    
                        <div id="image" style="display: flex; align-items: center; justify-content: center; min-height: 80px;">${imageHtml}</div>                    
                                    <div class="text-muted m-t-5 text-center">
                                    <div class="name" id="product_name"><span class="${
                                      item_isExpired ? "text-danger" : ""
                                    }">${item.name}</span></div> 
                                    <span class="sku">${
                                      item.barcode || item._id
                                    }</span>
                                    <span class="${item_stockStatus<1?'text-danger':''}"><span class="stock">STOCK </span><span class="count">${
                                      item.stock == 1
                                        ? currentStock + (baseUnit ? ' ' + baseUnit : '')
                                        : "N/A"
                                    }</span></span></div>
                                    <span class="text-success text-center"><b data-plugin="counterup">${
                                      validator.unescape(settings.symbol) +
                                      moneyFormat(displayPrice)
                                    }</b> </span>
                        </div>
                    </div>`;
      $("#parent").append(item_info);
    });
  });
}

function loadCategories() {
  $.get(api + "categories/all", function (data) {
    allCategories = data;
    window.allCategories = allCategories;
    loadCategoryList();
    $("#category,#categories").html(`<option value="0">Select</option>`);
    allCategories.forEach((category) => {
      $("#category,#categories").append(
        `<option value="${category._id}">${category.name}</option>`,
      );
    });
  });
}

function loadCustomers() {
  $.get(api + "customers/all", function (customers) {
    $("#customer").html(
      `<option value="0" selected="selected">Walk in customer</option>`,
    );

    customers.forEach((cust) => {
      let customer = `<option value='{"id": ${cust._id}, "name": "${cust.name}"}'>${cust.name}</option>`;
      $("#customer").append(customer);
    });
  });
}

function loadProductList() {
  let products = [...allProducts];
  let product_list = "";
  let counter = 0;
  $("#product_list").empty();
  $("#productList").DataTable().destroy();

  products.forEach((product, index) => {
    counter++;

    let category = allCategories.filter(function (category) {
      return category._id == product.category || category._id == product.category_id;
    });

    product.stockAlert = "";
    const todayDate = moment();
    const expiryDate = moment(product.expirationDate, DATE_FORMAT);

    const currentStock = product.total_stock_base_units || product.quantity || 0;
    const minStock = product.min_stock_base_units || product.minStock || 0;
    const stockStatus = getStockStatus(currentStock, minStock);
      if(stockStatus<=0) {
      if (stockStatus === 0) {
        product.stockStatus = "No Stock";
        icon = "fa fa-exclamation-triangle";
      }
      if (stockStatus === -1) {
        product.stockStatus = "Low Stock";
        icon = "fa fa-caret-down";
      }

      product.stockAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.stockStatus}</small></p>`;
    }
    product.expiryAlert = "";
    if (!isExpired(expiryDate)) {
      const diffDays = daysToExpire(expiryDate);

      if (diffDays > 0 && diffDays <= 30) {
        var days_noun = diffDays > 1 ? "days" : "day";
        icon = "fa fa-clock-o";
        product.expiryStatus = `${diffDays} ${days_noun} left`;
        product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
      }
    } else {
      icon = "fa fa-exclamation-triangle";
      product.expiryStatus = "Expired";
      product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
    }

    if(product.img==="") {
      product_img=default_item_img;
    } else {
      product_img = img_path + product.img;
      product_img = checkFileExists(product_img) ? product_img : default_item_img;
    }
    
    let packageInfo = "";
    let packages = [];
    try {
      packages = typeof product.packages === 'string' ? JSON.parse(product.packages) : product.packages || [];
    } catch (e) {
      packages = [];
    }
    
    if (Array.isArray(packages) && packages.length > 0) {
      packageInfo = "<ul style='margin: 0; font-size: 11px; padding-left: 15px;'>";
      packages.forEach(pkg => {
        const pkgName = pkg.package_name || 'Unnamed';
        const units = pkg.units_contained || 0;
        const baseUnit = product.base_unit_name || 'units';
        const retailPrice = pkg.retail_price || 0;
        const wholesalePrice = pkg.wholesale_price || 0;
        const symbol = settings && settings.symbol ? validator.unescape(settings.symbol) : '₦';
        
        packageInfo += `<li><strong>${pkgName}</strong> (${units} ${baseUnit}): 
          R: ${symbol}${retailPrice} | W: ${symbol}${wholesalePrice}</li>`;
      });
      packageInfo += "</ul>";
    } else {
      packageInfo = "<small class='text-muted'>No packages</small>";
    }
    
    const currencySymbol = settings && settings.symbol ? validator.unescape(settings.symbol) : '₦';
    product_list +=
      `<tr>
        <td>${product.name}
        ${product.expiryAlert}</td>
        <td>${product.base_unit_name || 'Unit'}</td>
        <td>${currencySymbol}${product.cost_price || product.price || 0}</td>
        <td>${currencySymbol}${product.selling_price || product.price || 0}</td>
        <td>${packageInfo}</td>
        <td>${product.stock == 1 ? currentStock : "N/A"}
        ${product.stockAlert}
        </td>
        <td>${product.expirationDate}</td>
        <td>${category.length > 0 ? category[0].name : ""}</td>
        <td class="nobr"><span class="btn-group">
        <button onClick="openStockUpdate('${product._id}')" class="btn btn-info btn-sm" title="Update Stock"><i class="fa fa-cubes"></i></button>
        <button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm" title="Edit"><i class="fa fa-edit"></i></button>
        <button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm" title="Delete"><i class="fa fa-trash"></i></button>
        </span></td></tr>`;

    if (counter == allProducts.length) {
      $("#product_list").html(product_list);
    }
  });

  $("#productList").DataTable({
    order: [[0, "asc"]],
    autoWidth: false,
    info: true,
    JQueryUI: true,
    ordering: true,
    paging: false,
    dom: "Bfrtip",
    columnDefs: [
      { orderable: true, targets: [0, 1, 2, 3, 5, 6, 7] },
      { orderable: false, targets: [4, 8] }
    ],
    buttons: [
      {
        extend: "pdfHtml5",
        className: "btn btn-light",
        text: " Download PDF",
        filename: "product_list.pdf",
      },
    ],
  });
}

function loadCategoryList() {
  let category_list = "";
  let counter = 0;
  $("#category_list").empty();
  $("#categoryList").DataTable().destroy();

  allCategories.forEach((category, index) => {
    counter++;

    category_list += `<tr>
 
        <td>${category.name}</td>
        <td><span class="btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger"><i class="fa fa-trash"></i></button></span></td></tr>`;
  });

  if (counter == allCategories.length) {
    $("#category_list").html(category_list);
    $("#categoryList").DataTable({
      autoWidth: false,
      info: true,
      JQueryUI: true,
      ordering: true,
      paging: false,
    });
  }
}

window.loadProducts = loadProducts;
window.loadProductList = loadProductList;
window.loadCategories = loadCategories;

function authenticate() {
  $(".loading").hide();
  $("body").attr("class", "login-page");
  $("#login").show();
}

$("body").on("submit", "#account", function (e) {
  e.preventDefault();
  let formData = $(this).serializeObject();

  if (formData.username == "" || formData.password == "") {
    notiflix.Report.warning("Incomplete form!", auth_empty, "Ok");
  } else {
    $.ajax({
      url: api + "users/login",
      type: "POST",
      data: JSON.stringify(formData),
      contentType: "application/json; charset=utf-8",
      cache: false,
      processData: false,
      success: function (data) {
        if (data.auth === true) {
          storage.set("auth", { auth: true });
          storage.set("user", data);
          ipcRenderer.send("app-reload", "");
          $("#login").hide();
        } else {
          notiflix.Report.warning("Oops!", auth_error, "Ok");
        }
      },
      error: function (data) {
        console.log(data);
      },
    });
  }
});

$("#quit").on("click", function () {
  const diagOptions = {
    title: "Are you sure?",
    text: "You are about to close the application.",
    icon: "warning",
    okButtonText: "Close Application",
    cancelButtonText: "Cancel"
  };

  notiflix.Confirm.show(
    diagOptions.title,
    diagOptions.text,
    diagOptions.okButtonText,
    diagOptions.cancelButtonText,
    () => {
      ipcRenderer.send("app-quit", "");
    },
  );
});

ipcRenderer.on("click-element", (event, elementId) => {
  document.getElementById(elementId).click();
});