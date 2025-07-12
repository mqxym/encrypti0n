'use strict';

const appVersion = "3.0.0b8";

document.querySelectorAll(".version").forEach(function(el) {
  el.textContent = appVersion;
});

document.getElementById('currentYear').textContent = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', (event) => { 
    const highlightElements = document.querySelectorAll('.language-javascript, .language-json');
    if (highlightElements.length > 0) {
        highlightElements.forEach((el) => { 
            hljs.highlightElement(el); 
        });
    }
});