import { MainController } from './controllers/MainController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Instantiate the main controller with the ID of your main form:
  const mainController = new MainController('mainForm');

  // If you have a version manager or other initialization steps, call them here.
  console.log("App loaded, main controller ready.");
});