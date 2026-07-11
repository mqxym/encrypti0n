'use strict';

const appVersion = "3.4.0";

function normalizeUrl(url) {
    return url.replace(/\/$/, "");
}

function updateDomainBannerVisibility() {
    const oldDomainBanner = document.getElementById('old-domain-banner');
    const newDomainBanner = document.getElementById('new-domain-banner');

    if (!oldDomainBanner || !newDomainBanner) {
        return;
    }

    const currentOrigin = normalizeUrl(window.location.origin);
    const oldDomainUrl = normalizeUrl('https://encrypti0n.com');
    const newDomainUrl = normalizeUrl('https://app.encrypti0n.com');

     
    oldDomainBanner.classList.toggle('d-none', currentOrigin !== oldDomainUrl);
    newDomainBanner.classList.toggle('d-none', currentOrigin !== newDomainUrl);

}

updateDomainBannerVisibility();

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