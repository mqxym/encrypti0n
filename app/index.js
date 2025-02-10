import { MainController } from './controllers/MainController.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!window.crypto || !window.crypto.subtle) {
      Swal.fire({
        icon: 'error',
        title: 'Your browser does not support this application.',
        text: "Please update your browser or system.",
        showCancelButton: false,
        confirmButtonText: "Ok"
      });
    }
  const mainController = new MainController('mainForm');
  mainController.init();
});