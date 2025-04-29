import { PasswordGenerator, PasswordGeneratorController } from '../app/passwordGenerator.js';
const generator = new PasswordGenerator();
new PasswordGeneratorController(generator);