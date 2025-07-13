import { PasswordGenerator } from './passwordGenerator.js';
import { PasswordGeneratorController } from './passwordGeneratorController.js';

document.addEventListener('DOMContentLoaded', () => {
  const generator = new PasswordGenerator();
  new PasswordGeneratorController(generator);
});
