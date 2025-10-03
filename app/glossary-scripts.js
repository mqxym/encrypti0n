(function () {
  function scrollToCenter(el, smooth = true, callback) {
    var rect = el.getBoundingClientRect();
    var absoluteY = window.pageYOffset + rect.top;
    var offset = (window.innerHeight / 2) - (rect.height / 2);
    var targetY = Math.max(absoluteY - offset, 0);

    // Calculate an approximate duration: ~0.5s per 1000px (capped)
    var distance = Math.abs(window.scrollY - targetY);
    var duration = Math.min(1200, Math.max(300, distance / 2)); // 300–1200ms

    window.scrollTo({
      top: targetY,
      left: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });

    // Trigger callback after the scroll is likely done
    setTimeout(callback, smooth ? duration + 100 : 0);
  }

  function highlight(el) {
    var addedTabIndex = false;
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
      addedTabIndex = true;
    }

    el.classList.remove('anchor-highlight');
    void el.offsetWidth; // force reflow
    el.classList.add('anchor-highlight');

    if (el.focus) el.focus({ preventScroll: true });

    if (addedTabIndex) {
      el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
    }
  }

  function onAnchorClick(e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.length <= 1) return;

    var id = decodeURIComponent(href.slice(1));
    var target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();

    if (history.pushState) history.pushState(null, '', '#' + id);
    else location.hash = id;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollToCenter(target, !reduceMotion, function () {
      highlight(target);
    });
  }

  function onHashChange() {
    if (!location.hash) return;
    var id = decodeURIComponent(location.hash.slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollToCenter(target, !reduceMotion, function () {
      highlight(target);
    });
  }

  function onLoadWithHash() {
    if (!location.hash) return;
    var id = decodeURIComponent(location.hash.slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    setTimeout(function () {
      var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollToCenter(target, !reduceMotion, function () {
        highlight(target);
      });
    }, 0);
  }

  document.addEventListener('click', onAnchorClick, { passive: false });
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('load', onLoadWithHash);
})();