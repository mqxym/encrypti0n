# Go-Forward Plan: New Features and Improvements for Encrypti0n.com

## 1. Introduction

This document outlines a strategic plan for the continued development of Encrypti0n.com. It includes enhancements to existing features and proposals for new functionalities aimed at improving user experience, security, and the overall utility of the application. Each item is categorized by its potential impact on users and the estimated implementation effort.

## 2. Guiding Principles for Development

*   **Maintain Core Values:** Prioritize user privacy, client-side security, and transparency.
*   **User-Centricity:** Focus on features that genuinely benefit users and improve their experience.
*   **Iterative Improvements:** Implement changes in manageable phases.
*   **Security First:** Ensure all new features and changes undergo thorough security scrutiny.

## 3. Proposed Features and Improvements

### 3.1. Enhance Existing Features (User Experience & Security)

| Feature                                  | Description                                                                                                                                                              | User Impact | Easiness (Effort) | Est. Time |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- | :---------------- | :-------- |
| **Password Manager Export/Import**       | Allow users to securely export their saved password list (encrypted with master password or a temporary strong password) and re-import it.                               | **High**    | Medium            | 2-3 weeks |
| **Configurable Password Manager Slots**  | Allow users to add more than the current 10 password slots, or make the number of slots dynamically adjustable.                                                          | Medium      | Easy              | 1 week    |
| **Enhanced UI/UX for Beginners**         | Implement an optional interactive guided tour for new users. Consider a "Simple Mode" UI that hides advanced cryptographic settings for basic encryption/decryption tasks. | Medium      | Medium            | 2-3 weeks |
| **Improved File Handling UI**            | Add drag-and-drop support for file selection. Provide clearer progress indicators for large file encryption/decryption.                                                    | Medium      | Easy-Medium       | 1-2 weeks |
| **Granular Argon2 Settings Explanation** | In the Argon2 options, provide more detailed yet understandable tooltips or links to glossary/FAQ explaining the impact of changing rounds/salt length for non-expert users. | Low-Medium  | Easy              | <1 week   |
| **Password Strength Indicator**          | Add a visual strength indicator when users are typing passwords (for encryption or master password setup).                                                              | Medium      | Easy-Medium       | 1 week    |

### 3.2. Completely New Features

| Feature                                       | Description                                                                                                                                                                                             | User Impact | Easiness (Effort) | Est. Time |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------- | :---------------- | :-------- |
| **Secure Notes/Text Snippets Storage**        | Allow users to create, encrypt, store, and manage arbitrary text notes or snippets (beyond just passwords in the password manager). Each note encrypted with its own password or a master note password. | **High**    | Medium            | 3-4 weeks |
| **WebAssembly (WASM) for Performance-Critical Crypto** | Explore and potentially implement Argon2 (or other future crypto needs) using WASM to improve performance and potentially enable options like increased parallelism.                               | **High**    | Hard              | 4-6 weeks |
| **Content Marketing & SEO Enhancements**      | Create a blog with articles on privacy/security. Implement schema markup, meta description optimization, and other SEO best practices identified in the SEO analysis.                                  | Medium      | Medium (Ongoing)  | Ongoing   |
| **Expanded "Crypto Playground"**              | Enhance the existing "Crypto Playground" with more interactive examples: visual hashing, symmetric vs. asymmetric key demos, digital signature examples (if feasible with Web Crypto API).              | Medium      | Medium            | 2-4 weeks |
| **Steganography Feature (Experimental)**      | Allow users to hide encrypted text messages within image files (basic implementation acknowledging JS limitations for complex steganography). Clearly label as experimental.                            | Low-Medium  | Hard              | 4-6 weeks |
| **Themed QR Code for Encrypted Text**         | Option to generate a QR code for shorter encrypted text snippets. Could be themed or styled. Facilitates easy mobile transfer if the other device has a compatible decryption mechanism.                | Low         | Medium            | 1-2 weeks |

### 3.3. Technical Debt and Maintenance

| Task                                     | Description                                                                                                                                                  | User Impact (Indirect) | Easiness (Effort) | Est. Time |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :---------------- | :-------- |
| **jQuery Reduction/Modernization Plan**  | For new features, prioritize vanilla JS or a more modern lightweight library. Develop a long-term plan for gradually refactoring away from jQuery where sensible. | Medium                 | Hard (Ongoing)    | Ongoing   |
| **Comprehensive Automated Testing Suite**| Implement unit, integration, and potentially end-to-end tests for core cryptographic functions and UI interactions.                                            | High                   | Medium-Hard       | 3-5 weeks |
| **Accessibility (a11y) Audit & Fixes**   | Conduct a formal accessibility audit against WCAG guidelines and implement necessary fixes.                                                                    | Medium                 | Medium            | 2-3 weeks |
| **Strengthen CSP and SRI policies**      | Review and enhance Content Security Policy and Subresource Integrity tags for all external resources.                                                        | High                   | Medium            | 1-2 weeks |

## 4. Prioritization (Suggested Focus for Next 1-3 Months)

1.  **Password Manager Export/Import:** High user impact, addresses a key data loss risk.
2.  **Comprehensive Automated Testing Suite:** Crucial for stable future development.
3.  **Strengthen CSP and SRI policies:** Important for security.
4.  **Secure Notes/Text Snippets Storage:** High utility new feature.
5.  **Enhanced UI/UX for Beginners (Guided Tour):** Improves onboarding.

## 5. Long-Term Considerations

*   **Post-Quantum Cryptography Readiness:** Keep an eye on PQC developments and be prepared for eventual migration. WASM exploration can be a step in this direction for performance.
*   **Community Building:** Actively engage with the GitHub community for contributions, feedback, and support.

This go-forward plan provides a roadmap for enhancing Encrypti0n.com, balancing immediate user needs with long-term strategic goals. It should be treated as a living document, subject to revision as user feedback is gathered and the technological landscape evolves.
