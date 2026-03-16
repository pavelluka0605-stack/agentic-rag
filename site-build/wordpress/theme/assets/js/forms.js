/**
 * Kuhni Rema - Forms JS
 * AJAX form handler with phone mask, validation, UTM tracking, file preview.
 * Expects wp_localize_script object: kuhniRema { ajaxUrl, nonce, siteUrl, thanksUrl }
 */
(function () {
  'use strict';

  /* -------------------------------------------------------
   * Helpers
   * ----------------------------------------------------- */
  function getUTMParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;

    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      var key = decodeURIComponent(kv[0]);
      if (key.indexOf('utm_') === 0) {
        params[key] = kv[1] ? decodeURIComponent(kv[1]) : '';
      }
    }
    return params;
  }

  function showError(form, message) {
    var existing = form.querySelector('.form-error');
    if (existing) {
      existing.textContent = message;
      existing.style.display = '';
      return;
    }

    var errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    errorEl.textContent = message;
    errorEl.style.color = '#d32f2f';
    errorEl.style.marginTop = '12px';
    errorEl.style.fontSize = '14px';
    form.appendChild(errorEl);
  }

  function hideError(form) {
    var existing = form.querySelector('.form-error');
    if (existing) {
      existing.style.display = 'none';
    }
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.setAttribute('data-original-text', btn.textContent);
      btn.textContent = 'Отправка...';
      btn.disabled = true;
      btn.classList.add('btn--loading');
    } else {
      var original = btn.getAttribute('data-original-text');
      if (original) btn.textContent = original;
      btn.disabled = false;
      btn.classList.remove('btn--loading');
    }
  }

  /* -------------------------------------------------------
   * Phone Validation
   * ----------------------------------------------------- */
  function isValidRussianPhone(value) {
    // Strip all non-digit characters
    var digits = value.replace(/\D/g, '');
    // Accept 10 digits (without country code) or 11 digits starting with 7 or 8
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
      return true;
    }
    if (digits.length === 10) {
      return true;
    }
    return false;
  }

  /* -------------------------------------------------------
   * Phone Input Mask: +7 (___) ___-__-__
   * ----------------------------------------------------- */
  function initPhoneMask(input) {
    input.addEventListener('input', function () {
      var value = input.value.replace(/\D/g, '');

      // If starts with 8, treat as 7
      if (value.length > 0 && value[0] === '8') {
        value = '7' + value.substring(1);
      }

      // If starts without 7, prepend 7
      if (value.length > 0 && value[0] !== '7') {
        value = '7' + value;
      }

      // Remove doubled country code (e.g. pasting "+7 7..." or "77...")
      if (value.length > 10 && value[0] === '7' && value[1] === '7') {
        value = value.substring(1);
      }

      var formatted = '';

      if (value.length > 0) {
        formatted = '+7';
      }
      if (value.length > 1) {
        formatted += ' (' + value.substring(1, 4);
      }
      if (value.length >= 4) {
        formatted += ') ';
      }
      if (value.length > 4) {
        formatted += value.substring(4, 7);
      }
      if (value.length > 7) {
        formatted += '-' + value.substring(7, 9);
      }
      if (value.length > 9) {
        formatted += '-' + value.substring(9, 11);
      }

      input.value = formatted;
    });

    // Set initial +7 on focus if empty
    input.addEventListener('focus', function () {
      if (!input.value) {
        input.value = '+7';
      }
    });

    input.addEventListener('keydown', function (e) {
      // Allow backspace to clear fully
      if (e.key === 'Backspace' && input.value === '+7') {
        e.preventDefault();
        input.value = '';
      }
    });
  }

  /* -------------------------------------------------------
   * File Upload Preview (competitor project forms)
   * ----------------------------------------------------- */
  function initFilePreview(form) {
    var formType = form.getAttribute('data-form-type');
    if (formType !== 'competitor_project') return;

    var fileInput = form.querySelector('input[type="file"]');
    if (!fileInput) return;

    var previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview';
    fileInput.parentNode.insertBefore(previewContainer, fileInput.nextSibling);

    fileInput.addEventListener('change', function () {
      previewContainer.innerHTML = '';

      var files = fileInput.files;
      if (!files || !files.length) return;

      var maxSize = 10 * 1024 * 1024; // 10MB
      for (var j = 0; j < files.length; j++) {
        if (files[j].size > maxSize) {
          alert('Файл "' + files[j].name + '" превышает 10 МБ. Пожалуйста, выберите файл меньшего размера.');
          fileInput.value = '';
          return;
        }
      }

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var item = document.createElement('div');
        item.className = 'file-preview__item';

        if (file.type && file.type.indexOf('image/') === 0) {
          var img = document.createElement('img');
          img.className = 'file-preview__image';
          img.style.maxWidth = '120px';
          img.style.maxHeight = '120px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '6px';
          img.style.marginTop = '8px';

          (function (imgEl) {
            var reader = new FileReader();
            reader.onload = function (e) {
              imgEl.src = e.target.result;
            };
            reader.readAsDataURL(file);
          })(img);

          item.appendChild(img);
        }

        var name = document.createElement('span');
        name.className = 'file-preview__name';
        name.textContent = file.name;
        name.style.display = 'block';
        name.style.fontSize = '13px';
        name.style.marginTop = '4px';
        name.style.color = '#666';
        item.appendChild(name);

        previewContainer.appendChild(item);
      }
    });
  }

  /* -------------------------------------------------------
   * Form Submit Handler
   * ----------------------------------------------------- */
  function handleSubmit(e) {
    e.preventDefault();

    var form = e.target;

    // Double-submit prevention
    if (form.dataset.submitting === 'true') return;

    var kuhniRema = window.kuhniRema;

    if (!kuhniRema || !kuhniRema.ajaxUrl) {
      showError(form, 'Ошибка конфигурации. Пожалуйста, обновите страницу.');
      return;
    }

    hideError(form);

    // Validate phone
    var phoneInput = form.querySelector('input[name="phone"], input[type="tel"]');
    if (phoneInput) {
      var phoneValue = phoneInput.value.trim();
      if (!phoneValue) {
        showError(form, 'Пожалуйста, укажите номер телефона.');
        phoneInput.focus();
        return;
      }
      if (!isValidRussianPhone(phoneValue)) {
        showError(form, 'Пожалуйста, введите корректный российский номер телефона.');
        phoneInput.focus();
        return;
      }
    }

    // Loading state
    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) setLoading(submitBtn, true);

    // Collect form data
    var formData = new FormData(form);
    formData.append('action', 'kuhni_rema_submit_form');

    if (kuhniRema.nonce) {
      formData.append('nonce', kuhniRema.nonce);
    }

    // Add form type
    var formType = form.getAttribute('data-form-type') || 'contact';
    formData.append('form_type', formType);

    // Add UTM params
    var utmParams = getUTMParams();
    for (var key in utmParams) {
      if (utmParams.hasOwnProperty(key)) {
        formData.append(key, utmParams[key]);
      }
    }

    // Add current page URL
    formData.append('page_url', window.location.href);

    // AJAX request
    var xhr = new XMLHttpRequest();
    xhr.open('POST', kuhniRema.ajaxUrl, true);
    xhr.timeout = 15000;

    xhr.ontimeout = function () {
      form.dataset.submitting = 'false';
      if (submitBtn) setLoading(submitBtn, false);
      showError(form, 'Превышено время ожидания. Попробуйте ещё раз.');
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      form.dataset.submitting = 'false';
      if (submitBtn) setLoading(submitBtn, false);

      if (xhr.status >= 200 && xhr.status < 300) {
        var response;
        try {
          response = JSON.parse(xhr.responseText);
        } catch (err) {
          showError(form, 'Ошибка сервера. Попробуйте ещё раз.');
          return;
        }

        if (response.success) {
          // Fire analytics event
          document.dispatchEvent(
            new CustomEvent('kuhniRema:formSuccess', {
              detail: { form_type: formType },
            })
          );

          // Redirect to thank you page
          if (kuhniRema.thanksUrl) {
            window.location.href = kuhniRema.thanksUrl;
          }
        } else {
          var msg =
            response.data && response.data.message
              ? response.data.message
              : 'Произошла ошибка. Попробуйте ещё раз.';
          showError(form, msg);
        }
      } else {
        showError(form, 'Ошибка сети. Проверьте соединение и попробуйте ещё раз.');
      }
    };

    form.dataset.submitting = 'true';
    xhr.send(formData);
  }

  /* -------------------------------------------------------
   * Init
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    // Attach submit handlers
    var forms = document.querySelectorAll('[data-kuhni-form]');
    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener('submit', handleSubmit);
      initFilePreview(forms[i]);
    }

    // Init phone masks
    var phoneInputs = document.querySelectorAll(
      'input[name="phone"], input[type="tel"]'
    );
    for (var j = 0; j < phoneInputs.length; j++) {
      initPhoneMask(phoneInputs[j]);
    }
  });

  // Expose for use by quiz.js
  window.kuhniRemaForms = {
    handleSubmit: handleSubmit,
    isValidRussianPhone: isValidRussianPhone,
    getUTMParams: getUTMParams,
  };
})();
