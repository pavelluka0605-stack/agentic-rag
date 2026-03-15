/**
 * Mebelit — main.js v2.0
 *
 * Header scroll, mobile menu, phone mask, smooth scroll,
 * AJAX forms, popups, before/after slider
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initMobileMenu();
    initPhoneMask();
    initSmoothScroll();
    initForms();
    initPopups();
    initBeforeAfter();
  });


  /* ==========================================
     HEADER SCROLL EFFECT
     ========================================== */

  function initHeaderScroll() {
    var header = document.querySelector('.site-header, header.elementor-location-header');
    if (!header) return;

    window.addEventListener('scroll', function () {
      if (window.pageYOffset > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }


  /* ==========================================
     MOBILE MENU
     ========================================== */

  function initMobileMenu() {
    var burger = document.querySelector('.header-burger');
    var nav = document.querySelector('.header-nav');
    if (!burger || !nav) return;

    burger.addEventListener('click', function () {
      burger.classList.toggle('active');
      nav.classList.toggle('open');
      document.body.classList.toggle('menu-open');
    });

    // Close menu on link click
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        burger.classList.remove('active');
        nav.classList.remove('open');
        document.body.classList.remove('menu-open');
      });
    });

    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        burger.classList.remove('active');
        nav.classList.remove('open');
        document.body.classList.remove('menu-open');
      }
    });
  }


  /* ==========================================
     PHONE MASK (+7 format)
     ========================================== */

  function initPhoneMask() {
    document.addEventListener('input', function (e) {
      if (e.target.type !== 'tel') return;
      applyPhoneMask(e.target);
    });

    // Apply to existing fields
    document.querySelectorAll('input[type="tel"]').forEach(function (input) {
      input.addEventListener('focus', function () {
        if (!this.value) this.value = '+7 ';
      });
    });
  }

  function applyPhoneMask(input) {
    var value = input.value.replace(/\D/g, '');
    if (value.length === 0) {
      input.value = '';
      return;
    }
    if (value[0] === '8') value = '7' + value.slice(1);
    if (value[0] !== '7') value = '7' + value;

    var formatted = '+7';
    if (value.length > 1) formatted += ' (' + value.slice(1, 4);
    if (value.length > 4) formatted += ') ' + value.slice(4, 7);
    if (value.length > 7) formatted += '-' + value.slice(7, 9);
    if (value.length > 9) formatted += '-' + value.slice(9, 11);

    input.value = formatted;
  }


  /* ==========================================
     SMOOTH SCROLL
     ========================================== */

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var targetId = this.getAttribute('href');
        if (targetId === '#' || targetId === '#!') return;
        var target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          var headerHeight = document.querySelector('.site-header, header.elementor-location-header');
          var offset = headerHeight ? headerHeight.offsetHeight + 20 : 80;
          var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }


  /* ==========================================
     AJAX FORMS
     ========================================== */

  function initForms() {
    document.querySelectorAll('.mebelit-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitForm(this);
      });
    });
  }

  function submitForm(form) {
    var name = form.querySelector('input[name="name"]');
    var phone = form.querySelector('input[name="phone"]');
    var consent = form.querySelector('input[name="consent"]');
    var status = form.querySelector('.mebelit-form__status');
    var btn = form.querySelector('button[type="submit"]');
    var formType = form.dataset.formType || 'general';

    // Validation
    var errors = [];
    if (phone) {
      var phoneClean = phone.value.replace(/\D/g, '');
      if (phoneClean.length < 11) {
        phone.classList.add('error');
        errors.push('phone');
      } else {
        phone.classList.remove('error');
      }
    }

    if (consent && !consent.checked) {
      errors.push('consent');
    }

    if (errors.length > 0) {
      showStatus(status, 'Проверьте правильность заполнения полей', 'error');
      return;
    }

    // Disable button
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'ОТПРАВКА...';

    // Build form data
    var formData = new FormData();
    formData.append('action', 'mebelit_contact');
    formData.append('nonce', (window.mebelitAjax && window.mebelitAjax.nonce) || '');
    formData.append('name', name ? name.value : '');
    formData.append('phone', phone ? phone.value : '');
    formData.append('form_type', formType);
    formData.append('page_url', window.location.href);

    // Honeypot
    var honeypot = form.querySelector('input[name="website_url"]');
    if (honeypot) {
      formData.append('website_url', honeypot.value);
    }

    var ajaxUrl = (window.mebelitAjax && window.mebelitAjax.ajaxUrl) || '/wp-admin/admin-ajax.php';

    fetch(ajaxUrl, { method: 'POST', body: formData })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.success) {
          showStatus(status, 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.', 'success');
          form.reset();
          // Yandex Metrika goal
          if (window.ym) {
            ym(103970425, 'reachGoal', 'form_submit_' + formType);
          }
          // Close popup after delay if in popup
          var popup = form.closest('.mebelit-popup-overlay');
          if (popup) {
            setTimeout(function () {
              closePopup(popup);
            }, 2000);
          }
        } else {
          showStatus(status, data.data && data.data.message ? data.data.message : 'Произошла ошибка', 'error');
        }
      })
      .catch(function () {
        showStatus(status, 'Ошибка сети. Попробуйте позже.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = originalText;
      });
  }

  function showStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = 'mebelit-form__status mebelit-form__status--' + type;
    el.style.display = 'block';

    if (type === 'success') {
      setTimeout(function () {
        el.style.display = 'none';
      }, 5000);
    }
  }


  /* ==========================================
     POPUPS
     ========================================== */

  function initPopups() {
    // Open popup
    document.querySelectorAll('[data-popup]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var popupId = this.dataset.popup;
        var popup = document.getElementById(popupId);
        if (popup) openPopup(popup);
      });
    });

    // Close popup on X button
    document.querySelectorAll('.mebelit-popup__close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var overlay = this.closest('.mebelit-popup-overlay');
        if (overlay) closePopup(overlay);
      });
    });

    // Close popup on overlay click
    document.querySelectorAll('.mebelit-popup-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === this) closePopup(this);
      });
    });

    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.mebelit-popup-overlay.active').forEach(function (popup) {
          closePopup(popup);
        });
      }
    });
  }

  function openPopup(overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Focus first input
    setTimeout(function () {
      var input = overlay.querySelector('input[type="text"], input[type="tel"]');
      if (input) input.focus();
    }, 300);
  }

  function closePopup(overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    // Reset form status
    var status = overlay.querySelector('.mebelit-form__status');
    if (status) status.style.display = 'none';
  }

  // Global popup functions
  window.mebelitOpenPopup = function (id) {
    var popup = document.getElementById(id);
    if (popup) openPopup(popup);
  };

  window.mebelitClosePopup = function (id) {
    var popup = document.getElementById(id);
    if (popup) closePopup(popup);
  };


  /* ==========================================
     BEFORE / AFTER SLIDER
     ========================================== */

  function initBeforeAfter() {
    document.querySelectorAll('.before-after').forEach(function (container) {
      var slider = container.querySelector('.before-after__slider');
      var beforeImg = container.querySelector('.before-after__before');
      if (!slider || !beforeImg) return;

      var isDragging = false;

      function updatePosition(x) {
        var rect = container.getBoundingClientRect();
        var pos = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        var percent = pos * 100;
        slider.style.left = percent + '%';
        beforeImg.style.clipPath = 'inset(0 ' + (100 - percent) + '% 0 0)';
      }

      slider.addEventListener('mousedown', function (e) {
        isDragging = true;
        e.preventDefault();
      });

      container.addEventListener('mousedown', function (e) {
        isDragging = true;
        updatePosition(e.clientX);
      });

      document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        updatePosition(e.clientX);
      });

      document.addEventListener('mouseup', function () {
        isDragging = false;
      });

      // Touch support
      slider.addEventListener('touchstart', function (e) {
        isDragging = true;
        e.preventDefault();
      });

      container.addEventListener('touchstart', function (e) {
        isDragging = true;
        updatePosition(e.touches[0].clientX);
      });

      document.addEventListener('touchmove', function (e) {
        if (!isDragging) return;
        updatePosition(e.touches[0].clientX);
      });

      document.addEventListener('touchend', function () {
        isDragging = false;
      });
    });
  }

})();
