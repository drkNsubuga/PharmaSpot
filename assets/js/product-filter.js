const moneyFormat = (amount,locale='en-US')=>Intl.NumberFormat(locale).format(amount)

$(document).ready(function(){

    $('#categories').on('change', function(){

        let selected = $('#categories option:selected').val();
        if (selected == '0') {
            $('#parent > div').fadeIn(450);
        } else {
            var $el = $('.' + selected).fadeIn(450);
            $('#parent > div').not($el).hide();
        }

    });

 
    function searchProducts () {        
        //$("#categories .btn-categories").removeClass("active");
        var matcher = new RegExp($("#search").val(), 'gi');
        $('.box').show().not(function(){
            return matcher.test($(this).find('.name, .sku').text())
        }).hide();
    }

    let $search = $("#search").on('input',function(){
        searchProducts();       
    });


    $('body').on('click', '#jq-keyboard button', function(e) {
        if($("#search").is(":focus")) {
            searchProducts(); 
        }          
    });


    function searchOpenOrders() {
        var matcher = new RegExp($("#holdOrderInput").val(), 'gi');
        $('.order').show().not(function(){
            return matcher.test($(this).find('.ref_number').text())
        }).hide();

    }

    var $searchHoldOrder = $("#holdOrderInput").on('input',function () {
        searchOpenOrders();
    });


    $('body').on('click', '.holdOrderKeyboard .key', function() {
        if($("#holdOrderInput").is(":focus")) {
            searchOpenOrders(); 
        }          
    });
 
  
    function searchCustomerOrders() {
        var matcher = new RegExp($("#holdCustomerOrderInput").val(), 'gi');
        $('.customer-order').show().not(function(){
            return matcher.test($(this).find('.customer_name').text())
        }).hide();
    }

    var $searchCustomerOrder = $("#holdCustomerOrderInput").on('input',function () {
        searchCustomerOrders();
    });


    $('body').on('click', '.customerOrderKeyboard .key', function() {
        if($("#holdCustomerOrderInput").is(":focus")) {
            searchCustomerOrders();
        }          
    });
 


    var $list = $('.list-group-item').click(function () {
       $list.removeClass('active');
       $(this).addClass('active');
       if(this.id == 'check'){
            $("#cardInfo").show();
            $("#cardInfo .input-group-addon").text("Check Info");
       }else if(this.id == 'card'){
           $("#cardInfo").show();
           $("#cardInfo .input-group-addon").text("Card Info");
       }else if(this.id == 'cash'){
           $("#cardInfo").hide();
       }
    });


    $.fn.go = function (value,isDueInput) {
        let paymentAmount=$("#payment").val();
        if(isDueInput){
            $("#refNumber").val($("#refNumber").val()+""+value)
        }else{
            $("#paymentText").val(moneyFormat(paymentAmount));
            $("#payment").val(paymentAmount+""+value);
            $(this).calculateChange();
        }
    }


    $.fn.digits = function(){
        let paymentAmount=$("#payment").val();
        $("#paymentText").val(moneyFormat(paymentAmount));
        $("#payment").val(paymentAmount+".");
        $(this).calculateChange();
    }

    $.fn.calculateChange = function () {
        //add commas to #payment
        $('#payment').val
        var payablePrice = $("#payablePrice").val().replace(',','');
        var payment = $("#payment").val().replace(',','');
        var change = payablePrice - payment;
        if(change <= 0){
            $("#change").text(moneyFormat(change.toFixed(2)));
        }else{
            $("#change").text('0')
        }
        if(change <= 0){
            $("#confirmPayment").show();
        }else{
            $("#confirmPayment").hide();
        }
    }

})