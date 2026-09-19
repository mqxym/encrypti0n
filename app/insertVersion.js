'use strict';

const appVersion = "3.5.0";

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

    var banner = document.getElementById('offline-banner');

    function updateBanner() {
        if (navigator.onLine) {
            banner.classList.add('d-none');
        } else {
            banner.classList.remove('d-none');
        }
    }

    updateBanner();

    window.addEventListener('online', updateBanner);
    window.addEventListener('offline', updateBanner);
});