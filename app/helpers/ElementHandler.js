/**
 * Manages Element Handling
 */
export class ElementHandler {
  static hide (element) {
    $("#"+element).addClass("d-none");
  } 
  static show (element) {
    $("#"+element).removeClass("d-none");
  } 
  static blueToPinkBorder (element) {
    $("#"+element).removeClass("border-blue").addClass("border-pink");
  } 
  static pinkToBlueBorder (element) {
    $("#"+element).removeClass("border-pink").addClass("border-blue");
  } 
  static fillPillBlue (element) {
    $("#"+element).removeClass("badge-outline-blue").addClass("bg-blue");
  }
  static emptyPillBlue (element) {
    $("#"+element).removeClass("bg-blue").addClass("badge-outline-blue");
  }
  static fillPillPink (element) {
    $("#"+element).removeClass("badge-outline-pink").addClass("bg-pink");
  }
  static emptyPillPink (element) {
    $("#"+element).removeClass("bg-pink").addClass("badge-outline-pink");
  }
  static buttonClassBlueToPinkOutline (inputClass) {
    $("."+inputClass).removeClass("btn-outline-blue").addClass("btn-outline-pink");
  }
  static buttonClassPinkToBlueOutline (inputClass) {
    $("."+inputClass).removeClass("btn-outline-pink").addClass("btn-outline-blue");
  }
  static buttonClassBlueToPink (inputClass) {
    $("."+inputClass).removeClass("btn-blue").addClass("btn-pink");
  }
  static buttonClassPinkToBlue (inputClass) {
    $("."+inputClass).removeClass("btn-pink").addClass("btn-blue");
  }
  static fillButtonClassBlue (inputClass) {
    $("."+inputClass).removeClass("btn-outline-blue").addClass("btn-blue");
  }
  static fillButtonClassPink (inputClass) {
    $("."+inputClass).removeClass("btn-outline-pink").addClass("btn-pink");
  }
  static emptyButtonClassBlue (inputClass) {
    $("."+inputClass).addClass("btn-outline-blue").removeClass("btn-blue");
  }
  static emptyButtonClassPink (inputClass) {
    $("."+inputClass).addClass("btn-outline-pink").removeClass("btn-pink");
  }
  static arrowsToCheck () {
    $(".mdi-arrow-right-thick").removeClass("mdi-arrow-right-thick").addClass("removed-right").addClass("mdi-check-all");
    $(".mdi-arrow-down-bold").removeClass("mdi-arrow-down-bold").addClass("removed-down").addClass("mdi-check-all");
  }
  static checkToArrows () {
    $(".removed-right").removeClass("removed-right").addClass("mdi-arrow-right-thick").removeClass("mdi-check-all");
    $(".removed-down").removeClass("removed-down").addClass("mdi-arrow-down-bold").removeClass("mdi-check-all");
  }
  static arrowsToCross () {
    $(".mdi-arrow-right-thick").removeClass("mdi-arrow-right-thick").addClass("removed-right").addClass("mdi-close-circle-multiple");
    $(".mdi-arrow-down-bold").removeClass("mdi-arrow-down-bold").addClass("removed-down").addClass("mdi-close-circle-multiple");
  }
  static crossToArrows () {
    $(".removed-right").removeClass("removed-right").addClass("mdi-arrow-right-thick").removeClass("mdi-close-circle-multiple");
    $(".removed-down").removeClass("removed-down").addClass("mdi-arrow-down-bold").removeClass("mdi-close-circle-multiple");
  }
  static buttonRemoveTextAddSuccess (preId) {
    $(`#${preId}Text`).addClass("d-none");
    $(`#${preId}Success`).removeClass("d-none");
  }
  static buttonRemoveTextAddFail (preId) {
    $("#"+preId+"Text").addClass("d-none");
    $("#"+preId+"Fail").removeClass("d-none");
  }
  static buttonRemoveStatusAddText (preId) {
    $("#"+preId+"Success").addClass("d-none");
    $("#"+preId+"Fail").addClass("d-none");
    $("#"+preId+"Text").removeClass("d-none");
  }

  static fillButtonGray (id) {
    $("#"+id).addClass("btn-secondary").removeClass("btn-outline-secondary");
  }
  static emptyButtonGray (id) {
    $("#"+id).addClass("btn-outline-secondary").removeClass("btn-secondary");
  }

  static populateSelectWithSlotNames(slotNames, selectId) {
    const $select = $('#' + selectId);
    $select.empty(); // Clear existing options
    for (const key in slotNames) {
        if (slotNames.hasOwnProperty(key)) {
            $select.append(`<option value="${key}">${slotNames[key]}</option>`);
        }
    }
  }


  static disable (element) {
    $("#"+element).prop('disabled', true);
  } 
  static enable (element) {
    $("#"+element).prop('disabled', false);
  }

  static setPlaceholderById(id, placeholderText) {
    $(`#${id}`).attr('placeholder', placeholderText);
  }
   
  static check (element) {
    $("#"+element).prop('checked', true);
  } 
  static uncheck (element) {
    $("#"+element).prop('checked', false);
  }
  static copyText (element) {
    var input = $("#"+element)[0];
    input.select();
      
    // Copy the text inside the text field
	  document.execCommand("copy");
      
    // Deselect the text field
    input.setSelectionRange(0, 0);
  }
}