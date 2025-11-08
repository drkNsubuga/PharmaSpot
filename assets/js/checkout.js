const utils = require("./utils");

/** CheckOut Functions **/
$(document).ready(function () {
  /**
   * handle keypad button pressed.
   * @param {string} value - The keypad value to be processed.
   * @param {boolean} isDueInput - Indicates whether the input is for due payment.
   */
  $.fn.keypadBtnPressed = function (value, isDueInput) {
    let paymentAmount = $("#payment").val();
    if (isDueInput) {
      $("#refNumber").val($("#refNumber").val() + "" + value);
    } else {
      paymentAmount = paymentAmount + "" + value;
      $("#paymentText").val(utils.moneyFormat(paymentAmount));
      $("#payment").val(paymentAmount);
      $(this).calculateChange();
    }
  };

  /**
   * Format payment amount with commas when a point is pressed
   */
  $.fn.digits = function () {
    let paymentAmount = $("#payment").val();
    $("#paymentText").val(utils.moneyFormat(paymentAmount));
    $("#payment").val(paymentAmount + ".");
    $(this).calculateChange();
  };

  /**
   * Calculate and display the balance due.
   */
  $.fn.calculateChange = function () {
    var payablePrice = $("#payablePrice").val().replace(",", "");
    var payment = $("#payment").val().replace(",", "");
    var change = payablePrice - payment;
    if (change <= 0) {
      $("#change").text(utils.moneyFormat(Math.abs(change.toFixed(2))));
      $("#confirmPayment").show();
    } else {
      $("#change").text("0");
      $("#confirmPayment").hide();
    }
  };

  var $keypadBtn = $(".keypad-btn").on("click", function () {
    const key = $(this).data("val");
    const isdue = $(this).data("isdue");
    switch(key)
    {
    case "del" : { 
      if(isdue)
      {
        $('#refNumber').val((i, val) => val.slice(0, -1));
      }
      else
      {
        $("#payment").val((i, val) => val.slice(0, -1));
      //re-format displayed amount after deletion 
      $("#paymentText").val((i, val) => utils.moneyFormat($("#payment").val()));
      }
      $(this).calculateChange()
    }; break;

    case "ac":{
      if(isdue)
      {
          $('#refNumber').val('');
      }
      else
      {
        $('#payment,#paymentText').val('');
        $(this).calculateChange();
      }
       
    };break;

  case "point": {
    $(this).digits()
    };break;

   default: $(this).keypadBtnPressed(key, isdue); break;
  }
});

  /** Switch Views for Payment Options **/
  var $list = $(".list-group-item").on("click", function () {
    $list.removeClass("active");
    $(this).addClass("active");
    if (this.id == "check") {
      $("#cardInfo").show();
      $("#cardInfo .input-group-addon").text("Check Info");
    } else if (this.id == "card") {
      $("#cardInfo").show();
      $("#cardInfo .input-group-addon").text("Card Info");
    } else if (this.id == "cash") {
      $("#cardInfo").hide();
    }
  });

  // Handle keyboard input for payment field
  $("#paymentText").on("input", function() {
    let value = $(this).val().replace(/[^0-9.]/g, ''); // Only allow numbers and decimal
    
    // Prevent multiple decimal points
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    $("#payment").val(value);
    $(this).val(value);
    $(this).calculateChange();
  });

  // Allow keyboard input on payment field
  $("#paymentText").on("keypress", function(e) {
    // Allow only numbers, decimal point, backspace, delete
    const charCode = e.which || e.keyCode;
    
    // Enter key triggers payment confirmation
    if (charCode === 13) { // Enter key
      e.preventDefault();
      if ($("#confirmPayment").is(":visible")) {
        $("#confirmPayment").click();
      }
      return false;
    }
    
    if (charCode === 46) { // decimal point
      // Only allow one decimal point
      if ($(this).val().indexOf('.') !== -1) {
        e.preventDefault();
        return false;
      }
    } else if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      e.preventDefault();
      return false;
    }
  });
});