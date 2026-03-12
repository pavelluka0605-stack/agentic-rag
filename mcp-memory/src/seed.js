import { initDatabase } from './database.js';
import { MemoryOperations } from './operations.js';

const db = initDatabase(process.env.MEMORY_DB_PATH);
const ops = new MemoryOperations(db);

const seeds = [
  {
    type: 'lesson',
    title: 'Bitrix24 rate limit 2 req/sec',
    content: 'Bitrix24 REST API ограничивает запросы до 2 в секунду. При превышении возвращает ошибку. Решение: всегда добавлять Wait node (500ms) между последовательными вызовами в n8n. Для массовых операций использовать batch endpoint crm.deal.list с пагинацией через параметр start (инкремент 50).',
    tags: 'bitrix24, api, rate-limit, n8n',
    project: 'vk-commerce',
    importance: 9,
  },
  {
    type: 'lesson',
    title: 'CDEK токен живёт 3600 сек',
    content: 'OAuth токен CDEK API v2 действителен 1 час (3600 секунд). Нужно кешировать токен и обновлять по истечении. Не запрашивать новый токен на каждый запрос — это лишняя нагрузка и задержка. В n8n использовать Function node для проверки TTL.',
    tags: 'cdek, api, auth, token',
    project: 'vk-commerce',
    importance: 8,
  },
  {
    type: 'error_fix',
    title: 'n8n Code Node: $env вместо process.env',
    content: 'В Code Node n8n нельзя использовать process.env — sandbox блокирует доступ к process. Для доступа к переменным окружения использовать $env.MY_VAR. Переменные задаются в docker-compose.yml (environment секция) или .env файле n8n.',
    tags: 'n8n, environment, docker, sandbox',
    project: 'vk-commerce',
    importance: 8,
  },
  {
    type: 'lesson',
    title: 'T-Bank: проверка подписи webhook обязательна',
    content: 'Все webhook\'ы от T-Bank (Tinkoff) Acquiring API ОБЯЗАТЕЛЬНО проверять по подписи. Без проверки — риск принять фейковый платёж. Подпись считается через SHA-256 от конкатенации значений полей (отсортированных по ключу) + пароля терминала. Поле Token в webhook — это и есть подпись для проверки.',
    tags: 'tbank, webhook, security, payments',
    project: 'vk-commerce',
    importance: 10,
  },
  {
    type: 'decision',
    title: 'CDEK как основной логистический партнёр',
    content: 'Выбран CDEK как основной сервис доставки. Причины: хороший REST API v2, широкая сеть ПВЗ в Сибири (критично для Красноярска), скидка 40%. Почта России — fallback для отдалённых населённых пунктов без ПВЗ CDEK. Boxberry отклонён: слабый API, меньше точек в регионе.',
    tags: 'cdek, логистика, архитектура, доставка',
    project: 'vk-commerce',
    importance: 8,
  },
  {
    type: 'decision',
    title: 'n8n self-hosted на Docker вместо облака',
    content: 'Выбран self-hosted n8n на Docker (Frankfurt VPS fra-1-vm-ckr7). Причины: полный контроль, нет ограничений на executions, можно ставить любые ноды, доступ к файловой системе, стоимость только за VPS. Против облачного n8n: дорого при масштабировании (>2500 executions/month), ограничения по workflow, нет доступа к серверу.',
    tags: 'n8n, docker, архитектура, infrastructure, vps',
    project: 'vk-commerce',
    importance: 7,
  },
  {
    type: 'pattern',
    title: 'Retry с exponential backoff для внешних API',
    content: 'Паттерн для надёжных вызовов внешних API: 1) Первая попытка. 2) При ошибке 429/500/502/503 — ждать 1 сек. 3) Вторая попытка — ждать 2 сек. 4) Третья попытка — ждать 4 сек. 5) После 3 неудач — логировать и уведомить. В n8n: использовать Error Trigger + Wait + IF node. В JS: рекурсивная функция с delay * 2.',
    tags: 'api, retry, error-handling, pattern',
    project: 'default',
    importance: 7,
  },
  {
    type: 'pattern',
    title: 'Bitrix24 пагинация — цикл с start+50',
    content: 'Для получения всех записей из Bitrix24 (crm.deal.list, crm.contact.list и др.): 1) Первый запрос с start=0. 2) Из ответа взять total и next. 3) Если next есть — повторить с start=next. 4) Собрать все result массивы. 5) Обязательно Wait 500ms между запросами (rate limit). В n8n: SplitInBatches + HTTP Request + IF (есть ли next).',
    tags: 'bitrix24, api, pagination, n8n',
    project: 'vk-commerce',
    importance: 6,
  },
];

console.log('🌱 Загрузка начальных данных...\n');

let count = 0;
for (const seed of seeds) {
  const result = ops.saveMemory(seed);
  console.log(result);
  console.log('');
  count++;
}

console.log(`✅ Загружено ${count} записей`);
db.close();
