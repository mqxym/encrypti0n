// Currently not used by the main app

export class ShowNotification {
  static success(title, content) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: 'success',
      loaderBg: '#3b98b5',
      position: 'top-right',
    });
  }
  static warning(title, content) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: 'warning',
      loaderBg: '#3b98b5',
      position: 'top-right',
    });
  }
  static error(title, content, hide = 6000) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: 'error',
      loaderBg: '#3b98b5',
      position: 'top-right',
      hideAfter: hide,
    });
  }
}
