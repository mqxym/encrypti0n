# encrypti0n.com
is a web application to encrypt and decrypt text and files locally within the browser.
Try it out here: https://encrypti0n.com
  
## Features

- Use one or multiple chained encryption methods (AES256 / Blowfish / XOR)
- Generate long keys and save them in the browser in one of the ten slots (This data is encrypted with a fixed key)
- Rename key slots
- Export and import saved keys, slot names, configs
- Encrypt the locally saved data and exports with a master password
- Hashing options:
  - No Hashing (Encrypts directly with the entered key)
  - Key dependend extra hash rounds
  - Hash salting
  - Hash difficulty low to high (50-2000 hash rounds)
- Cache already calculated hashes in the browser for faster encryption and decryption
  - This data is encrypted with a fixed key or custom master password
- Clear all or selected saved data

## Includes

- CryptoJS library for encryption and hashing and methods
- jQuery for reading forms and manipulating the DOM
- main.js
  - `Main` class for all application logic
  - `FormHandler` class for reading and changing form data
  - `VersionManager` class for handling version updates and executing required actions after version update
  - `URLQueryStringHandler` class for manipulating the URL query string
  - `StorageHandler` class for reading and writing to localStorage
