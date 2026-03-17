/**
 * Kuhni Rema - Main JS
 * Mobile menu, sticky header, smooth scroll, sticky CTA, recently viewed.
 * Vanilla JS, no dependencies.
 */
(function () {
  'use strict';

  /* -------------------------------------------------------
   * Helpers
   * ----------------------------------------------------- */
  function raf(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        fn();
        ticking = false;
      });
    };
  }

  /* -------------------------------------------------------
   * Mobile Menu
   * ----------------------------------------------------- */
  function initMobileMenu() {
    var burgerBtn = document.querySelector('.header__burger');
    if (!burgerBtn) return;

    var body = document.body;

    function openMenu() {
      body.classList.add('menu-open');
      body.style.overflow = 'hidden';
      burgerBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      body.classList.remove('menu-open');
      body.style.overflow = '';
      burgerBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
      if (body.classList.contains('menu-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    burgerBtn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleMenu();
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) {
        closeMenu();
      }
    });

    // Close when clicking outside the mobile nav or burger button
    document.addEventListener('click', function (e) {
      if (!body.classList.contains('menu-open')) return;
      if (e.target.closest('.header__mobile-nav') || e.target.closest('.header__burger')) return;
      closeMenu();
    });

    // Close when clicking any nav link inside mobile menu
    var navLinks = document.querySelectorAll('.header__mobile-nav a');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener('click', function () {
        closeMenu();
      });
    }
  }

  /* -------------------------------------------------------
   * Sticky Header
   * ----------------------------------------------------- */
  function initStickyHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var THRESHOLD = 100;

    var handleScroll = raf(function () {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollY > THRESHOLD) {
        header.classList.add('header--sticky');
      } else {
        header.classList.remove('header--sticky');
      }
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on load in case page is already scrolled
    handleScroll();
  }

  /* -------------------------------------------------------
   * Smooth Scroll for Anchor Links
   * ----------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      if (!/^#[a-zA-Z0-9_-]+$/.test(hash)) return;

      var target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();

      var headerOffset = 100;
      var elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
      var offsetPosition = elementPosition - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, '', hash);
      }
    });
  }

  /* -------------------------------------------------------
   * Sticky CTA (mobile only)
   * ----------------------------------------------------- */
  function initStickyCTA() {
    var ctaEl = document.querySelector('.cta-sticky');
    if (!ctaEl) return;

    // Hide on specific pages
    var path = window.location.pathname;
    if (path.indexOf('/kalkulyator/') !== -1 || path.indexOf('/spasibo/') !== -1) {
      ctaEl.style.display = 'none';
      return;
    }

    var SCROLL_THRESHOLD = 600;
    var MOBILE_BREAKPOINT = 768;

    var handleScroll = raf(function () {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var isMobile = window.innerWidth < MOBILE_BREAKPOINT;

      if (isMobile && scrollY > SCROLL_THRESHOLD) {
        ctaEl.classList.add('is-visible');
      } else {
        ctaEl.classList.remove('is-visible');
      }
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();
  }

  /* -------------------------------------------------------
   * Recently Viewed Kitchens
   * ----------------------------------------------------- */
  function initRecentlyViewed() {
    var STORAGE_KEY = 'kuhni_rema_recent';
    var MAX_ITEMS = 10;

    function getRecent() {
      try {
        var data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    }

    function saveRecent(items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        // localStorage may be full or unavailable
      }
    }

    // Store current kitchen post ID if on a single kitchen page
    var kitchenId = document.body.getAttribute('data-kitchen-id');
    if (kitchenId) {
      kitchenId = parseInt(kitchenId, 10);
      if (kitchenId) {
        var recent = getRecent();
        // Remove if already present to move to front
        recent = recent.filter(function (id) {
          return id !== kitchenId;
        });
        recent.unshift(kitchenId);
        // Cap at MAX_ITEMS
        if (recent.length > MAX_ITEMS) {
          recent = recent.slice(0, MAX_ITEMS);
        }
        saveRecent(recent);
      }
    }

    // Render recently viewed items
    var container = document.querySelector('.recently-viewed');
    if (!container) return;

    var recentIds = getRecent();
    if (!recentIds.length) {
      container.style.display = 'none';
      return;
    }

    // Check for pre-rendered items with data-post-id and reorder / show them
    var items = container.querySelectorAll('[data-post-id]');
    if (items.length) {
      var parent = items[0].parentNode;
      var map = {};
      for (var i = 0; i < items.length; i++) {
        var postId = parseInt(items[i].getAttribute('data-post-id'), 10);
        map[postId] = items[i];
        items[i].style.display = 'none';
      }

      var shown = 0;
      for (var j = 0; j < recentIds.length; j++) {
        var el = map[recentIds[j]];
        if (el) {
          el.style.display = '';
          parent.appendChild(el); // move to end to reorder
          shown++;
        }
      }

      if (shown === 0) {
        container.style.display = 'none';
      } else {
        container.style.display = '';
      }
    } else {
      // If no pre-rendered items, expose IDs for use by other scripts or AJAX
      container.setAttribute('data-recent-ids', JSON.stringify(recentIds));
    }
  }

  /* -------------------------------------------------------
   * Footer Accordion
   * ----------------------------------------------------- */
  function initFooterAccordion() {
    var toggles = document.querySelectorAll('[data-accordion]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        this.classList.toggle('is-open');
        var list = this.nextElementSibling;
        if (list) {
          list.classList.toggle('is-open');
        }
      });
    }
  }

  /* -------------------------------------------------------
   * Init on DOMContentLoaded
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initMobileMenu();
    initStickyHeader();
    initSmoothScroll();
    initStickyCTA();
    initRecentlyViewed();
    initFooterAccordion();
  });
})();
