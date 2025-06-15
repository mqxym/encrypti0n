# encrypti0n.com

is a simple web application to encrypt and decrypt text and files locally within the browser using standard cryptographic algorithms provided by every modern browser.

> The app uses customizable key derivation algorithm Argon2id (salted) for the 256-bit AES-GCM encryption.

![Encryption V3](https://mqxym.de/assets/encrypti0n-v3.png)
  
## App Features

The main feature is encryption and decryption of text and files with standard cryptographic algorithms.

- Intuitive UI with password generator and a simple local password manager secured with envelope encryption
- The password managers' data can be locally encrypted with the same standard algorithms (Argon2id + AES-GCM-256)
- Automatic data clearing and user logout upon activation of app encryption after 5 minutes of inactivity
- Delete all local data with a click to overwrite with default values
- Clear clipboard button
- Password strenght checking

Try it out here: [encryption.com](https://encrypti0n.com)

## Supports Local and Offline Execution

Everything needed is included, with no external dependencies (except some fonts). Download the latest release on GitHub: [encrypti0n/releases](https://github.com/mqxym/encrypti0n/releases).
