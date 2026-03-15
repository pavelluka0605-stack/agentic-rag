<?php
/**
 * Mebelit — Popup templates
 *
 * Подключается через functions.php → wp_footer
 * Попапы: заявка, дизайнер, скидка новоселам
 */

if (!defined('ABSPATH')) exit;
?>

<!-- Popup: Общая заявка -->
<div class="mebelit-popup-overlay" id="popup-form">
  <div class="mebelit-popup">
    <button class="mebelit-popup__close" aria-label="Закрыть">&times;</button>
    <h3>Оставьте заявку</h3>
    <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">
      Мы свяжемся с вами в течение 15 минут
    </p>
    <form class="mebelit-form" data-form-type="general">
      <input type="text" name="name" placeholder="Ваше имя" required>
      <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" name="website_url" tabindex="-1" autocomplete="off">
      </div>
      <label class="form-consent">
        <input type="checkbox" name="consent" checked required>
        <span>Даю согласие на обработку данных в соответствии с
        <a href="/politics/" target="_blank">Политикой конфиденциальности</a></span>
      </label>
      <button type="submit" class="btn-primary">ОТПРАВИТЬ ЗАЯВКУ</button>
      <div class="mebelit-form__status" style="display:none;"></div>
    </form>
  </div>
</div>

<!-- Popup: Вызов дизайнера -->
<div class="mebelit-popup-overlay" id="popup-designer">
  <div class="mebelit-popup">
    <button class="mebelit-popup__close" aria-label="Закрыть">&times;</button>
    <h3>Вызвать дизайнера бесплатно</h3>
    <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">
      Дизайнер приедет с образцами, сделает замер и 3D-проект
    </p>
    <form class="mebelit-form" data-form-type="designer">
      <input type="text" name="name" placeholder="Ваше имя" required>
      <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" name="website_url" tabindex="-1" autocomplete="off">
      </div>
      <label class="form-consent">
        <input type="checkbox" name="consent" checked required>
        <span>Даю согласие на обработку данных в соответствии с
        <a href="/politics/" target="_blank">Политикой конфиденциальности</a></span>
      </label>
      <button type="submit" class="btn-primary">ПРИГЛАСИТЬ ДИЗАЙНЕРА</button>
      <div class="mebelit-form__status" style="display:none;"></div>
    </form>
  </div>
</div>

<!-- Popup: Скидка новоселам -->
<div class="mebelit-popup-overlay" id="popup-discount">
  <div class="mebelit-popup">
    <button class="mebelit-popup__close" aria-label="Закрыть">&times;</button>
    <h3>Скидка новоселам</h3>
    <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">
      Оставьте заявку и получите специальные условия для новосёлов
    </p>
    <form class="mebelit-form" data-form-type="discount">
      <input type="text" name="name" placeholder="Ваше имя" required>
      <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" name="website_url" tabindex="-1" autocomplete="off">
      </div>
      <label class="form-consent">
        <input type="checkbox" name="consent" checked required>
        <span>Даю согласие на обработку данных в соответствии с
        <a href="/politics/" target="_blank">Политикой конфиденциальности</a></span>
      </label>
      <button type="submit" class="btn-primary">ПОЛУЧИТЬ СКИДКУ</button>
      <div class="mebelit-form__status" style="display:none;"></div>
    </form>
  </div>
</div>

<!-- Popup: Обратный звонок -->
<div class="mebelit-popup-overlay" id="popup-callback">
  <div class="mebelit-popup">
    <button class="mebelit-popup__close" aria-label="Закрыть">&times;</button>
    <h3>Обратный звонок</h3>
    <p style="text-align:center; color:var(--color-text-light); margin-bottom:24px;">
      Оставьте номер и мы перезвоним вам
    </p>
    <form class="mebelit-form" data-form-type="callback">
      <input type="text" name="name" placeholder="Ваше имя">
      <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" name="website_url" tabindex="-1" autocomplete="off">
      </div>
      <label class="form-consent">
        <input type="checkbox" name="consent" checked required>
        <span>Даю согласие на обработку данных в соответствии с
        <a href="/politics/" target="_blank">Политикой конфиденциальности</a></span>
      </label>
      <button type="submit" class="btn-primary">ПЕРЕЗВОНИТЕ МНЕ</button>
      <div class="mebelit-form__status" style="display:none;"></div>
    </form>
  </div>
</div>
