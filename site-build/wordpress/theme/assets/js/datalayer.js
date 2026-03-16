/**
 * Kuhni Rema - Ecommerce DataLayer
 * Pushes ecommerce events to window.dataLayer for Yandex Metrika Ecommerce.
 * Compatible with Google Tag Manager dataLayer pattern.
 * Vanilla JS, no dependencies.
 */
(function () {
  'use strict';

  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  var CURRENCY = 'RUB';

  /* -------------------------------------------------------
   * Helpers
   * ----------------------------------------------------- */

  /**
   * Parse a price string like "от 63 700 ₽" or "127 500" into a number.
   * Returns 0 if parsing fails.
   */
  function parsePrice(text) {
    if (!text) return 0;
    // Remove everything except digits and dots/commas
    var cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Extract slug from a URL path, e.g. "/kuhnya/model-name/" => "model-name"
   */
  function slugFromUrl(url) {
    if (!url) return '';
    try {
      var a = document.createElement('a');
      a.href = url;
      var path = a.pathname.replace(/\/+$/, '');
      var parts = path.split('/');
      return parts[parts.length - 1] || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Get page title or a fallback category string
   */
  function getPageCategory() {
    var heading = document.querySelector('h1');
    if (heading) return heading.textContent.trim();
    return document.title || '';
  }

  /* -------------------------------------------------------
   * Product Impressions (catalog pages)
   * ----------------------------------------------------- */
  function trackImpressions() {
    var grid = document.querySelector('.catalog-grid');
    if (!grid) return;

    var cards = grid.querySelectorAll('.card--kitchen');
    if (!cards.length) return;

    var impressions = [];
    var category = getPageCategory();

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];

      // Get link for slug/id
      var link = card.querySelector('a[href]') || card.closest('a[href]');
      var href = link ? link.getAttribute('href') : '';
      var id = slugFromUrl(href);

      // Get title
      var titleEl = card.querySelector('.card--kitchen__title');
      var name = titleEl ? titleEl.textContent.trim() : '';

      // Get price
      var priceEl = card.querySelector('.card--kitchen__price');
      var price = priceEl ? parsePrice(priceEl.textContent) : 0;

      if (id || name) {
        impressions.push({
          id: id,
          name: name,
          price: price,
          category: category,
          position: i + 1,
        });
      }
    }

    if (impressions.length) {
      window.dataLayer.push({
        ecommerce: {
          currencyCode: CURRENCY,
          impressions: impressions,
        },
      });
    }
  }

  /* -------------------------------------------------------
   * Product Detail View (single kitchen page)
   * ----------------------------------------------------- */
  function trackDetailView() {
    var detailEl = document.querySelector('.kitchen-detail');
    if (!detailEl) return;

    // Get kitchen ID from body attribute
    var kitchenId = document.body.getAttribute('data-kitchen-id') || '';

    // Slug fallback from URL
    var slug = slugFromUrl(window.location.href);
    var id = kitchenId || slug;

    // Name from title
    var titleEl = detailEl.querySelector('.kitchen-detail__title');
    var name = titleEl ? titleEl.textContent.trim() : (document.title || '');

    // Price
    var priceEl = detailEl.querySelector('.kitchen-detail__price');
    var price = priceEl ? parsePrice(priceEl.textContent) : 0;

    // Category from kitchen type spec or breadcrumbs
    var category = '';

    // Try to get from spec table
    var specLabels = detailEl.querySelectorAll('.kitchen-detail__spec-label');
    for (var i = 0; i < specLabels.length; i++) {
      if (specLabels[i].textContent.trim() === 'Тип кухни') {
        var valueEl = specLabels[i].nextElementSibling;
        if (valueEl) {
          category = valueEl.textContent.trim();
        }
        break;
      }
    }

    if (!category) {
      category = getPageCategory();
    }

    window.dataLayer.push({
      ecommerce: {
        currencyCode: CURRENCY,
        detail: {
          products: [
            {
              id: id,
              name: name,
              price: price,
              category: category,
            },
          ],
        },
      },
    });
  }

  /* -------------------------------------------------------
   * Add to Cart (form submission from kitchen page)
   * ----------------------------------------------------- */
  function trackAddToCart() {
    document.addEventListener('kuhniRema:formSuccess', function () {
      // Only fire on single kitchen pages
      var detailEl = document.querySelector('.kitchen-detail');
      if (!detailEl) return;

      var kitchenId = document.body.getAttribute('data-kitchen-id') || '';
      var slug = slugFromUrl(window.location.href);
      var id = kitchenId || slug;

      var titleEl = detailEl.querySelector('.kitchen-detail__title');
      var name = titleEl ? titleEl.textContent.trim() : '';

      var priceEl = detailEl.querySelector('.kitchen-detail__price');
      var price = priceEl ? parsePrice(priceEl.textContent) : 0;

      var category = '';
      var specLabels = detailEl.querySelectorAll('.kitchen-detail__spec-label');
      for (var i = 0; i < specLabels.length; i++) {
        if (specLabels[i].textContent.trim() === 'Тип кухни') {
          var valueEl = specLabels[i].nextElementSibling;
          if (valueEl) {
            category = valueEl.textContent.trim();
          }
          break;
        }
      }

      window.dataLayer.push({
        ecommerce: {
          currencyCode: CURRENCY,
          add: {
            products: [
              {
                id: id,
                name: name,
                price: price,
                category: category,
                quantity: 1,
              },
            ],
          },
        },
      });
    });
  }

  /* -------------------------------------------------------
   * Init
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    trackImpressions();
    trackDetailView();
    trackAddToCart();
  });
})();
