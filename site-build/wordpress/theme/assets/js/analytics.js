/**
 * Kuhni Rema - Analytics
 * Yandex Metrika event tracking.
 * Counter ID comes from the page via window.ym function.
 */
(function () {
  'use strict';

  /* -------------------------------------------------------
   * Safe Metrika Wrapper
   * ----------------------------------------------------- */
  function getCounterId() {
    // Yandex Metrika stores counter IDs in Ya._metrika.counters or similar.
    // Try common patterns to find the counter ID.
    if (window.Ya && window.Ya._metrika && window.Ya._metrika.counter) {
      return window.Ya._metrika.counter.id;
    }

    // Check for counters array
    if (window.Ya && window.Ya._metrika && window.Ya._metrika.counters) {
      var counters = window.Ya._metrika.counters;
      if (counters.length > 0) {
        return counters[0].id;
      }
    }

    // Fallback: look for ym counter data in the page
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var text = scripts[i].textContent;
      var match = text.match(/ym\((\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  var _counterId = null;

  function ymGoal(goalName, params) {
    if (typeof window.ym !== 'function') return;

    if (!_counterId) {
      _counterId = getCounterId();
    }
    if (!_counterId) return;

    try {
      if (params) {
        window.ym(_counterId, 'reachGoal', goalName, params);
      } else {
        window.ym(_counterId, 'reachGoal', goalName);
      }
    } catch (e) {
      // Silently fail if Metrika errors
    }
  }

  /* -------------------------------------------------------
   * Track Form Submissions
   * ----------------------------------------------------- */
  function initFormTracking() {
    document.addEventListener('kuhniRema:formSuccess', function (e) {
      var formType = e.detail && e.detail.form_type ? e.detail.form_type : 'unknown';
      ymGoal('form_submit', { form_type: formType });
    });
  }

  /* -------------------------------------------------------
   * Track Quiz Steps & Completion
   * ----------------------------------------------------- */
  function initQuizTracking() {
    document.addEventListener('kuhniRema:quizStep', function (e) {
      var step = e.detail && e.detail.step ? e.detail.step : 0;
      ymGoal('quiz_step_' + step);
    });

    document.addEventListener('kuhniRema:quizComplete', function () {
      ymGoal('quiz_complete');
    });
  }

  /* -------------------------------------------------------
   * Track CTA Clicks
   * ----------------------------------------------------- */
  function initCTATracking() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn--primary');
      if (!btn) return;

      ymGoal('cta_click', {
        button_text: btn.textContent.trim().substring(0, 100),
        page_url: window.location.href,
      });
    });
  }

  /* -------------------------------------------------------
   * Track Phone Clicks
   * ----------------------------------------------------- */
  function initPhoneTracking() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="tel:"]');
      if (!link) return;

      ymGoal('phone_click');
    });
  }

  /* -------------------------------------------------------
   * Track Catalog Filter Usage
   * ----------------------------------------------------- */
  function initFilterTracking() {
    document.addEventListener('change', function (e) {
      var filter = e.target.closest('.catalog-filter');
      if (!filter) return;

      ymGoal('filter_use');
    });
  }

  /* -------------------------------------------------------
   * Track Scroll Depth
   * ----------------------------------------------------- */
  function initScrollDepthTracking() {
    var fired = {
      25: false,
      50: false,
      75: false,
      100: false,
    };

    var ticking = false;

    function checkScrollDepth() {
      var docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      var viewportHeight = window.innerHeight;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // Avoid division by zero on very short pages
      var scrollable = docHeight - viewportHeight;
      if (scrollable <= 0) return;

      var percent = Math.round((scrollTop / scrollable) * 100);

      if (percent >= 25 && !fired[25]) {
        fired[25] = true;
        ymGoal('scroll_depth_25');
      }
      if (percent >= 50 && !fired[50]) {
        fired[50] = true;
        ymGoal('scroll_depth_50');
      }
      if (percent >= 75 && !fired[75]) {
        fired[75] = true;
        ymGoal('scroll_depth_75');
      }
      if (percent >= 100 && !fired[100]) {
        fired[100] = true;
        ymGoal('scroll_depth_100');
      }
    }

    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          checkScrollDepth();
          ticking = false;
        });
      },
      { passive: true }
    );

    // Check once on load for short pages
    checkScrollDepth();
  }

  /* -------------------------------------------------------
   * Init
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initFormTracking();
    initQuizTracking();
    initCTATracking();
    initPhoneTracking();
    initFilterTracking();
    initScrollDepthTracking();
  });
})();
