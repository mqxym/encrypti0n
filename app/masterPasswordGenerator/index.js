import { generatePassword, calculateEntropy } from "./wordGenerator.js";
import { PasswordGeneratorController } from './passwordGeneratorController.js';

document.addEventListener('DOMContentLoaded', () => {
  new PasswordGeneratorController(generatePassword, calculateEntropy);
});
