/**
 * Kuhni Rema - Quiz Popup
 * Shows a quiz popup after 45 seconds on the page.
 * Self-contained: CSS is injected via a <style> element.
 * Vanilla JS, no dependencies.
 */
(function () {
  'use strict';

  var DELAY_MS = 45000;
  var DISMISSED_KEY = 'kuhni_quiz_popup_dismissed';
  var SUBMITTED_KEY = 'kuhni_form_submitted';
  var QUIZ_PATH = '/kalkulyator/';
  var THANKS_PATH = '/spasibo/';

  /* -------------------------------------------------------
   * Should we show the popup?
   * ----------------------------------------------------- */
  function shouldShow() {
    var path = window.location.pathname;

    // Don't show on quiz or thanks pages
    if (path.indexOf(QUIZ_PATH) !== -1 || path.indexOf(THANKS_PATH) !== -1) {
      return false;
    }

    // Don't show if already dismissed or form submitted
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return false;
      if (sessionStorage.getItem(SUBMITTED_KEY)) return false;
    } catch (e) {
      // sessionStorage unavailable — show anyway
    }

    return true;
  }

  /* -------------------------------------------------------
   * Inject CSS
   * ----------------------------------------------------- */
  function injectStyles() {
    var css =
      '.kr-quiz-popup-overlay {' +
        'position: fixed;' +
        'top: 0; left: 0; right: 0; bottom: 0;' +
        'z-index: 10000;' +
        'background: rgba(0, 0, 0, 0.6);' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: center;' +
        'opacity: 0;' +
        'transition: opacity 0.3s ease;' +
        'padding: 16px;' +
      '}' +
      '.kr-quiz-popup-overlay.is-visible {' +
        'opacity: 1;' +
      '}' +
      '.kr-quiz-popup {' +
        'background: #fff;' +
        'border-radius: 16px;' +
        'max-width: 480px;' +
        'width: 100%;' +
        'padding: 40px 32px 32px;' +
        'position: relative;' +
        'text-align: center;' +
        'box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);' +
        'transform: translateY(20px);' +
        'transition: transform 0.3s ease;' +
      '}' +
      '.kr-quiz-popup-overlay.is-visible .kr-quiz-popup {' +
        'transform: translateY(0);' +
      '}' +
      '.kr-quiz-popup__close {' +
        'position: absolute;' +
        'top: 12px; right: 12px;' +
        'width: 36px; height: 36px;' +
        'border: none;' +
        'background: #f5f5f5;' +
        'border-radius: 50%;' +
        'cursor: pointer;' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: center;' +
        'font-size: 20px;' +
        'line-height: 1;' +
        'color: #666;' +
        'transition: background 0.2s ease, color 0.2s ease;' +
      '}' +
      '.kr-quiz-popup__close:hover,' +
      '.kr-quiz-popup__close:focus {' +
        'background: #e0e0e0;' +
        'color: #333;' +
        'outline: none;' +
      '}' +
      '.kr-quiz-popup__close:focus-visible {' +
        'box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.5);' +
      '}' +
      '.kr-quiz-popup__title {' +
        'font-family: "Montserrat", sans-serif;' +
        'font-size: 22px;' +
        'font-weight: 700;' +
        'color: #1a1a1a;' +
        'margin: 0 0 12px;' +
        'line-height: 1.3;' +
      '}' +
      '.kr-quiz-popup__subtitle {' +
        'font-size: 16px;' +
        'color: #555;' +
        'margin: 0 0 28px;' +
        'line-height: 1.5;' +
      '}' +
      '.kr-quiz-popup__cta {' +
        'display: inline-block;' +
        'background: var(--color-primary, #E65100);' +
        'color: #fff;' +
        'font-family: "Montserrat", sans-serif;' +
        'font-size: 16px;' +
        'font-weight: 600;' +
        'padding: 14px 36px;' +
        'border-radius: 8px;' +
        'text-decoration: none;' +
        'transition: background 0.2s ease, transform 0.15s ease;' +
        'cursor: pointer;' +
        'border: none;' +
      '}' +
      '.kr-quiz-popup__cta:hover,' +
      '.kr-quiz-popup__cta:focus {' +
        'background: var(--color-primary-dark, #BF360C);' +
        'transform: translateY(-1px);' +
        'outline: none;' +
      '}' +
      '.kr-quiz-popup__cta:focus-visible {' +
        'box-shadow: 0 0 0 3px rgba(230, 81, 0, 0.4);' +
      '}' +
      '@media (max-width: 480px) {' +
        '.kr-quiz-popup { padding: 32px 20px 24px; }' +
        '.kr-quiz-popup__title { font-size: 19px; }' +
        '.kr-quiz-popup__subtitle { font-size: 15px; }' +
        '.kr-quiz-popup__cta { width: 100%; padding: 14px 20px; }' +
      '}';

    var style = document.createElement('style');
    style.setAttribute('data-kr-quiz-popup', '');
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* -------------------------------------------------------
   * Dispatch analytics event
   * ----------------------------------------------------- */
  function fireEvent(action) {
    try {
      document.dispatchEvent(
        new CustomEvent('kuhniRema:quizPopup', {
          detail: { action: action },
        })
      );
    } catch (e) {
      // CustomEvent not supported — skip silently
    }
  }

  /* -------------------------------------------------------
   * Mark as dismissed
   * ----------------------------------------------------- */
  function setDismissed() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch (e) {
      // Ignore
    }
  }

  /* -------------------------------------------------------
   * Focus trap
   * ----------------------------------------------------- */
  function trapFocus(overlayEl) {
    var focusable = overlayEl.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    overlayEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* -------------------------------------------------------
   * Create and show the popup
   * ----------------------------------------------------- */
  function showPopup() {
    injectStyles();

    // Build DOM
    var overlay = document.createElement('div');
    overlay.className = 'kr-quiz-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Рассчитайте стоимость кухни');

    var card = document.createElement('div');
    card.className = 'kr-quiz-popup';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'kr-quiz-popup__close';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.innerHTML = '&#215;';

    var title = document.createElement('h2');
    title.className = 'kr-quiz-popup__title';
    title.textContent = 'Рассчитайте стоимость вашей кухни за 2 минуты';

    var subtitle = document.createElement('p');
    subtitle.className = 'kr-quiz-popup__subtitle';
    subtitle.textContent = 'Ответьте на 4 вопроса и получите точный расчёт';

    var cta = document.createElement('a');
    cta.className = 'kr-quiz-popup__cta';
    cta.href = QUIZ_PATH;
    cta.textContent = 'Рассчитать стоимость';

    card.appendChild(closeBtn);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(cta);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Store previously focused element to restore on close
    var previousFocus = document.activeElement;

    // Close function
    function close() {
      setDismissed();
      fireEvent('close');
      overlay.classList.remove('is-visible');
      // Remove from DOM after transition
      setTimeout(function () {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 350);
      // Restore focus
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    }

    // Close button click
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      close();
    });

    // Backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        close();
      }
    });

    // Escape key
    function onKeydown(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKeydown);
      }
    }
    document.addEventListener('keydown', onKeydown);

    // CTA click analytics
    cta.addEventListener('click', function () {
      setDismissed();
      fireEvent('click');
    });

    // Focus trap
    trapFocus(overlay);

    // Trigger fade-in on next frame
    requestAnimationFrame(function () {
      overlay.classList.add('is-visible');
      // Focus the CTA button for accessibility
      cta.focus();
    });

    // Fire show event
    fireEvent('show');
  }

  /* -------------------------------------------------------
   * Init
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (!shouldShow()) return;

    setTimeout(function () {
      // Re-check in case user submitted a form during the 45 seconds
      if (!shouldShow()) return;
      showPopup();
    }, DELAY_MS);
  });
})();
