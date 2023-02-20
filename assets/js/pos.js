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
let receipt = '';
let totalVat = 0;
let subTotal = 0;
let method = '';
let order_index = 0;
let user_index = 0;
let product_index = 0;
let transaction_index;
let host = 'localhost';
let path = require('path');
let moment = require('moment');
let Swal = require('sweetalert2');
let { ipcRenderer } = require('electron');
let dotInterval = setInterval(function() { $(".dot").text('.') }, 3000);
let Store = require('electron-store');
const remote = require('@electron/remote');
const app = remote.app;
let port = process.env.PORT;
let img_path = app.getPath('appData') + '/POS/uploads/';
let api = 'http://' + host + ':' + port + '/api/';
const bcrypt = require('bcrypt');
const saltRounds = 24;
const jsPDF = require('jspdf');
const html2canvas = require('html2canvas');
const JsBarcode = require('jsbarcode');
const macaddress = require('macaddress');
const notiflix = require('notiflix');
let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let totalPrice = 0;
let orderTotal = 0;
let auth_error = 'Incorrect username or password';
let auth_empty = 'Please enter a username and password';
let holdOrderlocation = $("#randerHoldOrders");
let customerOrderLocation = $("#randerCustomerOrders");
let storage = new Store();
let settings;
let platform;
let user = {};
let start = moment().startOf('month');
let end = moment();
let start_date = moment(start).toDate();
let end_date = moment(end).toDate();
let by_till = 0;
let by_user = 0;
let by_status = 1;
const permissions = [
    "perm_products",
    "perm_categories",
    "perm_transactions",
    "perm_users",
    "perm_settings"
];
notiflix.Notify.init({
    position: "right-top",
    cssAnimationDuration: 600,
    messageMaxLength: 150,
    clickToClose: true,
    closeButton: true
});
const DATE_FORMAT = 'DD-MMM-YYYY';

const moneyFormat = (amount, locale = 'en-US') => {
    return new Intl.NumberFormat(locale).format(amount);
};

const isExpired = (dueDate)=>{
            let todayDate = moment();
            let expiryDate = moment(dueDate, DATE_FORMAT);
            return todayDate.isSameOrAfter(dueDate)
        }

module.exports = { moneyFormat }

$(function() {

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + '  -  ' + end.format('MMMM D, YYYY'));
    }

    $('#reportrange').daterangepicker({
        startDate: start,
        endDate: end,
        autoApply: true,
        timePicker: true,
        timePicker24Hour: true,
        timePickerIncrement: 10,
        timePickerSeconds: true,
        // minDate: '',
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
            'Last 7 Days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
            'Last 30 Days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);

    cb(start, end);

    $("#expirationDate").daterangepicker({
        singleDatePicker: true,
        locale: {
            format: DATE_FORMAT
        }
    });


});


$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};


auth = storage.get('auth');
user = storage.get('user');

$("#main_app").hide();
if (auth == undefined) {
    $.get(api + 'users/check/', function(data) {});

    authenticate();

} else {

    $('#login').hide();
    $("#main_app").show();
    platform = storage.get('settings');

    if (platform != undefined) {

        if (platform.app == 'Network Point of Sale Terminal') {
            api = 'http://' + platform.ip + ':' + port + '/api/';
            perms = true;
        }
    }

    $.get(api + 'users/user/' + user._id, function(data) {
        user = data;
        $('#loggedin-user').text(user.fullname);
    });


    $.get(api + 'settings/get', function(data) {
        settings = data.settings;
    });


    $.get(api + 'users/all', function(users) {
        allUsers = [...users];
    });



    $(document).ready(function() {
        //update title based on company
        let appName = $('title').text();
        let appTitle = !!settings?`${settings.store} - ${appName}`:appName; 
        $('title').text(appTitle);

        $(".loading").hide();

        loadCategories();
        loadProducts();
        loadCustomers();


        if (settings && settings.symbol) {
            $("#price_curr, #payment_curr, #change_curr").text(settings.symbol);
        }


        setTimeout(function() {
            if (settings == undefined && auth != undefined) {
                $('#settingsModal').modal('show');
            } else {
                vat = parseFloat(settings.percentage);
                $("#taxInfo").text(settings.charge_tax ? vat : 0);
            }

        }, 1500);



        $("#settingsModal").on("hide.bs.modal", function() {

            setTimeout(function() {
                if (settings == undefined && auth != undefined) {
                    $('#settingsModal').modal('show');
                }
            }, 1000);

        });


        if (0 == user.perm_products) { $(".p_one").hide() };
        if (0 == user.perm_categories) { $(".p_two").hide() };
        if (0 == user.perm_transactions) { $(".p_three").hide() };
        if (0 == user.perm_users) { $(".p_four").hide() };
        if (0 == user.perm_settings) { $(".p_five").hide() };

        function loadProducts() {

            $.get(api + 'inventory/products', function(data) {

                data.forEach(item => {
                    item.price = parseFloat(item.price).toFixed(2);
                });

                allProducts = [...data];

                loadProductList();

                let delay = 0;
                allProducts.forEach(product => {
                    let todayDate = moment();
                    let expiryDate = moment(product.expirationDate, DATE_FORMAT);

                    if (todayDate.isBefore(expiryDate)) {
                        const diffDays = Math.abs(todayDate.startOf('day').diff(expiryDate, 'days'));

                        if (diffDays > 0 && diffDays <= 30) {
                            var days_noun = diffDays > 1 ? "days" : "day";
                            notiflix.Notify.warning(`${product.name} has only ${diffDays} ${days_noun} left to expiry`);
                        }
                    } else {
                        notiflix.Notify.failure(`${product.name} is expired. Please restock!`);
                    }


                })

                $('#parent').text('');

                data.forEach(item => {

                    if (!categories.includes(item.category)) {
                        categories.push(item.category);
                    }

                    let item_info = `<div class="col-lg-2 box ${item.category}"
                                onclick="$(this).addToCart(${item._id}, ${item.quantity}, ${item.stock})">
                            <div class="widget-panel widget-style-2 ">                    
                            <div id="image"><img src="${item.img == "" ? "./assets/images/default.jpg" : img_path + item.img}" id="product_img" alt=""></div>                    
                                        <div class="text-muted m-t-5 text-center">
                                        <div class="name" id="product_name">${item.name}</div> 
                                        <span class="sku">${item.barcode||item._id}</span>
                                        <span class="stock">STOCK </span><span class="count">${item.stock == 1 ? item.quantity : 'N/A'}</span></div>
                                        <span class="text-success text-center"><b data-plugin="counterup">${settings.symbol + moneyFormat(item.price)}</b> </span>
                            </div>
                        </div>`;
                    $('#parent').append(item_info);
                });


            });

        }

        function loadCategories() {
            $.get(api + 'categories/all', function(data) {
                allCategories = data;
                loadCategoryList();
                $('#category,#categories').html(`<option value="0">Select</option>`);
                allCategories.forEach(category => {
                    $('#category,#categories').append(`<option value="${category._id}">${category.name}</option>`);
                });
            });
        }


        function loadCustomers() {
            $.get(api + 'customers/all', function(customers) {

                $('#customer').html(`<option value="0" selected="selected">Walk in customer</option>`);

                customers.forEach(cust => {

                    let customer = `<option value='{"id": ${cust._id}, "name": "${cust.name}"}'>${cust.name}</option>`;
                    $('#customer').append(customer);
                });

                //  $('#customer').chosen();

            });

        }


        $.fn.addToCart = function(id, count, stock) {
            $.get(api + 'inventory/product/' + id, function(product) {
                // let todayDate = moment();
                // let expiryDate = moment(product.expirationDate, DATE_FORMAT);
                // let expired = isExpired(expiryDate)

                if (isExpired(product.expirationDate)) {
                    notiflix.Report.failure(
                        'Expired',
                        'This item is expired!',
                        'Ok'
                    );
                } else {

                    if (count > 0) {
                        $(this).addProductToCart(product);
                    } else {
                        if (stock == 1) {

                            notiflix.Report.failure(
                                'Out of stock!',
                                '<span class="text-center">This item is currently unavailable</span>',
                                'Ok'
                            );
                        }
                    }

                }
            });
        }


        function barcodeSearch(e) {

            e.preventDefault();
            let searchBarCodeIcon = $(".search-barcode-btn").html();
            $(".search-barcode-btn").empty();
            $(".search-barcode-btn").append(
                $('<i>', { class: 'fa fa-spinner fa-spin' })
            );

            let req = {
                skuCode: $("#skuCode").val()
            }

            $.ajax({
                url: api + 'inventory/product/sku',
                type: 'POST',
                data: JSON.stringify(req),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function(data) {
                    $(".search-barcode-btn").html(searchBarCodeIcon);
                    let expired=isExpired(data.expirationDate);
                    if (data._id != undefined && data.quantity >= 1 && !expired) {
                        $(this).addProductToCart(data);
                        $("#searchBarCode").get(0).reset();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-ok' })
                        )
                    } 
                     else if (expired) {
                        notiflix.Report.failure(
                            'Expired!',
                            'This item is expired',
                            'Ok'
                        );
                     }
                    else if (data.quantity < 1) {
                        notiflix.Report.info(
                            'Out of stock!',
                            'This item is currently unavailable',
                            'Ok'
                        );
                    } else {

                        notiflix.Report.warning(
                            'Not Found!',
                            '<b>' + $("#skuCode").val() + '</b> is not a valid barcode!',
                            'Ok'
                        );

                        $("#searchBarCode").get(0).reset();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-ok' })
                        )
                    }

                },
                error: function(data) {
                    if (data.status === 422) {
                        $(this).showValidationError(data);
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-remove' })
                        )
                    } else if (data.status === 404) {
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-remove' })
                        )
                    } else {
                        $(this).showServerError();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-warning-sign' })
                        )
                    }
                }
            });

        }


        $("#searchBarCode").on('submit', function(e) {
            barcodeSearch(e);
        });



        $('body').on('click', '#jq-keyboard button', function(e) {
            let pressed = $(this)[0].className.split(" ");
            if ($("#skuCode").val() != "" && pressed[2] == "enter") {
                barcodeSearch(e);
            }
        });



        $.fn.addProductToCart = function(data) {
            item = {
                id: data._id,
                product_name: data.name,
                sku: data.sku,
                price: data.price,
                quantity: 1
            };

            if ($(this).isExist(item)) {
                $(this).qtIncrement(index);
            } else {
                cart.push(item);
                $(this).renderTable(cart)
            }
        }


        $.fn.isExist = function(data) {
            let toReturn = false;
            $.each(cart, function(index, value) {
                if (value.id == data.id) {
                    $(this).setIndex(index);
                    toReturn = true;
                }
            });
            return toReturn;
        }


        $.fn.setIndex = function(value) {
            index = value;
        }


        $.fn.calculateCart = function() {
            let total = 0;
            let grossTotal;
            let total_items = 0;
            $.each(cart, function(index, data) {
                total += data.quantity * data.price;
                total_items += parseInt(data.quantity);
            });
            $('#total').text(total_items);
            total = total - $("#inputDiscount").val();
            $('#price').text(settings.symbol + moneyFormat(total.toFixed(2)));

            subTotal = total;

            if ($("#inputDiscount").val() >= total) {
                $("#inputDiscount").val(0);
            }

            if (settings.charge_tax) {
                totalVat = ((total * vat) / 100);
                grossTotal = total + totalVat
            } else {
                grossTotal = total;
            }

            orderTotal = grossTotal.toFixed(2);

            $("#gross_price").text(settings.symbol + moneyFormat(orderTotal));
            $("#payablePrice").val(moneyFormat(grossTotal));

        }
        
        $.fn.renderTable = function(cartList) {
            $('#cartTable .card-body').empty();
            $(this).calculateCart();
            $.each(cartList, function(index, data) {
                $('#cartTable .card-body').append(
                    $('<div>', { class: 'row m-t-10' }).append(
                        $('<div>', { class: 'col-md-1', text: index + 1 }),
                        $('<div>', { class: 'col-md-3', text: data.product_name }),
                        $('<div>', { class: 'col-md-3' }).append(
                            $('<div>', { class: 'input-group' }).append(
                                $('<span>', { class: 'input-group-btn' }).append(
                                    $('<button>', {
                                        class: 'btn btn-light',
                                        onclick: '$(this).qtDecrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-minus' })
                                    )
                                ),
                                $('<input>', {
                                    class: 'form-control',
                                    type: 'text',
                                    readonly: '',
                                    value: data.quantity,
                                    min: '1',
                                    onInput: '$(this).qtInput(' + index + ')'
                                }),
                                $('<span>', { class: 'input-group-btn' }).append(
                                    $('<button>', {
                                        class: 'btn btn-light',
                                        onclick: '$(this).qtIncrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-plus' })
                                    )
                                )
                            )
                        ),
                        $('<div>', { class: 'col-md-3', text: settings.symbol + moneyFormat((data.price * data.quantity).toFixed(2)) }),
                        $('<div>', { class: 'col-md-1' }).append(
                            $('<button>', {
                                class: 'btn btn-light btn-xs',
                                onclick: '$(this).deleteFromCart(' + index + ')'
                            }).append(
                                $('<i>', { class: 'fa fa-times' })
                            )
                        )
                    )
                )
            })
        };


        $.fn.deleteFromCart = function(index) {
            cart.splice(index, 1);
            $(this).renderTable(cart);

        }


        $.fn.qtIncrement = function(i) {
            item = cart[i];
            let product = allProducts.filter(function(selected) {
                return selected._id == parseInt(item.id);
            });

            if (product[0].stock == 1) {
                if (item.quantity < product[0].quantity) {
                    item.quantity = parseInt(item.quantity) + 1;
                    $(this).renderTable(cart);
                } else {
                    notiflix.Report.info(
                        'No more stock!',
                        'You have already added all the available stock.',
                        'Ok'
                    );
                }
            } else {
                item.quantity = parseInt(item.quantity) + 1;
                $(this).renderTable(cart);
            }

        }


        $.fn.qtDecrement = function(i) {
            if (item.quantity > 1) {
                item = cart[i];
                item.quantity = parseInt(item.quantity) - 1;
                $(this).renderTable(cart);
            }
        }


        $.fn.qtInput = function(i) {
            item = cart[i];
            item.quantity = $(this).val();
            $(this).renderTable(cart);
        }


        $.fn.cancelOrder = function() {

            if (cart.length > 0) {
                let diagOptions={
                    title: 'Are you sure?',
                    text: "You are about to remove all items from the cart.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, clear it!'
                    
                }

                notiflix.Confirm.show(
                    diagOptions.title,
                    diagOptions.text,
                    'Yes',
                    'No'
                    ).then((result) => {

                    if (result.value) {

                        cart = [];
                        $(this).renderTable(cart);
                        holdOrder = 0;

                        notiflix.Report.success(
                            'Cleared!',
                            'All items have been removed.',
                            'Ok'
                        )
                    }
                });
            }

        }


        $("#payButton").on('click', function() {
            if (cart.length != 0) {
                $("#paymentModel").modal('toggle');
            } else {
                notiflix.Report.warning(
                    'Oops!',
                    'There is nothing to pay!',
                    'Ok'
                );
            }

        });


        $("#hold").on('click', function() {

            if (cart.length != 0) {

                $("#dueModal").modal('toggle');
            } else {
                notiflix.Report.warning(
                    'Oops!',
                    'There is nothing to hold!',
                    'Ok'
                );
            }
        });


        function printJobComplete() {
            alert("print job complete");
        }


        $.fn.submitDueOrder = function(status) {
            let items = "";
            let payment = 0;
            cart.forEach(item => {
                items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + moneyFormat(parseFloat(item.price).toFixed(2)) + "</td></tr>";
            });

            let currentTime = new Date(moment());
            let discount = $("#inputDiscount").val();
            let customer = JSON.parse($("#customer").val());
            let date = moment(currentTime).format("YYYY-MM-DD HH:mm:ss");
            let paymentAmount = $("#payment").val().replace(',', '');
            let changeAmount = $("#change").text().replace(',', '');
            let paid = $("#payment").val() == "" ? "" : parseFloat(paymentAmount).toFixed(2);
            let change = $("#change").text() == "" ? "" : parseFloat(changeAmount).toFixed(2);
            let refNumber = $("#refNumber").val();
            let orderNumber = holdOrder;
            let type = "";
            let tax_row = "";
            switch (paymentType) {
                case 1:
                    type = "Cheque";
                    break;
                case 2:
                    type = "Card";
                    break;
                default:
                    type = "Cash";
            }


            if (paid != "") {
                payment = `<tr>
                        <td>Paid</td>
                        <td>:</td>
                        <td>${settings.symbol + paid}</td>
                    </tr>
                    <tr>
                        <td>Change</td>
                        <td>:</td>
                        <td>${settings.symbol + moneyFormat(Math.abs(change).toFixed(2))}</td>
                    </tr>
                    <tr>
                        <td>Method</td>
                        <td>:</td>
                        <td>${type}</td>
                    </tr>`
            }



            if (settings.charge_tax) {
                tax_row = `<tr>
                    <td>Vat(${settings.percentage})% </td>
                    <td>:</td>
                    <td>${settings.symbol}${parseFloat(totalVat).toFixed(2)}</td>
                </tr>`;
            }



            if (status == 0) {

                if ($("#customer").val() == 0 && $("#refNumber").val() == "") {
                    Swal.fire(
                        'Reference Required!',
                        'You either need to select a customer <br> or enter a reference!',
                        'warning'
                    )

                    return;
                }
            }


            $(".loading").show();


            if (holdOrder != 0) {

                orderNumber = holdOrder;
                method = 'PUT'
            } else {
                orderNumber = Math.floor(Date.now() / 1000);
                method = 'POST'
            }


            receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${settings.img == "" ? settings.img : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
        </p>
        <hr>
        <left>
            <p>
            Order No : ${orderNumber} <br>
            Ref No : ${refNumber == "" ? orderNumber : refNumber} <br>
            Customer : ${customer == 0 ? 'Walk in customer' : customer.name} <br>
            Cashier : ${user.fullname} <br>
            Date : ${date}<br>
            </p>

        </left>
        <hr>
        <table class="table table-responsive">
            <thead style="text-align: left;">
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
            </tr>
            </thead>
            <tbody>
            ${items}                
     
            <tr>                        
                <td><b>Subtotal</b></td>
                <td>:</td>
                <td><b>${settings.symbol}${moneyFormat(subTotal.toFixed(2))}</b></td>
            </tr>
            <tr>
                <td>Discount</td>
                <td>:</td>
                <td>${discount > 0 ? settings.symbol + moneyFormat(parseFloat(discount).toFixed(2)) : ''}</td>
            </tr>
            
            ${tax_row}
        
            <tr>
                <td><h3>Total</h3></td>
                <td><h3>:</h3></td>
                <td>
                    <h3>${settings.symbol}${moneyFormat(parseFloat(orderTotal).toFixed(2))}</h3>
                </td>
            </tr>
            ${payment == 0 ? '' : payment}
            </tbody>
            </table>
            <br>
            <hr>
            <br>
            <p style="text-align: center;">
             ${settings.footer}
             </p>
            </div>`;


            if (status == 3) {
                if (cart.length > 0) {

                    printJS({ printable: receipt, type: 'raw-html' });

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
                user_id: user._id
            }


            $.ajax({
                url: api + 'new',
                type: method,
                data: JSON.stringify(data),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function(data) {

                    cart = [];
                    $('#viewTransaction').html('');
                    $('#viewTransaction').html(receipt);
                    $('#orderModal').modal('show');
                    loadProducts();
                    loadCustomers();
                    $(".loading").hide();
                    $("#dueModal").modal('hide');
                    $("#paymentModel").modal('hide');
                    $(this).getHoldOrders();
                    $(this).getCustomerOrders();
                    $(this).renderTable(cart);

                },
                error: function(data) {
                    $(".loading").hide();
                    $("#dueModal").modal('toggle');
                    swal("Something went wrong!", 'Please refresh this page and try again');

                }
            });

            $("#refNumber").val('');
            $("#change").text('');
            $("#payment").val('');

        }


        $.get(api + 'on-hold', function(data) {
            holdOrderList = data;
            holdOrderlocation.empty();
            clearInterval(dotInterval);
            $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
        });


        $.fn.getHoldOrders = function() {
            $.get(api + 'on-hold', function(data) {
                holdOrderList = data;
                clearInterval(dotInterval);
                holdOrderlocation.empty();
                $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
            });
        };


        $.fn.randerHoldOrders = function(data, renderLocation, orderType) {
            $.each(data, function(index, order) {
                $(this).calculatePrice(order);
                renderLocation.append(
                    $('<div>', { class: orderType == 1 ? 'col-md-3 order' : 'col-md-3 customer-order' }).append(
                        $('<a>').append(
                            $('<div>', { class: 'card-box order-box' }).append(
                                $('<p>').append(
                                    $('<b>', { text: 'Ref :' }),
                                    $('<span>', { text: order.ref_number, class: 'ref_number' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Price :' }),
                                    $('<span>', { text: order.total, class: "label label-info", style: 'font-size:14px;' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Items :' }),
                                    $('<span>', { text: order.items.length }),
                                    $('<br>'),
                                    $('<b>', { text: 'Customer :' }),
                                    $('<span>', { text: order.customer != 0 ? order.customer.name : 'Walk in customer', class: 'customer_name' })
                                ),
                                $('<button>', { class: 'btn btn-danger del', onclick: '$(this).deleteOrder(' + index + ',' + orderType + ')' }).append(
                                    $('<i>', { class: 'fa fa-trash' })
                                ),

                                $('<button>', { class: 'btn btn-default', onclick: '$(this).orderDetails(' + index + ',' + orderType + ')' }).append(
                                    $('<span>', { class: 'fa fa-shopping-basket' })
                                )
                            )
                        )
                    )
                )
            })
        }


        $.fn.calculatePrice = function(data) {
            totalPrice = 0;
            $.each(data.products, function(index, product) {
                totalPrice += product.price * product.quantity;
            })

            let vat = (totalPrice * data.vat) / 100;
            totalPrice = ((totalPrice + vat) - data.discount).toFixed(0);

            return totalPrice;
        };


        $.fn.orderDetails = function(index, orderType) {

            $('#refNumber').val('');

            if (orderType == 1) {

                $('#refNumber').val(holdOrderList[index].ref_number);

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function() {
                    return $(this).text() == "Walk in customer";
                }).prop("selected", true);

                holdOrder = holdOrderList[index]._id;
                cart = [];
                $.each(holdOrderList[index].items, function(index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            } else if (orderType == 2) {

                $('#refNumber').val('');

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function() {
                    return $(this).text() == customerOrderList[index].customer.name;
                }).prop("selected", true);


                holdOrder = customerOrderList[index]._id;
                cart = [];
                $.each(customerOrderList[index].items, function(index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            }
            $(this).renderTable(cart);
            $("#holdOrdersModal").modal('hide');
            $("#customerModal").modal('hide');
        }


        $.fn.deleteOrder = function(index, type) {

            switch (type) {
                case 1:
                    deleteId = holdOrderList[index]._id;
                    break;
                case 2:
                    deleteId = customerOrderList[index]._id;
            }

            let data = {
                orderId: deleteId,
            }

            Swal.fire({
                title: "Delete order?",
                text: "This will delete the order. Are you sure you want to delete!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'delete',
                        type: 'POST',
                        data: JSON.stringify(data),
                        contentType: 'application/json; charset=utf-8',
                        cache: false,
                        success: function(data) {

                            $(this).getHoldOrders();
                            $(this).getCustomerOrders();

                            notiflix.Report.success(
                                'Deleted!',
                                'You have deleted the order!',
                                'Ok'
                            )

                        },
                        error: function(data) {
                            $(".loading").hide();

                        }
                    });
                }
            });
        }



        $.fn.getCustomerOrders = function() {
            $.get(api + 'customer-orders', function(data) {
                clearInterval(dotInterval);
                customerOrderList = data;
                customerOrderLocation.empty();
                $(this).randerHoldOrders(customerOrderList, customerOrderLocation, 2);
            });
        }



        $('#saveCustomer').on('submit', function(e) {

            e.preventDefault();

            let custData = {
                _id: Math.floor(Date.now() / 1000),
                name: $('#userName').val(),
                phone: $('#phoneNumber').val(),
                email: $('#emailAddress').val(),
                address: $('#userAddress').val()
            }

            $.ajax({
                url: api + 'customers/customer',
                type: 'POST',
                data: JSON.stringify(custData),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function(data) {
                    $("#newCustomer").modal('hide');
                    notiflix.Report.success("Customer added!", "Customer added successfully!", 'Ok');
                    $("#customer option:selected").removeAttr('selected');
                    $('#customer').append(
                        $('<option>', { text: custData.name, value: `{"id": ${custData._id}, "name": ${custData.name}}`, selected: 'selected' })
                    );

                    $('#customer').val(`{"id": ${custData._id}, "name": ${custData.name}}`).trigger('chosen:updated');

                },
                error: function(data) {
                    $("#newCustomer").modal('hide');
                    notiflix.Report.failure('Error', 'Something went wrong please try again', 'Ok')
                }
            })
        })


        $("#confirmPayment").hide();

        $("#cardInfo").hide();

        $("#payment").on('input', function() {
            $(this).calculateChange();
        });


        $("#confirmPayment").on('click', function() {
            if ($('#payment').val() == "") {
                notiflix.Report.warning(
                    'Nope!',
                    'Please enter the amount that was paid!',
                    'Ok'
                );
            } else {
                $(this).submitDueOrder(1);
            }
        });


        $('#transactions').click(function() {
            loadTransactions();
            loadUserList();

            $('#pos_view').hide();
            $('#pointofsale').show();
            $('#transactions_view').show();
            $(this).hide();

        });


        $('#pointofsale').click(function() {
            $('#pos_view').show();
            $('#transactions').show();
            $('#transactions_view').hide();
            $(this).hide();
        });


        $("#viewRefOrders").click(function() {
            setTimeout(function() {
                $("#holdOrderInput").focus();
            }, 500);
        });


        $("#viewCustomerOrders").click(function() {
            setTimeout(function() {
                $("#holdCustomerOrderInput").focus();
            }, 500);
        });


        $('#newProductModal').click(function() {
            $('#saveProduct').get(0).reset();
            $('#current_img').text('');
        });


        $('#saveProduct').submit(function(e) {
            e.preventDefault();

            $(this).attr('action', api + 'inventory/product');
            $(this).attr('method', 'POST');

            $(this).ajaxSubmit({
                contentType: 'application/json',
                success: function(response) {

                    $('#saveProduct').get(0).reset();
                    $('#current_img').text('');

                    loadProducts();
                    diagOptions={
                        title: 'Product Saved',
                        text: "Select an option below to continue.",
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Add another',
                        cancelButtonText: 'Close'
                    }
                     Swal.fire(diagOptions).then((result) => {

                        if (!result.value) {
                            $("#newProduct").modal('hide');
                        }
                    });
                
                },
                error: function(data) {
                    //console.log(data);
                }
            });

        });



        $('#saveCategory').submit(function(e) {
            e.preventDefault();

            if ($('#category_id').val() == "") {
                method = 'POST';
            } else {
                method = 'PUT';
            }

            $.ajax({
                type: method,
                url: api + 'categories/category',
                data: $(this).serialize(),
                success: function(data, textStatus, jqXHR) {
                    $('#saveCategory').get(0).reset();
                    loadCategories();
                    loadProducts();
                    diagOptions={
                        title: 'Category Saved',
                        text: "Select an option below to continue.",
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Add another',
                        cancelButtonText: 'Close'
                    }
                    Swal.fire(diagOptions).then((result) => {

                        if (!result.value) {
                            $("#newCategory").modal('hide');
                        }
                    });

                },
                error: function(data) {
                    //console.log(data);
                }

            });


        });


        $.fn.editProduct = function(index) {

            $('#Products').modal('hide');

            $("#category option").filter(function() {
                return $(this).val() == allProducts[index].category;
            }).prop("selected", true);

            $('#productName').val(allProducts[index].name);
            $('#product_price').val(allProducts[index].price);
            $('#quantity').val(allProducts[index].quantity);
            $('#barcode').val(allProducts[index].barcode || allProducts[index]._id);
            $('#expirationDate').val(allProducts[index].expirationDate);
            $('#minStock').val(allProducts[index].minStock || 1);
            $('#product_id').val(allProducts[index]._id);
            $('#img').val(allProducts[index].img);

            if (allProducts[index].img != "") {

                $('#imagename').hide();
                $('#current_img').html(`<img src="${img_path + allProducts[index].img}" alt="">`);
                $('#rmv_img').show();
            }

            if (allProducts[index].stock == 0) {
                $('#stock').prop("checked", true);
            }

            $('#newProduct').modal('show');
        }


        $("#userModal").on("hide.bs.modal", function() {
            $('.perms').hide();
        });


        $.fn.editUser = function(index) {

            user_index = index;

            $('#Users').modal('hide');

            $('.perms').show();

            $("#user_id").val(allUsers[index]._id);
            $('#fullname').val(allUsers[index].fullname);
            $('#username').val(allUsers[index].username);
            $('#password').attr('placeholder', 'New Password');
            // $('#password').val(secure.getDecrypted(allUsers[index].username));


            for (perm of permissions) {
                var el = "#" + perm;
                if (allUsers[index][perm] == 1) {
                    $(el).prop("checked", true);
                } else {
                    $(el).prop("checked", false);
                }
            }

            $('#userModal').modal('show');
        }


        $.fn.editCategory = function(index) {
            $('#Categories').modal('hide');
            $('#categoryName').val(allCategories[index].name);
            $('#category_id').val(allCategories[index]._id);
            $('#newCategory').modal('show');
        }


        $.fn.deleteProduct = function(id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this product.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'inventory/product/' + id,
                        type: 'DELETE',
                        success: function(result) {
                            loadProducts();
                            Swal.fire(
                                'Done!',
                                'Product deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $.fn.deleteUser = function(id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this user.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'users/user/' + id,
                        type: 'DELETE',
                        success: function(result) {
                            loadUserList();
                            Swal.fire(
                                'Done!',
                                'User deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $.fn.deleteCategory = function(id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this category.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'categories/category/' + id,
                        type: 'DELETE',
                        success: function(result) {
                            loadCategories();
                            Swal.fire(
                                'Done!',
                                'Category deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $('#productModal').click(function() {
            loadProductList();
        });


        $('#usersModal').click(function() {
            loadUserList();
        });


        $('#categoryModal').click(function() {
            loadCategoryList();
        });


        function loadUserList() {

            let counter = 0;
            let user_list = '';
            $('#user_list').empty();
            $('#userList').DataTable().destroy();

            $.get(api + 'users/all', function(users) {



                allUsers = [...users];

                users.forEach((user, index) => {

                    state = [];
                    let class_name = '';

                    if (user.status != "") {
                        state = user.status.split("_");
                        login_status = state[0];
                        login_time = state[1]

                        switch (login) {
                            case 'Logged In':
                                class_name = 'btn-default';

                                break;
                            case 'Logged Out':
                                class_name = 'btn-light';
                                break;
                        }
                    }

                    counter++;
                    user_list += `<tr>
            <td>${user.fullname}</td>
            <td>${user.username}</td>
            <td class="${class_name}">${state.length > 0 ? login_status : ''} <br><small> ${state.length > 0 ? login_time : ''}</small></td>
            <td>${user._id == 1 ? '<span class="btn-group"><button class="btn btn-dark"><i class="fa fa-edit"></i></button><button class="btn btn-dark"><i class="fa fa-trash"></i></button></span>' : '<span class="btn-group"><button onClick="$(this).editUser(' + index + ')" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' + user._id + ')" class="btn btn-danger"><i class="fa fa-trash"></i></button></span>'}</td></tr>`;

                    if (counter == users.length) {

                        $('#user_list').html(user_list);

                        $('#userList').DataTable({
                            "order": [
                                [1, "desc"]
                            ],
                            "autoWidth": false,
                            "info": true,
                            "JQueryUI": true,
                            "ordering": true,
                            "paging": false
                        });
                    }

                });

            });
        }


        function loadProductList() {
            let products = [...allProducts];
            let product_list = '';
            let counter = 0;
            $('#product_list').empty();
            $('#productList').DataTable().destroy();

            products.forEach((product, index) => {

                counter++;

                let category = allCategories.filter(function(category) {
                    return category._id == product.category;
                });

                product.stockAlert = '';
                let todayDate = moment();
                let expiryDate = moment(product.expirationDate, DATE_FORMAT);

                //calculate stock level
                if (product.quantity <= product.minStock) {
                    if (product.quantity == 0) {
                        product.stockStatus = 'No Stock';
                        icon = 'fa fa-exclamation-triangle'
                    } else {
                        product.stockStatus = 'Low Stock';
                        icon = 'fa fa-caret-down'
                    }

                    product.stockAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.stockStatus}</small></p>`;
                }
                //calculate days to expiry
                product.expiryAlert = '';
                if (todayDate.isBefore(expiryDate)) {
                    const diffDays = Math.abs(todayDate.startOf('day').diff(expiryDate, 'days'));

                    if (diffDays > 0 && diffDays <= 30) {
                        var days_noun = diffDays > 1 ? "days" : "day";
                        icon = 'fa fa-clock-o';
                        product.expiryStatus = `${diffDays} ${days_noun} left`;
                        product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
                    }
                } else {
                    icon = 'fa fa-bell';
                    product.expiryStatus = 'Expired';
                    product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
                }

                //render product list
                product_list += `<tr>
            <td><img id="` + product._id + `"></td>
            <td><img style="max-height: 50px; max-width: 50px; border: 1px solid #ddd;" src="${product.img == "" ? "./assets/images/default.jpg" : img_path + product.img}" id="product_img"></td>
            <td>${product.name}</td>
            <td>${settings.symbol}${product.price}</td>
            <td>${product.stock == 1 ? product.quantity : 'N/A'}
            ${product.stockAlert}
            </td>
            <td>${product.expirationDate}
            ${product.expiryAlert}</td>
            <td>${category.length > 0 ? category[0].name : ''}</td>
            <td class="nobr"><span class="btn-group"><button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td></tr>`;

                if (counter == allProducts.length) {

                    $('#product_list').html(product_list);

                    products.forEach(pro => {
                        let bcode = pro.barcode || pro._id;
                        $("#" + pro._id + "").JsBarcode(bcode, {
                            width: 2,
                            height: 25,
                            fontSize: 14
                        });
                    });

                    $('#productList').DataTable({
                        "order": [
                            [1, "desc"]
                        ],
                        "autoWidth": false,
                        "info": true,
                        "JQueryUI": true,
                        "ordering": true,
                        "paging": false
                    });
                }

            });
        }


        function loadCategoryList() {

            let category_list = '';
            let counter = 0;
            $('#category_list').empty();
            $('#categoryList').DataTable().destroy();

            allCategories.forEach((category, index) => {

                counter++;

                category_list += `<tr>
     
            <td>${category.name}</td>
            <td><span class="btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });

            if (counter == allCategories.length) {

                $('#category_list').html(category_list);
                $('#categoryList').DataTable({
                    "autoWidth": false,
                    "info": true,
                    "JQueryUI": true,
                    "ordering": true,
                    "paging": false

                });
            }
        }


        $.fn.serializeObject = function() {
            var o = {};
            var a = this.serializeArray();
            $.each(a, function() {
                if (o[this.name]) {
                    if (!o[this.name].push) {
                        o[this.name] = [o[this.name]];
                    }
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        };



        $('#log-out').click(function() {

            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to log out.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Logout'
            }).then((result) => {

                if (result.value) {
                    $.get(api + 'users/logout/' + user._id, function(data) {
                        storage.delete('auth');
                        storage.delete('user');
                        ipcRenderer.send('app-reload', '');
                    });
                }
            });
        });



        $('#settings_form').on('submit', function(e) {
            e.preventDefault();
            let formData = $(this).serializeObject();
            let mac_address;

            api = 'http://' + host + ':' + port + '/api/';

            macaddress.one(function(err, mac) {
                mac_address = mac;
            });

            formData['app'] = $('#app').find('option:selected').text();
            formData['mac'] = mac_address;
            formData['till'] = 1;

            $('#settings_form').append('<input type="hidden" name="app" value="' + formData.app + '" />');

            if (formData.percentage != "" && !$.isNumeric(formData.percentage)) {
                Swal.fire(
                    'Oops!',
                    'Please make sure the tax value is a number',
                    'warning'
                );
            } else {
                storage.set('settings', formData);

                $(this).attr('action', api + 'settings/post');
                $(this).attr('method', 'POST');


                $(this).ajaxSubmit({
                    contentType: 'application/json',
                    success: function(response) {

                        ipcRenderer.send('app-reload', '');

                    },
                    error: function(data) {
                        console.log(data);
                    }

                });

            }

        });



        $('#net_settings_form').on('submit', function(e) {
            e.preventDefault();
            let formData = $(this).serializeObject();

            if (formData.till == 0 || formData.till == 1) {
                Swal.fire(
                    'Oops!',
                    'Please enter a number greater than 1.',
                    'warning'
                );
            } else {
                if (isNumeric(formData.till)) {
                    formData['app'] = $('#app').find('option:selected').text();
                    storage.set('settings', formData);
                    ipcRenderer.send('app-reload', '');
                } else {
                    Swal.fire(
                        'Oops!',
                        'Till number must be a number!',
                        'warning'
                    );
                }

            }

        });



        $('#saveUser').on('submit', function(e) {
            e.preventDefault();
            let formData = $(this).serializeObject();

            console.log(formData);


            if (formData.password != formData.pass) {
                Swal.fire(
                    'Oops!',
                    'Passwords do not match!',
                    'warning'
                );
            }


            if (bcrypt.compare(formData.password, user.password) || bcrypt.compare(formData.password, allUsers[user_index].password)) {
                $.ajax({
                    url: api + 'users/post',
                    type: 'POST',
                    data: JSON.stringify(formData),
                    contentType: 'application/json; charset=utf-8',
                    cache: false,
                    processData: false,
                    success: function(data) {
                        if (ownUserEdit) {
                            ipcRenderer.send('app-reload', '');
                        } else {
                            $('#userModal').modal('hide');

                            loadUserList();

                            $('#Users').modal('show');
                            Swal.fire(
                                'Ok!',
                                'User details saved!',
                                'success'
                            );
                        }


                    },
                    error: function(data) {
                        console.log(data);
                    }

                });

            }

        });



        $('#app').change(function() {
            if ($(this).find('option:selected').text() == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);
                macaddress.one(function(err, mac) {
                    $("#mac").val(mac);
                });
            } else {
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);
            }

        });



        $('#cashier').click(function() {

            ownUserEdit = true;

            $('#userModal').modal('show');

            $("#user_id").val(user._id);
            $("#fullname").val(user.fullname);
            $("#username").val(user.username);
            $("#password").attr('placeholder', 'New Password');

            for (perm of permissions) {
                var el = "#" + perm;
                if (allUsers[index][perm] == 1) {
                    $(el).prop("checked", true);
                } else {
                    $(el).prop("checked", false);
                }
            }

        });



        $('#add-user').click(function() {

            if (platform.app != 'Network Point of Sale Terminal') {
                $('.perms').show();
            }

            $("#saveUser").get(0).reset();
            $('#userModal').modal('show');

        });



        $('#settings').click(function() {

            if (platform.app == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);

                $("#ip").val(platform.ip);
                $("#till").val(platform.till);

                macaddress.one(function(err, mac) {
                    $("#mac").val(mac);
                });

                $("#app option").filter(function() {
                    return $(this).text() == platform.app;
                }).prop("selected", true);
            } else {
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);

                $("#settings_id").val("1");
                $("#store").val(settings.store);
                $("#address_one").val(settings.address_one);
                $("#address_two").val(settings.address_two);
                $("#contact").val(settings.contact);
                $("#tax").val(settings.tax);
                $("#symbol").val(settings.symbol);
                $("#percentage").val(settings.percentage);
                $("#footer").val(settings.footer);
                $("#logo_img").val(settings.img);
                if (settings.charge_tax == 'on') {
                    $('#charge_tax').prop("checked", true);
                }
                if (settings.img != "") {
                    $('#logoname').hide();
                    $('#current_logo').html(`<img src="${img_path + settings.img}" alt="">`);
                    $('#rmv_logo').show();
                }

                $("#app option").filter(function() {
                    return $(this).text() == settings.app;
                }).prop("selected", true);
            }




        });


    });


    $('#rmv_logo').click(function() {
        $('#remove_logo').val("1");
        $('#current_logo').hide(500);
        $(this).hide(500);
        $('#logoname').show(500);
    });


    $('#rmv_img').click(function() {
        $('#remove_img').val("1");
        $('#current_img').hide(500);
        $(this).hide(500);
        $('#imagename').show(500);
    });


    $('#print_list').click(function() {

        //show progress bar
        //$("#loading").show();

        $('#productList').DataTable().destroy();

        const filename = 'productList.pdf';

        html2canvas($('#all_products').get(0)).then(canvas => {
            let height = canvas.height * (25.4 / 96);
            let width = canvas.width * (25.4 / 96);
            let pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);

            //show progress bar
            // $("#loading").hide();
            pdf.save(filename);
        });



        $('#productList').DataTable({
            "order": [
                [1, "desc"]
            ],
            "autoWidth": false,
            "info": true,
            "JQueryUI": true,
            "ordering": true,
            "paging": false
        });

        $(".loading").hide();

    });

}


$.fn.print = function() {

    printJS({ printable: receipt, type: 'raw-html' });

}


function loadTransactions() {

    let tills = [];
    let users = [];
    let sales = 0;
    let transact = 0;
    let unique = 0;

    sold_items = [];
    sold = [];

    let counter = 0;
    let transaction_list = '';
    let query = `by-date?start=${start_date}&end=${end_date}&user=${by_user}&status=${by_status}&till=${by_till}`;


    $.get(api + query, function(transactions) {

        if (transactions.length > 0) {


            $('#transaction_list').empty();
            $('#transactionList').DataTable().destroy();

            allTransactions = [...transactions];

            transactions.forEach((trans, index) => {

                sales += parseFloat(trans.total);
                transact++;



                trans.items.forEach(item => {
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
                                <td class="nobr">${moment(trans.date).format('DD-MM-YYYY')}</td>
                                <td>${settings.symbol + moneyFormat(trans.total)}</td>
                                <td>${trans.paid == "" ? "" : settings.symbol + moneyFormat(trans.paid)}</td>
                                <td>${trans.change ? settings.symbol + moneyFormat(Math.abs(trans.change).toFixed(2)) : ''}</td>
                                <td>${trans.paid == "" ? "" : trans.payment_type == 0 ? "Cash" : 'Card'}</td>
                                <td>${trans.till}</td>
                                <td>${trans.user}</td>
                                <td>${trans.paid == "" ? '<button class="btn btn-dark"><i class="fa fa-search-plus"></i></button>' : '<button onClick="$(this).viewTransaction(' + index + ')" class="btn btn-info"><i class="fa fa-search-plus"></i></button></td>'}</tr>
                    `;

                if (counter == transactions.length) {

                    $('#total_sales #counter').text(settings.symbol + moneyFormat(parseFloat(sales).toFixed(2)));
                    $('#total_transactions #counter').text(transact);

                    const result = {};

                    for (const { product_name, price, quantity, id } of sold_items) {
                        if (!result[product_name]) result[product_name] = [];
                        result[product_name].push({ id, price, quantity });
                    }

                    for (item in result) {

                        let price = 0;
                        let quantity = 0;
                        let id = 0;

                        result[item].forEach(i => {
                            id = i.id;
                            price = i.price;
                            quantity = quantity + parseInt(i.quantity);
                        });

                        sold.push({
                            id: id,
                            product: item,
                            qty: quantity,
                            price: price
                        });
                    }

                    loadSoldProducts();


                    if (by_user == 0 && by_till == 0) {

                        userFilter(users);
                        tillFilter(tills);
                    }


                    $('#transaction_list').html(transaction_list);
                    $('#transactionList').DataTable({
                        "order": [
                            [1, "desc"]
                        ],
                        "autoWidth": false,
                        "info": true,
                        "JQueryUI": true,
                        "ordering": true,
                        "paging": true,
                        "dom": 'Bfrtip',
                        "buttons": ['csv', 'excel', 'pdf', ]

                    });
                }
            });
        } else {
            Swal.fire(
                'No data!',
                'No transactions available within the selected criteria',
                'warning'
            );
        }

    });
}


function discend(a, b) {
    if (a.qty > b.qty) {
        return -1;
    }
    if (a.qty < b.qty) {
        return 1;
    }
    return 0;
}


function loadSoldProducts() {

    sold.sort(discend);

    let counter = 0;
    let sold_list = '';
    let items = 0;
    let products = 0;
    $('#product_sales').empty();

    sold.forEach((item, index) => {

        items = items + parseInt(item.qty);
        products++;

        let product = allProducts.filter(function(selected) {
            return selected._id == item.id;
        });

        counter++;

        sold_list += `<tr>
            <td>${item.product}</td>
            <td>${item.qty}</td>
            <td>${product[0].stock == 1 ? product.length > 0 ? product[0].quantity : '' : 'N/A'}</td>
            <td>${settings.symbol + moneyFormat((item.qty * parseFloat(item.price)).toFixed(2))}</td>
            </tr>`;

        if (counter == sold.length) {
            $('#total_items #counter').text(items);
            $('#total_products #counter').text(products);
            $('#product_sales').html(sold_list);
        }
    });
}


function userFilter(users) {

    $('#users').empty();
    $('#users').append(`<option value="0">All</option>`);

    users.forEach(user => {
        let u = allUsers.filter(function(usr) {
            return usr._id == user;
        });

        $('#users').append(`<option value="${user}">${u[0].fullname}</option>`);
    });

}


function tillFilter(tills) {

    $('#tills').empty();
    $('#tills').append(`<option value="0">All</option>`);
    tills.forEach(till => {
        $('#tills').append(`<option value="${till}">${till}</option>`);
    });

}


$.fn.viewTransaction = function(index) {

    transaction_index = index;

    let discount = allTransactions[index].discount;
    let customer = allTransactions[index].customer == 0 ? 'Walk in Customer' : allTransactions[index].customer.username;
    let refNumber = allTransactions[index].ref_number != "" ? allTransactions[index].ref_number : allTransactions[index].order;
    let orderNumber = allTransactions[index].order;
    let type = "";
    let tax_row = "";
    let items = "";
    let products = allTransactions[index].items;

    products.forEach(item => {
        items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + parseFloat(item.price).toFixed(2) + "</td></tr>";

    });


    switch (allTransactions[index].payment_type) {

        case 2:
            type = "Card";
            break;

        default:
            type = "Cash";

    }


    if (allTransactions[index].paid != "") {
        payment = `<tr>
                    <td>Paid</td>
                    <td>:</td>
                    <td>${settings.symbol + allTransactions[index].paid}</td>
                </tr>
                <tr>
                    <td>Change</td>
                    <td>:</td>
                    <td>${settings.symbol + moneyFormat(Math.abs(allTransactions[index].change).toFixed(2))}</td>
                </tr>
                <tr>
                    <td>Method</td>
                    <td>:</td>
                    <td>${type}</td>
                </tr>`
    }



    if (settings.charge_tax) {
        tax_row = `<tr>
                <td>Vat(${settings.percentage})% </td>
                <td>:</td>
                <td>${settings.symbol}${parseFloat(allTransactions[index].tax).toFixed(2)}</td>
            </tr>`;
    }



    receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${settings.img == "" ? settings.img : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
    </p>
    <hr>
    <left>
        <p>
        Invoice : ${orderNumber} <br>
        Ref No : ${refNumber} <br>
        Customer : ${allTransactions[index].customer == 0 ? 'Walk in Customer' : allTransactions[index].customer.name} <br>
        Cashier : ${allTransactions[index].user} <br>
        Date : ${moment(allTransactions[index].date).format('DD MMM YYYY HH:mm:ss')}<br>
        </p>

    </left>
    <hr>
    <table width="100%">
        <thead style="text-align: left;">
        <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
        </tr>
        </thead>
        <tbody>
        ${items}                
 
        <tr>                        
            <td><b>Subtotal</b></td>
            <td>:</td>
            <td><b>${settings.symbol}${moneyFormat(allTransactions[index].subtotal)}</b></td>
        </tr>
        <tr>
            <td>Discount</td>
            <td>:</td>
            <td>${discount > 0 ? settings.symbol + moneyFormat(parseFloat(allTransactions[index].discount).toFixed(2)) : ''}</td>
        </tr>
        
        ${tax_row}
    
        <tr>
            <td><h3>Total</h3></td>
            <td><h3>:</h3></td>
            <td>
                <h3>${settings.symbol}${moneyFormat(allTransactions[index].total)}</h3>
            </td>
        </tr>
        ${payment == 0 ? '' : payment}
        </tbody>
        </table>
        <br>
        <hr>
        <br>
        <p style="text-align: center;">
         ${settings.footer}
         </p>
        </div>`;

    $('#viewTransaction').html('');
    $('#viewTransaction').html(receipt);

    $('#orderModal').modal('show');

}


$('#status').change(function() {
    by_status = $(this).find('option:selected').val();
    loadTransactions();
});



$('#tills').change(function() {
    by_till = $(this).find('option:selected').val();
    loadTransactions();
});


$('#users').change(function() {
    by_user = $(this).find('option:selected').val();
    loadTransactions();
});


$('#reportrange').on('apply.daterangepicker', function(ev, picker) {

    start = picker.startDate.format('DD MMM YYYY hh:mm A');
    end = picker.endDate.format('DD MMM YYYY hh:mm A');

    start_date = picker.startDate.toDate().toJSON();
    end_date = picker.endDate.toDate().toJSON();


    loadTransactions();
});


function authenticate() {
    $('.loading').hide();
    $('body').attr('class', 'login-page');
    $('#login').show();

}


$('body').on("submit", "#account", function(e) {
    e.preventDefault();
    let formData = $(this).serializeObject();

    if (formData.username == "" || formData.password == "") {

        Swal.fire(
            'Incomplete form!',
            auth_empty,
            'warning'
        );
    } else {

        $.ajax({
            url: api + 'users/login',
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json; charset=utf-8',
            cache: false,
            processData: false,
            success: function(data) {
                if (data.auth === true) {
                    storage.set('auth', { auth: true });
                    storage.set('user', data);
                    ipcRenderer.send('app-reload', '');
                    $('#login').hide();
                } else {
                    //console.log(data)
                    Swal.fire(
                        'Oops!',
                        auth_error,
                        'warning'
                    );

                }

            },
            error: function(data) {
                console.log(data);
            }
        });
    }
});


$('#quit').click(function() {
    Swal.fire({
        title: 'Are you sure?',
        text: "You are about to close the application.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Close Application'
    }).then((result) => {

        if (result.value) {
            ipcRenderer.send('app-quit', '');
        }
    });
});