(function () {
  /* ===== Small polyfills / helpers ===== */
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (s) {
      var el = this;
      do { if (el.matches && el.matches(s)) return el; el = el.parentElement || el.parentNode; }
      while (el && el.nodeType === 1);
      return null;
    };
  }

  var rAF = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
  var cAF = window.cancelAnimationFrame || clearTimeout;

  function getScrollEl() {
    // Cross-browser scrolling root
    return document.scrollingElement || document.documentElement || document.body;
  }
  function getViewportHeight() {
    // Use visual viewport on mobile to account for browser UI
    return (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight;
  }

  /* ===== Scrolling engine (requestAnimationFrame) ===== */
  function animateScrollToY(targetY, duration, done) {
    var scrollEl = getScrollEl();
    var startY = scrollEl.scrollTop;
    var dist = targetY - startY;
    if (duration <= 0 || Math.abs(dist) < 1) {
      scrollEl.scrollTop = targetY;
      if (done) done();
      return { cancel: function(){} };
    }

    var startTime = null, rafId = null, cancelled = false;

    // Cancel on user interaction (wheel/touch/key) for expected behavior
    function cancelOnUserInput() {
      cancelled = true;
      if (rafId) cAF(rafId);
      removeCancelListeners();
    }
    function addCancelListeners() {
      window.addEventListener('wheel', cancelOnUserInput, { passive: true, once: true });
      window.addEventListener('touchstart', cancelOnUserInput, { passive: true, once: true });
      window.addEventListener('keydown', cancelOnUserInput, { passive: true, once: true });
    }
    function removeCancelListeners() {
      window.removeEventListener('wheel', cancelOnUserInput, { passive: true, once: true });
      window.removeEventListener('touchstart', cancelOnUserInput, { passive: true, once: true });
      window.removeEventListener('keydown', cancelOnUserInput, { passive: true, once: true });
    }
    addCancelListeners();

    // Ease in-out cubic
    function ease(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

    function step(ts) {
      if (cancelled) return;
      if (startTime === null) startTime = ts;
      var elapsed = ts - startTime;
      var t = Math.min(1, elapsed / duration);
      var e = ease(t);
      scrollEl.scrollTop = startY + dist * e;
      if (t < 1) {
        rafId = rAF(step);
      } else {
        removeCancelListeners();
        if (done) done();
      }
    }
    rafId = rAF(step);

    return {
      cancel: function () {
        cancelled = true;
        if (rafId) cAF(rafId);
        removeCancelListeners();
      }
    };
  }

  /* ===== Centering + highlight ===== */
  function computeCenterY(el) {
    var rect = el.getBoundingClientRect();
    var scrollEl = getScrollEl();
    var absoluteY = scrollEl.scrollTop + rect.top;
    var vpH = getViewportHeight();
    var offset = (vpH / 2) - (rect.height / 2);
    return Math.max(absoluteY - offset, 0);
  }

  function highlightAfter(el, delay) {
    var addedTabIndex = false;
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
      addedTabIndex = true;
    }

    setTimeout(function () {
      // Restart animation cleanly
      el.classList.remove('anchor-highlight');
      void el.offsetWidth; // reflow
      el.classList.add('anchor-highlight');

      if (el.focus) {
        try { el.focus({ preventScroll: true }); }
        catch (_) { el.focus(); }
      }

      if (addedTabIndex) {
        el.addEventListener('blur', function cleanup() {
          el.removeEventListener('blur', cleanup);
          el.removeAttribute('tabindex');
        }, { once: true });
      }
    }, Math.max(0, delay || 0));
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) { return false; }
  }

  /* ===== Main handlers ===== */
  function handleTarget(id, useHistory) {
    var el = document.getElementById(id);
    if (!el) return;

    if (useHistory) {
      if (history.pushState) history.pushState(null, '', '#' + encodeURIComponent(id));
      else location.hash = id;
    }

    var reduce = prefersReducedMotion();
    var targetY = computeCenterY(el);

    // Adaptive duration: ~0.5s per 1000px, clamped 300–1200ms
    var distance = Math.abs(getScrollEl().scrollTop - targetY);
    var duration = reduce ? 0 : Math.min(1200, Math.max(300, Math.round(distance * 0.5)));

    animateScrollToY(targetY, duration, function () {
      // Scroll done: run highlight
      highlightAfter(el, 80); // tiny buffer so rendering is settled
    });
  }

  function onAnchorClick(e) {
    var a = e.target && e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.length <= 1) return;

    var id = decodeURIComponent(href.slice(1));
    if (!document.getElementById(id)) return; // let browser handle if not found

    e.preventDefault();
    handleTarget(id, true);
  }

  function onHashChange() {
    if (!location.hash) return;
    var id = decodeURIComponent(location.hash.slice(1));
    if (!document.getElementById(id)) return;
    handleTarget(id, false);
  }

  function onLoadWithHash() {
    if (!location.hash) return;
    var id = decodeURIComponent(location.hash.slice(1));
    if (!document.getElementById(id)) return;
    // Delay to allow layout, webfonts, headers, etc. to settle
    setTimeout(function () { handleTarget(id, false); }, 0);
  }

  document.addEventListener('click', onAnchorClick, false);
  window.addEventListener('hashchange', onHashChange, false);
  window.addEventListener('load', onLoadWithHash, false);
})();