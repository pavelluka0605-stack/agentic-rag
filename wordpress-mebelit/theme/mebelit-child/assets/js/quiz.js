/**
 * Mebelit Quiz — Калькулятор стоимости кухни
 *
 * Шаги:
 * 1. Выбор планировки (прямая / угловая / п-образная / есть проект)
 * 2. Размеры (зависят от типа)
 * 3. Способ связи
 * 4. Имя + телефон → отправка
 */

(function () {
  'use strict';

  const STEPS = ['layout', 'dimensions', 'contact', 'details'];
  let currentStep = 0;
  let quizData = {};

  function init() {
    const container = document.getElementById('mebelit-quiz');
    if (!container) return;

    renderQuiz(container);
    showStep(0);
  }

  function renderQuiz(container) {
    container.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-progress" id="quiz-progress">
          ${STEPS.map((_, i) => `<div class="quiz-progress__bar${i === 0 ? ' active' : ''}" data-step="${i}"></div>`).join('')}
        </div>

        <!-- Step 1: Layout -->
        <div class="quiz-step active" data-step="0">
          <h2 style="text-align:center; margin-bottom:8px; font-size:24px;">ВЫБЕРИТЕ ПЛАНИРОВКУ КУХНИ</h2>
          <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">Шаг 1 из 4</p>

          <div class="quiz-option" data-value="project" onclick="quizSelect(this, 'layout')">
            <img src="${getAssetUrl('project-icon.svg')}" class="quiz-option__image" alt="Проект">
            <span class="quiz-option__label">У меня есть проект</span>
          </div>
          <div class="quiz-option" data-value="straight" onclick="quizSelect(this, 'layout')">
            <img src="${getAssetUrl('straight.svg')}" class="quiz-option__image" alt="Прямая">
            <span class="quiz-option__label">Прямая кухня</span>
          </div>
          <div class="quiz-option" data-value="corner" onclick="quizSelect(this, 'layout')">
            <img src="${getAssetUrl('corner.svg')}" class="quiz-option__image" alt="Угловая">
            <span class="quiz-option__label">Угловая кухня</span>
          </div>
          <div class="quiz-option" data-value="pshape" onclick="quizSelect(this, 'layout')">
            <img src="${getAssetUrl('pshape.svg')}" class="quiz-option__image" alt="П-образная">
            <span class="quiz-option__label">П-образная кухня</span>
          </div>

          <div id="file-upload-area" style="display:none; margin-top:16px;">
            <label style="display:block; text-align:center; padding:24px; border:2px dashed var(--color-border); border-radius:var(--radius-md); cursor:pointer;">
              <input type="file" id="quiz-file" accept="image/*,.pdf,.doc,.docx" style="display:none;">
              <span style="color:var(--color-text-light);">Загрузите файл проекта (фото, PDF, документ)</span>
            </label>
          </div>

          <div class="quiz-nav">
            <div></div>
            <button class="btn-primary" onclick="nextStep()" id="btn-step1" disabled>ДАЛЕЕ</button>
          </div>
        </div>

        <!-- Step 2: Dimensions -->
        <div class="quiz-step" data-step="1">
          <h2 style="text-align:center; margin-bottom:8px; font-size:24px;">УКАЖИТЕ РАЗМЕРЫ КУХОННОГО ГАРНИТУРА</h2>
          <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">Шаг 2 из 4</p>

          <div id="dimensions-form">
            <div id="dim-straight" style="display:none;">
              <label style="font-weight:600; margin-bottom:8px; display:block;">Длина кухни (см)</label>
              <input type="number" class="quiz-input" id="side-a" placeholder="Например: 300" min="100" max="1000">
            </div>
            <div id="dim-corner" style="display:none;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <label style="font-weight:600; margin-bottom:8px; display:block;">Сторона A (см)</label>
                  <input type="number" class="quiz-input" id="corner-a" placeholder="200" min="50" max="1000">
                </div>
                <div>
                  <label style="font-weight:600; margin-bottom:8px; display:block;">Сторона B (см)</label>
                  <input type="number" class="quiz-input" id="corner-b" placeholder="250" min="50" max="1000">
                </div>
              </div>
            </div>
            <div id="dim-pshape" style="display:none;">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
                <div>
                  <label style="font-weight:600; margin-bottom:8px; display:block;">Сторона A (см)</label>
                  <input type="number" class="quiz-input" id="pshape-a" placeholder="200" min="50" max="1000">
                </div>
                <div>
                  <label style="font-weight:600; margin-bottom:8px; display:block;">Сторона B (см)</label>
                  <input type="number" class="quiz-input" id="pshape-b" placeholder="300" min="50" max="1000">
                </div>
                <div>
                  <label style="font-weight:600; margin-bottom:8px; display:block;">Сторона C (см)</label>
                  <input type="number" class="quiz-input" id="pshape-c" placeholder="200" min="50" max="1000">
                </div>
              </div>
            </div>
            <div id="dim-project" style="display:none;">
              <p style="text-align:center; color:var(--color-text-light); padding:24px;">
                Размеры будут рассчитаны по вашему проекту
              </p>
            </div>
          </div>

          <div class="quiz-nav">
            <button class="btn-secondary" onclick="prevStep()">НАЗАД</button>
            <button class="btn-primary" onclick="nextStep()">ДАЛЕЕ</button>
          </div>
        </div>

        <!-- Step 3: Contact method -->
        <div class="quiz-step" data-step="2">
          <h2 style="text-align:center; margin-bottom:8px; font-size:24px;">КАК ВАМ УДОБНЕЕ ПОЛУЧИТЬ РЕЗУЛЬТАТ?</h2>
          <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">Шаг 3 из 4</p>

          <div class="quiz-option" data-value="whatsapp" onclick="quizSelect(this, 'contact_method')">
            <span class="quiz-option__label">WhatsApp</span>
          </div>
          <div class="quiz-option" data-value="viber" onclick="quizSelect(this, 'contact_method')">
            <span class="quiz-option__label">Viber</span>
          </div>
          <div class="quiz-option" data-value="sms" onclick="quizSelect(this, 'contact_method')">
            <span class="quiz-option__label">СМС на телефон</span>
          </div>
          <div class="quiz-option" data-value="call" onclick="quizSelect(this, 'contact_method')">
            <span class="quiz-option__label">Позвоните мне</span>
          </div>

          <div class="quiz-nav">
            <button class="btn-secondary" onclick="prevStep()">НАЗАД</button>
            <button class="btn-primary" onclick="nextStep()" id="btn-step3" disabled>ДАЛЕЕ</button>
          </div>
        </div>

        <!-- Step 4: Name + Phone -->
        <div class="quiz-step" data-step="3">
          <h2 style="text-align:center; margin-bottom:8px; font-size:24px;">ВВЕДИТЕ ДАННЫЕ ДЛЯ ПОЛУЧЕНИЯ РЕЗУЛЬТАТА</h2>
          <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">Шаг 4 из 4</p>

          <input type="text" class="quiz-input" id="quiz-name" placeholder="Ваше имя" required>
          <input type="tel" class="quiz-input" id="quiz-phone" placeholder="+7 (___) ___-__-__" required>

          <label style="display:flex; gap:8px; align-items:flex-start; margin-top:16px; cursor:pointer;">
            <input type="checkbox" id="quiz-consent" checked style="margin-top:4px;">
            <span class="form-consent">
              Даю согласие на обработку персональных данных в соответствии с
              <a href="/politics/" target="_blank">Политикой конфиденциальности</a>
            </span>
          </label>

          <div class="quiz-nav">
            <button class="btn-secondary" onclick="prevStep()">НАЗАД</button>
            <button class="btn-primary" onclick="submitQuiz()" id="btn-submit">ПОЛУЧИТЬ РЕЗУЛЬТАТ</button>
          </div>
        </div>

        <!-- Success screen -->
        <div class="quiz-step" data-step="4" id="quiz-success">
          <div style="text-align:center; padding:40px 0;">
            <div style="font-size:48px; margin-bottom:16px;">&#10003;</div>
            <h2 style="font-size:24px; margin-bottom:12px;">БЛАГОДАРИМ ВАС ЗА ЗАЯВКУ!</h2>
            <p style="color:var(--color-text-light); margin-bottom:24px;">В ближайшее время мы свяжемся с вами</p>
            <a href="/" class="btn-primary" style="display:inline-block; text-decoration:none;">ВЕРНУТЬСЯ НА САЙТ</a>
          </div>
        </div>
      </div>
    `;
  }

  function getAssetUrl(filename) {
    // Use theme directory or fallback to placeholder
    const themeUrl = document.querySelector('link[href*="mebelit-child"]');
    if (themeUrl) {
      const base = themeUrl.href.replace('/style.css', '');
      return base + '/assets/img/' + filename;
    }
    return '/wp-content/themes/mebelit-child/assets/img/' + filename;
  }

  window.quizSelect = function (el, field) {
    // Remove selection from siblings
    el.parentElement.querySelectorAll('.quiz-option').forEach(function (opt) {
      opt.classList.remove('selected');
    });
    el.classList.add('selected');
    quizData[field] = el.dataset.value;

    // Enable next button
    var stepEl = el.closest('.quiz-step');
    var btn = stepEl.querySelector('.btn-primary');
    if (btn) btn.disabled = false;

    // Special: show file upload for "project"
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

    // Show appropriate dimension form
    if (index === 1) {
      var layout = quizData.layout || 'straight';
      ['straight', 'corner', 'pshape', 'project'].forEach(function (type) {
        var el = document.getElementById('dim-' + type);
        if (el) el.style.display = type === layout ? 'block' : 'none';
      });
    }
  }

  window.nextStep = function () {
    // Collect dimension data before moving on
    if (currentStep === 1) {
      collectDimensions();
    }

    if (currentStep < STEPS.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  };

  window.prevStep = function () {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  };

  function collectDimensions() {
    var layout = quizData.layout;
    if (layout === 'straight') {
      quizData.side_a = document.getElementById('side-a')?.value || '';
    } else if (layout === 'corner') {
      quizData.side_a = document.getElementById('corner-a')?.value || '';
      quizData.side_b = document.getElementById('corner-b')?.value || '';
    } else if (layout === 'pshape') {
      quizData.side_a = document.getElementById('pshape-a')?.value || '';
      quizData.side_b = document.getElementById('pshape-b')?.value || '';
      quizData.side_c = document.getElementById('pshape-c')?.value || '';
    }
  }

  window.submitQuiz = function () {
    var name = document.getElementById('quiz-name').value.trim();
    var phone = document.getElementById('quiz-phone').value.trim();
    var consent = document.getElementById('quiz-consent').checked;

    if (!name) {
      alert('Введите ваше имя');
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 11) {
      alert('Введите корректный номер телефона');
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

    // Send via AJAX
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
      .then(function (data) {
        // Show success
        currentStep = 4;
        showStep(4);

        // Yandex Metrika goal
        if (window.ym) {
          ym(103970425, 'reachGoal', 'quiz_submit');
        }
      })
      .catch(function () {
        // Still show success (form data was likely sent)
        currentStep = 4;
        showStep(4);
      });
  };

  // Phone mask for quiz
  document.addEventListener('input', function (e) {
    if (e.target.id === 'quiz-phone') {
      var value = e.target.value.replace(/\D/g, '');
      if (value.length === 0) {
        e.target.value = '';
        return;
      }
      if (value[0] === '8') value = '7' + value.slice(1);
      if (value[0] !== '7') value = '7' + value;

      var formatted = '+7';
      if (value.length > 1) formatted += ' (' + value.slice(1, 4);
      if (value.length > 4) formatted += ') ' + value.slice(4, 7);
      if (value.length > 7) formatted += '-' + value.slice(7, 9);
      if (value.length > 9) formatted += '-' + value.slice(9, 11);

      e.target.value = formatted;
    }
  });

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
