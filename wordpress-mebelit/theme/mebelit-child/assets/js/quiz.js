/**
 * Mebelit Quiz v2.0 — Калькулятор стоимости кухни
 *
 * Шаги:
 * 1. Выбор планировки (прямая / угловая / п-образная / есть проект)
 * 2. Размеры (зависят от типа: 1-3 стороны)
 * 3. Способ связи (WhatsApp / Viber / SMS / Звонок)
 * 4. Имя + телефон → отправка
 */

(function () {
  'use strict';

  var STEPS = ['layout', 'dimensions', 'contact', 'details'];
  var currentStep = 0;
  var quizData = {};
  var themeUrl = '';

  function init() {
    var container = document.getElementById('mebelit-quiz');
    if (!container) return;

    themeUrl = (window.mebelitQuiz && window.mebelitQuiz.themeUrl) || '/wp-content/themes/mebelit-child';

    renderQuiz(container);
    showStep(0);
  }

  function svgUrl(name) {
    return themeUrl + '/assets/img/' + name;
  }

  function renderQuiz(container) {
    container.innerHTML =
      '<div class="quiz-container">' +
        '<div class="quiz-progress" id="quiz-progress">' +
          STEPS.map(function (_, i) {
            return '<div class="quiz-progress__bar' + (i === 0 ? ' active' : '') + '" data-step="' + i + '"></div>';
          }).join('') +
        '</div>' +

        // Step 1: Layout
        '<div class="quiz-step active" data-step="0">' +
          '<h2 class="quiz-step__title">ВЫБЕРИТЕ ПЛАНИРОВКУ КУХНИ</h2>' +
          '<p class="quiz-step__subtitle">Шаг 1 из 4</p>' +
          '<div class="quiz-options">' +
            '<div class="quiz-option" data-value="project" onclick="quizSelect(this, \'layout\')">' +
              '<img src="' + svgUrl('project-icon.svg') + '" class="quiz-option__image" alt="Проект">' +
              '<span class="quiz-option__label">У меня есть проект</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="straight" onclick="quizSelect(this, \'layout\')">' +
              '<img src="' + svgUrl('straight.svg') + '" class="quiz-option__image" alt="Прямая">' +
              '<span class="quiz-option__label">Прямая кухня</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="corner" onclick="quizSelect(this, \'layout\')">' +
              '<img src="' + svgUrl('corner.svg') + '" class="quiz-option__image" alt="Угловая">' +
              '<span class="quiz-option__label">Угловая кухня</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="pshape" onclick="quizSelect(this, \'layout\')">' +
              '<img src="' + svgUrl('pshape.svg') + '" class="quiz-option__image" alt="П-образная">' +
              '<span class="quiz-option__label">П-образная кухня</span>' +
            '</div>' +
          '</div>' +
          '<div id="file-upload-area" style="display:none; margin-top:16px;">' +
            '<label class="quiz-file-upload">' +
              '<input type="file" id="quiz-file" accept="image/*,.pdf,.doc,.docx" style="display:none;">' +
              '<span>Загрузите файл проекта (фото, PDF, документ)</span>' +
            '</label>' +
          '</div>' +
          '<div class="quiz-nav">' +
            '<div></div>' +
            '<button class="btn-primary" onclick="quizNext()" id="btn-step1" disabled>ДАЛЕЕ</button>' +
          '</div>' +
        '</div>' +

        // Step 2: Dimensions
        '<div class="quiz-step" data-step="1">' +
          '<h2 class="quiz-step__title">УКАЖИТЕ РАЗМЕРЫ КУХОННОГО ГАРНИТУРА</h2>' +
          '<p class="quiz-step__subtitle">Шаг 2 из 4</p>' +
          '<div id="dimensions-form">' +
            '<div id="dim-straight" style="display:none;">' +
              '<label class="quiz-dim-label">Длина кухни (см)</label>' +
              '<input type="number" class="quiz-input" id="side-a" placeholder="Например: 300" min="100" max="1000">' +
            '</div>' +
            '<div id="dim-corner" style="display:none;">' +
              '<div class="quiz-dimensions-grid quiz-dimensions-grid--2">' +
                '<div>' +
                  '<label class="quiz-dim-label">Сторона A (см)</label>' +
                  '<input type="number" class="quiz-input" id="corner-a" placeholder="200" min="50" max="1000">' +
                '</div>' +
                '<div>' +
                  '<label class="quiz-dim-label">Сторона B (см)</label>' +
                  '<input type="number" class="quiz-input" id="corner-b" placeholder="250" min="50" max="1000">' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div id="dim-pshape" style="display:none;">' +
              '<div class="quiz-dimensions-grid quiz-dimensions-grid--3">' +
                '<div>' +
                  '<label class="quiz-dim-label">Сторона A (см)</label>' +
                  '<input type="number" class="quiz-input" id="pshape-a" placeholder="200" min="50" max="1000">' +
                '</div>' +
                '<div>' +
                  '<label class="quiz-dim-label">Сторона B (см)</label>' +
                  '<input type="number" class="quiz-input" id="pshape-b" placeholder="300" min="50" max="1000">' +
                '</div>' +
                '<div>' +
                  '<label class="quiz-dim-label">Сторона C (см)</label>' +
                  '<input type="number" class="quiz-input" id="pshape-c" placeholder="200" min="50" max="1000">' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div id="dim-project" style="display:none;">' +
              '<p style="text-align:center; color:var(--color-text-light); padding:32px;">' +
                'Размеры будут рассчитаны по вашему проекту' +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="quiz-nav">' +
            '<button class="btn-secondary" onclick="quizPrev()">НАЗАД</button>' +
            '<button class="btn-primary" onclick="quizNext()">ДАЛЕЕ</button>' +
          '</div>' +
        '</div>' +

        // Step 3: Contact method
        '<div class="quiz-step" data-step="2">' +
          '<h2 class="quiz-step__title">КАК ВАМ УДОБНЕЕ ПОЛУЧИТЬ РЕЗУЛЬТАТ?</h2>' +
          '<p class="quiz-step__subtitle">Шаг 3 из 4</p>' +
          '<div class="quiz-options">' +
            '<div class="quiz-option" data-value="whatsapp" onclick="quizSelect(this, \'contact_method\')">' +
              '<span class="quiz-option__label">WhatsApp</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="viber" onclick="quizSelect(this, \'contact_method\')">' +
              '<span class="quiz-option__label">Viber</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="sms" onclick="quizSelect(this, \'contact_method\')">' +
              '<span class="quiz-option__label">СМС на телефон</span>' +
            '</div>' +
            '<div class="quiz-option" data-value="call" onclick="quizSelect(this, \'contact_method\')">' +
              '<span class="quiz-option__label">Позвоните мне</span>' +
            '</div>' +
          '</div>' +
          '<div class="quiz-nav">' +
            '<button class="btn-secondary" onclick="quizPrev()">НАЗАД</button>' +
            '<button class="btn-primary" onclick="quizNext()" id="btn-step3" disabled>ДАЛЕЕ</button>' +
          '</div>' +
        '</div>' +

        // Step 4: Name + Phone
        '<div class="quiz-step" data-step="3">' +
          '<h2 class="quiz-step__title">ВВЕДИТЕ ДАННЫЕ ДЛЯ ПОЛУЧЕНИЯ РЕЗУЛЬТАТА</h2>' +
          '<p class="quiz-step__subtitle">Шаг 4 из 4</p>' +
          '<input type="text" class="quiz-input" id="quiz-name" placeholder="Ваше имя" required>' +
          '<input type="tel" class="quiz-input" id="quiz-phone" placeholder="+7 (___) ___-__-__" required>' +
          '<!-- Honeypot -->' +
          '<div style="position:absolute;left:-9999px;" aria-hidden="true">' +
            '<input type="text" id="quiz-honeypot" tabindex="-1" autocomplete="off">' +
          '</div>' +
          '<label style="display:flex; gap:8px; align-items:flex-start; margin-top:16px; cursor:pointer;">' +
            '<input type="checkbox" id="quiz-consent" checked style="margin-top:4px; flex-shrink:0;">' +
            '<span class="form-consent">' +
              'Даю согласие на обработку персональных данных в соответствии с ' +
              '<a href="/politics/" target="_blank">Политикой конфиденциальности</a>' +
            '</span>' +
          '</label>' +
          '<div class="quiz-nav">' +
            '<button class="btn-secondary" onclick="quizPrev()">НАЗАД</button>' +
            '<button class="btn-primary" onclick="quizSubmit()" id="btn-submit">ПОЛУЧИТЬ РЕЗУЛЬТАТ</button>' +
          '</div>' +
        '</div>' +

        // Success screen
        '<div class="quiz-step" data-step="4" id="quiz-success">' +
          '<div class="quiz-success">' +
            '<div class="quiz-success__icon">&#10003;</div>' +
            '<h2 class="quiz-step__title">БЛАГОДАРИМ ВАС ЗА ЗАЯВКУ!</h2>' +
            '<p class="quiz-step__subtitle" style="margin-bottom:32px;">В ближайшее время мы свяжемся с вами и рассчитаем стоимость</p>' +
            '<a href="/" class="btn-primary" style="display:inline-flex; text-decoration:none;">ВЕРНУТЬСЯ НА САЙТ</a>' +
          '</div>' +
        '</div>' +
      '</div>';
  }


  /* ==========================================
     QUIZ INTERACTION
     ========================================== */

  window.quizSelect = function (el, field) {
    // Remove selection from siblings
    var options = el.closest('.quiz-options').querySelectorAll('.quiz-option');
    options.forEach(function (opt) {
      opt.classList.remove('selected');
    });
    el.classList.add('selected');
    quizData[field] = el.dataset.value;

    // Enable next button
    var stepEl = el.closest('.quiz-step');
    var btn = stepEl.querySelector('.btn-primary');
    if (btn) btn.disabled = false;

    // Show file upload for "project"
    if (field === 'layout') {
      var fileArea = document.getElementById('file-upload-area');
      if (fileArea) {
        fileArea.style.display = el.dataset.value === 'project' ? 'block' : 'none';
      }
    }
  };

  function showStep(index) {
    document.querySelectorAll('.quiz-step').forEach(function (step) {
      step.classList.remove('active');
    });
    var target = document.querySelector('.quiz-step[data-step="' + index + '"]');
    if (target) target.classList.add('active');

    // Update progress
    document.querySelectorAll('.quiz-progress__bar').forEach(function (bar, i) {
      bar.classList.toggle('active', i <= index);
    });

    // Show dimension form for selected layout
    if (index === 1) {
      var layout = quizData.layout || 'straight';
      ['straight', 'corner', 'pshape', 'project'].forEach(function (type) {
        var el = document.getElementById('dim-' + type);
        if (el) el.style.display = type === layout ? 'block' : 'none';
      });
    }

    // Scroll to top of quiz
    var quizEl = document.getElementById('mebelit-quiz');
    if (quizEl) {
      quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  window.quizNext = function () {
    if (currentStep === 1) {
      collectDimensions();
    }
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  };

  window.quizPrev = function () {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  };

  function collectDimensions() {
    var layout = quizData.layout;
    if (layout === 'straight') {
      quizData.side_a = (document.getElementById('side-a') || {}).value || '';
    } else if (layout === 'corner') {
      quizData.side_a = (document.getElementById('corner-a') || {}).value || '';
      quizData.side_b = (document.getElementById('corner-b') || {}).value || '';
    } else if (layout === 'pshape') {
      quizData.side_a = (document.getElementById('pshape-a') || {}).value || '';
      quizData.side_b = (document.getElementById('pshape-b') || {}).value || '';
      quizData.side_c = (document.getElementById('pshape-c') || {}).value || '';
    }
  }


  /* ==========================================
     SUBMIT
     ========================================== */

  window.quizSubmit = function () {
    var name = document.getElementById('quiz-name').value.trim();
    var phone = document.getElementById('quiz-phone').value.trim();
    var consent = document.getElementById('quiz-consent').checked;
    var honeypot = document.getElementById('quiz-honeypot');

    // Honeypot check
    if (honeypot && honeypot.value) {
      currentStep = 4;
      showStep(4);
      return;
    }

    if (!name) {
      shakeField(document.getElementById('quiz-name'));
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 11) {
      shakeField(document.getElementById('quiz-phone'));
      return;
    }
    if (!consent) {
      alert('Необходимо согласие на обработку данных');
      return;
    }

    quizData.name = name;
    quizData.phone = phone;
    quizData.page_url = window.location.href;

    var btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'ОТПРАВКА...';

    var formData = new FormData();
    formData.append('action', 'mebelit_quiz_submit');
    formData.append('nonce', (window.mebelitQuiz && window.mebelitQuiz.nonce) || '');

    Object.keys(quizData).forEach(function (key) {
      formData.append(key, quizData[key]);
    });

    // File upload
    var fileInput = document.getElementById('quiz-file');
    if (fileInput && fileInput.files.length > 0) {
      formData.append('project_file', fileInput.files[0]);
    }

    var ajaxUrl = (window.mebelitQuiz && window.mebelitQuiz.ajaxUrl) || '/wp-admin/admin-ajax.php';

    fetch(ajaxUrl, {
      method: 'POST',
      body: formData,
    })
      .then(function (response) { return response.json(); })
      .then(function () {
        currentStep = 4;
        showStep(4);
        // Yandex Metrika goal
        if (window.ym) {
          ym(103970425, 'reachGoal', 'quiz_submit');
        }
      })
      .catch(function () {
        currentStep = 4;
        showStep(4);
      });
  };


  /* ==========================================
     HELPERS
     ========================================== */

  function shakeField(el) {
    if (!el) return;
    el.style.borderColor = 'var(--color-error, #e74c3c)';
    el.focus();
    el.classList.add('error');
    setTimeout(function () {
      el.classList.remove('error');
      el.style.borderColor = '';
    }, 2000);
  }


  /* ==========================================
     INIT
     ========================================== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
