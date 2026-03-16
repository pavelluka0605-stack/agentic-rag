/**
 * Kuhni Rema - Quiz Calculator
 * 4-step self-hosted quiz: layout, dimensions, contact method, contact form.
 * Vanilla JS. Submits via same AJAX endpoint as forms.js.
 */
(function () {
  'use strict';

  var TOTAL_STEPS = 4;

  /* -------------------------------------------------------
   * Quiz Class
   * ----------------------------------------------------- */
  function Quiz(container) {
    this.container = container;
    this.currentStep = 1;
    this.data = {
      layout: null,
      width: null,
      depth: null,
      height: null,
      contact_method: null,
      name: null,
      phone: null,
      file: null,
    };

    this.steps = container.querySelectorAll('.quiz__step');
    this.progressBar = container.querySelector('.quiz__progress-fill');
    this.progressText = container.querySelector('.quiz__progress-text');
    this.prevBtn = container.querySelector('.quiz__prev');
    this.nextBtn = container.querySelector('.quiz__next');

    this.init();
  }

  Quiz.prototype.init = function () {
    var self = this;

    // Navigation buttons
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.prev();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (self.currentStep === TOTAL_STEPS) {
          self.submit();
        } else {
          self.next();
        }
      });
    }

    // Layout option selection (step 1)
    this.initLayoutOptions();

    // Contact method selection (step 3)
    this.initContactMethodOptions();

    // Show first step
    this.showStep(1);
  };

  /* -------------------------------------------------------
   * Layout Options (Step 1)
   * ----------------------------------------------------- */
  Quiz.prototype.initLayoutOptions = function () {
    var self = this;
    var options = this.container.querySelectorAll(
      '.quiz__step[data-step="1"] .quiz__option'
    );

    for (var i = 0; i < options.length; i++) {
      options[i].addEventListener('click', function () {
        // Deselect all
        for (var j = 0; j < options.length; j++) {
          options[j].classList.remove('quiz__option--selected');
          var radio = options[j].querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        }
        // Select clicked
        this.classList.add('quiz__option--selected');
        var radio = this.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          self.data.layout = radio.value;
        }
      });
    }
  };

  /* -------------------------------------------------------
   * Contact Method Options (Step 3)
   * ----------------------------------------------------- */
  Quiz.prototype.initContactMethodOptions = function () {
    var self = this;
    var options = this.container.querySelectorAll(
      '.quiz__step[data-step="3"] .quiz__option'
    );

    for (var i = 0; i < options.length; i++) {
      options[i].addEventListener('click', function () {
        for (var j = 0; j < options.length; j++) {
          options[j].classList.remove('quiz__option--selected');
          var radio = options[j].querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        }
        this.classList.add('quiz__option--selected');
        var radio = this.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          self.data.contact_method = radio.value;
        }
      });
    }
  };

  /* -------------------------------------------------------
   * Step Navigation
   * ----------------------------------------------------- */
  Quiz.prototype.showStep = function (stepNum) {
    for (var i = 0; i < this.steps.length; i++) {
      var step = this.steps[i];
      var num = parseInt(step.getAttribute('data-step'), 10);

      if (num === stepNum) {
        step.classList.add('quiz__step--active');
        step.classList.remove('quiz__step--exit');
      } else if (num === this.currentStep && num !== stepNum) {
        step.classList.remove('quiz__step--active');
        step.classList.add('quiz__step--exit');
      } else {
        step.classList.remove('quiz__step--active');
        step.classList.remove('quiz__step--exit');
      }
    }

    this.currentStep = stepNum;
    this.updateProgress();
    this.updateButtons();

    // Fire step change event for analytics
    document.dispatchEvent(
      new CustomEvent('kuhniRema:quizStep', {
        detail: { step: stepNum },
      })
    );
  };

  Quiz.prototype.updateProgress = function () {
    var percent = (this.currentStep / TOTAL_STEPS) * 100;

    if (this.progressBar) {
      this.progressBar.style.width = percent + '%';
    }
    if (this.progressText) {
      this.progressText.textContent =
        'Шаг ' + this.currentStep + ' из ' + TOTAL_STEPS;
    }
  };

  Quiz.prototype.updateButtons = function () {
    if (this.prevBtn) {
      if (this.currentStep === 1) {
        this.prevBtn.style.display = 'none';
      } else {
        this.prevBtn.style.display = '';
      }
    }

    if (this.nextBtn) {
      if (this.currentStep === TOTAL_STEPS) {
        this.nextBtn.textContent = 'Отправить';
        this.nextBtn.classList.add('quiz__next--submit');
      } else {
        this.nextBtn.textContent = 'Далее';
        this.nextBtn.classList.remove('quiz__next--submit');
      }
    }
  };

  Quiz.prototype.next = function () {
    if (!this.validateStep(this.currentStep)) return;

    this.collectStepData(this.currentStep);

    if (this.currentStep < TOTAL_STEPS) {
      this.showStep(this.currentStep + 1);
    }
  };

  Quiz.prototype.prev = function () {
    if (this.currentStep > 1) {
      this.showStep(this.currentStep - 1);
    }
  };

  /* -------------------------------------------------------
   * Validation
   * ----------------------------------------------------- */
  Quiz.prototype.validateStep = function (stepNum) {
    this.clearStepErrors(stepNum);

    switch (stepNum) {
      case 1:
        if (!this.data.layout) {
          var selected = this.container.querySelector(
            '.quiz__step[data-step="1"] .quiz__option--selected'
          );
          if (!selected) {
            this.showStepError(1, 'Пожалуйста, выберите тип планировки кухни.');
            return false;
          }
        }
        return true;

      case 2:
        var widthInput = this.container.querySelector('input[name="quiz_width"]');
        if (widthInput) {
          var widthVal = parseFloat(widthInput.value);
          if (!widthVal || widthVal <= 0) {
            this.showStepError(2, 'Пожалуйста, укажите ширину кухни.');
            widthInput.focus();
            return false;
          }
        }
        return true;

      case 3:
        var selected = this.container.querySelector(
          '.quiz__step[data-step="3"] .quiz__option--selected'
        );
        if (!selected && !this.data.contact_method) {
          this.showStepError(3, 'Пожалуйста, выберите способ связи.');
          return false;
        }
        return true;

      case 4:
        var phoneInput = this.container.querySelector('input[name="quiz_phone"]');
        if (phoneInput) {
          var phoneVal = phoneInput.value.trim();
          if (!phoneVal) {
            this.showStepError(4, 'Пожалуйста, укажите номер телефона.');
            phoneInput.focus();
            return false;
          }
          var forms = window.kuhniRemaForms;
          if (forms && !forms.isValidRussianPhone(phoneVal)) {
            this.showStepError(
              4,
              'Пожалуйста, введите корректный российский номер телефона.'
            );
            phoneInput.focus();
            return false;
          }
        }
        return true;

      default:
        return true;
    }
  };

  Quiz.prototype.showStepError = function (stepNum, message) {
    var step = this.container.querySelector(
      '.quiz__step[data-step="' + stepNum + '"]'
    );
    if (!step) return;

    var errorEl = document.createElement('div');
    errorEl.className = 'quiz__error';
    errorEl.textContent = message;
    errorEl.style.color = '#d32f2f';
    errorEl.style.marginTop = '12px';
    errorEl.style.fontSize = '14px';
    step.appendChild(errorEl);
  };

  Quiz.prototype.clearStepErrors = function (stepNum) {
    var step = this.container.querySelector(
      '.quiz__step[data-step="' + stepNum + '"]'
    );
    if (!step) return;

    var errors = step.querySelectorAll('.quiz__error');
    for (var i = 0; i < errors.length; i++) {
      errors[i].parentNode.removeChild(errors[i]);
    }
  };

  /* -------------------------------------------------------
   * Data Collection
   * ----------------------------------------------------- */
  Quiz.prototype.collectStepData = function (stepNum) {
    switch (stepNum) {
      case 1:
        var selected = this.container.querySelector(
          '.quiz__step[data-step="1"] .quiz__option--selected input[type="radio"]'
        );
        if (selected) this.data.layout = selected.value;
        break;

      case 2:
        var width = this.container.querySelector('input[name="quiz_width"]');
        var depth = this.container.querySelector('input[name="quiz_depth"]');
        var height = this.container.querySelector('input[name="quiz_height"]');
        if (width) this.data.width = width.value;
        if (depth) this.data.depth = depth.value;
        if (height) this.data.height = height.value;
        break;

      case 3:
        var method = this.container.querySelector(
          '.quiz__step[data-step="3"] .quiz__option--selected input[type="radio"]'
        );
        if (method) this.data.contact_method = method.value;
        break;

      case 4:
        var name = this.container.querySelector('input[name="quiz_name"]');
        var phone = this.container.querySelector('input[name="quiz_phone"]');
        var fileInput = this.container.querySelector('input[name="quiz_file"]');
        if (name) this.data.name = name.value;
        if (phone) this.data.phone = phone.value;
        if (fileInput && fileInput.files.length) this.data.file = fileInput.files[0];
        break;
    }
  };

  /* -------------------------------------------------------
   * Submit
   * ----------------------------------------------------- */
  Quiz.prototype.submit = function () {
    if (!this.validateStep(TOTAL_STEPS)) return;

    this.collectStepData(TOTAL_STEPS);

    var kuhniRema = window.kuhniRema;
    if (!kuhniRema || !kuhniRema.ajaxUrl) {
      this.showStepError(TOTAL_STEPS, 'Ошибка конфигурации. Обновите страницу.');
      return;
    }

    var self = this;

    // Loading state
    if (this.nextBtn) {
      this.nextBtn.textContent = 'Отправка...';
      this.nextBtn.disabled = true;
      this.nextBtn.classList.add('btn--loading');
    }

    // Build FormData
    var formData = new FormData();
    formData.append('action', 'kuhni_rema_submit_form');
    formData.append('form_type', 'quiz');

    if (kuhniRema.nonce) {
      formData.append('nonce', kuhniRema.nonce);
    }

    // Quiz data
    formData.append('layout', this.data.layout || '');
    formData.append('width', this.data.width || '');
    formData.append('depth', this.data.depth || '');
    formData.append('height', this.data.height || '');
    formData.append('contact_method', this.data.contact_method || '');
    formData.append('name', this.data.name || '');
    formData.append('phone', this.data.phone || '');

    if (this.data.file) {
      formData.append('file', this.data.file);
    }

    // UTM params
    var forms = window.kuhniRemaForms;
    if (forms) {
      var utmParams = forms.getUTMParams();
      for (var key in utmParams) {
        if (utmParams.hasOwnProperty(key)) {
          formData.append(key, utmParams[key]);
        }
      }
    }

    formData.append('page_url', window.location.href);

    // AJAX
    var xhr = new XMLHttpRequest();
    xhr.open('POST', kuhniRema.ajaxUrl, true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        var response;
        try {
          response = JSON.parse(xhr.responseText);
        } catch (err) {
          self.showStepError(TOTAL_STEPS, 'Ошибка сервера. Попробуйте ещё раз.');
          self.resetSubmitBtn();
          return;
        }

        if (response.success) {
          // Fire analytics events
          document.dispatchEvent(
            new CustomEvent('kuhniRema:formSuccess', {
              detail: { form_type: 'quiz' },
            })
          );
          document.dispatchEvent(new CustomEvent('kuhniRema:quizComplete'));

          // Redirect
          if (kuhniRema.thanksUrl) {
            window.location.href = kuhniRema.thanksUrl;
          }
        } else {
          var msg =
            response.data && response.data.message
              ? response.data.message
              : 'Произошла ошибка. Попробуйте ещё раз.';
          self.showStepError(TOTAL_STEPS, msg);
          self.resetSubmitBtn();
        }
      } else {
        self.showStepError(
          TOTAL_STEPS,
          'Ошибка сети. Проверьте соединение и попробуйте ещё раз.'
        );
        self.resetSubmitBtn();
      }
    };

    xhr.send(formData);
  };

  Quiz.prototype.resetSubmitBtn = function () {
    if (this.nextBtn) {
      this.nextBtn.textContent = 'Отправить';
      this.nextBtn.disabled = false;
      this.nextBtn.classList.remove('btn--loading');
    }
  };

  /* -------------------------------------------------------
   * Init
   * ----------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var quizContainers = document.querySelectorAll('.quiz');
    for (var i = 0; i < quizContainers.length; i++) {
      new Quiz(quizContainers[i]);
    }
  });
})();
