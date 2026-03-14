/**
 * Mebelit — main.js
 * Header scroll, phone mask, smooth scroll
 */

document.addEventListener('DOMContentLoaded', function () {
  // Header scroll effect
  const header = document.querySelector('.site-header, header.elementor-location-header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', function () {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // Phone mask for all tel inputs
  document.querySelectorAll('input[type="tel"]').forEach(function (input) {
    input.addEventListener('input', function (e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length === 0) {
        e.target.value = '';
        return;
      }
      if (value[0] === '8') value = '7' + value.slice(1);
      if (value[0] !== '7') value = '7' + value;

      let formatted = '+7';
      if (value.length > 1) formatted += ' (' + value.slice(1, 4);
      if (value.length > 4) formatted += ') ' + value.slice(4, 7);
      if (value.length > 7) formatted += '-' + value.slice(7, 9);
      if (value.length > 9) formatted += '-' + value.slice(9, 11);

      e.target.value = formatted;
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
