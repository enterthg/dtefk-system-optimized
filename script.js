const DEFAULT_SCHEDULE = [
  { lesson: '1', start: '08:30', end: '09:50' },
  { lesson: '2', start: '10:00', end: '11:20' },
  { lesson: '3', start: '11:30', end: '12:50' },
  { lesson: '4', start: '13:00', end: '14:20' },
  { lesson: '5', start: '14:30', end: '15:50' }
];

const DEFAULT_SIZES = {
  logoHeight: 80,
  weatherFont: 50,
  alertFont: 26,
  clockFont: 100,
  dateFont: 16,
  lessonFont: 32,
  replacesFont: 13
};

const DEFAULT_BG = {
  type: 'image',
  imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
  slideshowUrls: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop'
  ].join('\n'),
  slideshowInterval: 10,
  iframeUrl: 'https://threejs.org/examples/webgl_geometry_cube.html'
};

const WEATHER_COORDS = { lat: 48.45, lon: 34.98 };
const API_TIMEOUT = 8000;
const REPLACES_URL = 'https://dtrek.dp.ua/stud/class-replaces';
const REPLACES_JSON_URL = 'https://raw.githubusercontent.com/enterthg/dtefk-system-optimized/main/replaces.json';
const ALERTS_API = '/api/alerts';
const ALERTS_INTERVAL = 10000;

let schedule = [];
let allReplaces = [];
let replacesError = null;
let currentPageIndex = 0;
let allDatesWithReplaces = [];
let weatherData = null;
let currentAlertStatus = null;
let replacesUpdatedTime = null;
let slideshowTimer = null;
let slideshowIndex = 0;
let activeBgLayer = 1;
let replacesPageTimer = null;

function init() {
  loadDisplaySizes();
  loadBgSettings();
  loadSchedule();
  renderInputs();
  updateClock();
  loadWeather();
  fetchReplaces();
  checkAirAlerts();

  setInterval(updateClock, 1000);
  setInterval(fetchReplaces, 300000);
  setInterval(loadWeather, 1800000);
  setInterval(checkAirAlerts, ALERTS_INTERVAL);

  console.log('✅ Система запущена');
}

function updateSize(key, value, unit = 'px') {
  const mapping = {
    logoHeight: '--logo-height',
    weatherFont: '--weather-font-size',
    alertFont: '--alert-font-size',
    clockFont: '--clock-font-size',
    dateFont: '--date-font-size',
    lessonFont: '--lesson-font-size',
    replacesFont: '--replaces-font-size'
  };

  const root = document.documentElement;
  const cssName = mapping[key];
  if (cssName) {
    root.style.setProperty(cssName, `${value}${unit}`);
  }

  const label = document.getElementById(`val_${key}`);
  if (label) label.innerText = `${value}${unit}`;

  const saved = JSON.parse(localStorage.getItem('dtefk_sizes') || '{}');
  saved[key] = Number(value);
  localStorage.setItem('dtefk_sizes', JSON.stringify(saved));
}

function loadDisplaySizes() {
  const saved = JSON.parse(localStorage.getItem('dtefk_sizes') || '{}');
  const values = { ...DEFAULT_SIZES, ...saved };

  Object.entries(values).forEach(([key, value]) => {
    const input = document.getElementById(`size_${key}`);
    if (input) input.value = value;
    updateSize(key, Number(value), 'px');
  });
}

function resetDisplaySizes() {
  localStorage.removeItem('dtefk_sizes');
  localStorage.removeItem('dtefk_bg');
  loadDisplaySizes();
  loadBgSettings();
  alert('✅ Розміри і фон скинуті до стандартних');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');

  const button = Array.from(document.querySelectorAll('.tab-btn')).find(el => el.getAttribute('onclick') && el.getAttribute('onclick').includes(tabId));
  if (button) button.classList.add('active');
}

function handleBgTypeChange(type) {
  const fields = document.querySelectorAll('.bg-field');
  fields.forEach(el => {
    const shouldShow = el.classList.contains(`bg-field-${type}`);
    el.style.display = shouldShow ? 'flex' : 'none';
  });

  const sel = document.getElementById('bgType');
  if (sel) sel.value = type;

  saveBgSettings();
}

function saveBgSettings() {
  const type = document.getElementById('bgType')?.value || DEFAULT_BG.type;
  const imageUrl = document.getElementById('bgImageUrl')?.value.trim() || DEFAULT_BG.imageUrl;
  const slideshowUrls = document.getElementById('bgSlideshowUrls')?.value || DEFAULT_BG.slideshowUrls;
  const slideshowInterval = Number(document.getElementById('bgInterval')?.value || DEFAULT_BG.slideshowInterval);
  const iframeUrl = document.getElementById('bgIframeUrl')?.value.trim() || DEFAULT_BG.iframeUrl;

  const config = { type, imageUrl, slideshowUrls, slideshowInterval, iframeUrl };
  localStorage.setItem('dtefk_bg', JSON.stringify(config));
  applyBgSettings(config);
}

function loadBgSettings() {
  const saved = JSON.parse(localStorage.getItem('dtefk_bg') || '{}');
  const config = { ...DEFAULT_BG, ...saved };

  const bgType = document.getElementById('bgType');
  const bgImageUrl = document.getElementById('bgImageUrl');
  const bgSlideshowUrls = document.getElementById('bgSlideshowUrls');
  const bgInterval = document.getElementById('bgInterval');
  const bgIframeUrl = document.getElementById('bgIframeUrl');

  if (bgType) bgType.value = config.type;
  if (bgImageUrl) bgImageUrl.value = config.imageUrl;
  if (bgSlideshowUrls) bgSlideshowUrls.value = config.slideshowUrls;
  if (bgInterval) {
    bgInterval.value = config.slideshowInterval;
    const val = document.getElementById('val_bgInterval');
    if (val) val.innerText = `${config.slideshowInterval}s`;
  }
  if (bgIframeUrl) bgIframeUrl.value = config.iframeUrl;

  handleBgTypeChange(config.type);
  applyBgSettings(config);
}

function applyBgSettings(config) {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
  }

  const layer1 = document.getElementById('bgLayer1');
  const layer2 = document.getElementById('bgLayer2');
  const iframe = document.getElementById('bgIframe');
  if (!layer1 || !layer2 || !iframe) return;

  if (config.type === 'iframe') {
    layer1.classList.remove('active');
    layer2.classList.remove('active');
    iframe.style.display = 'block';
    iframe.src = config.iframeUrl || 'about:blank';
    return;
  }

  iframe.style.display = 'none';
  iframe.src = 'about:blank';

  if (config.type === 'image') {
    layer1.style.backgroundImage = `url('${config.imageUrl}')`;
    layer1.classList.add('active');
    layer2.classList.remove('active');
    return;
  }

  if (config.type === 'slideshow') {
    const urls = (config.slideshowUrls || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (!urls.length) {
      layer1.style.backgroundImage = `url('${config.imageUrl}')`;
      layer1.classList.add('active');
      layer2.classList.remove('active');
      return;
    }

    slideshowIndex = 0;
    layer1.style.backgroundImage = `url('${urls[0]}')`;
    layer1.classList.add('active');
    layer2.classList.remove('active');
    activeBgLayer = 1;

    slideshowTimer = setInterval(() => {
      const next = urls[(slideshowIndex + 1) % urls.length];
      slideshowIndex = (slideshowIndex + 1) % urls.length;

      if (activeBgLayer === 1) {
        layer2.style.backgroundImage = `url('${next}')`;
        layer2.classList.add('active');
        layer1.classList.remove('active');
        activeBgLayer = 2;
      } else {
        layer1.style.backgroundImage = `url('${next}')`;
        layer1.classList.add('active');
        layer2.classList.remove('active');
        activeBgLayer = 1;
      }
    }, Number(config.slideshowInterval || 10) * 1000);
  }
}

async function checkAirAlerts() {
  try {
    const response = await fetch(`${ALERTS_API}?t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(ALERTS_INTERVAL - 2000)
    });

    if (!response.ok) {
      setAlertStatus(null);
      return;
    }

    const data = await response.json();
    let hasAlert = false;

    if (Array.isArray(data)) {
      hasAlert = data.some(item => Array.isArray(item.activeAlerts) && item.activeAlerts.length > 0);
    } else if (data && Array.isArray(data.activeAlerts)) {
      hasAlert = data.activeAlerts.length > 0;
    } else if (data && data.alerts) {
      hasAlert = Array.isArray(data.alerts) && data.alerts.length > 0;
    }

    setAlertStatus(hasAlert);
  } catch (e) {
    console.warn('⚠️ Помилка перевірки тривог:', e.message);
    setAlertStatus(null);
  }
}

function setAlertStatus(hasAlert) {
  const box = document.getElementById('alertStatus');
  if (!box) return;

  if (hasAlert === null) {
    box.className = 'unknown';
    box.innerText = '❔ Перевірка тривоги...';
  } else if (hasAlert) {
    box.className = 'alert';
    box.innerText = '🚨 ПОВІТРЯНА ТРИВОГА';
    if (currentAlertStatus !== true) playAlertSound();
  } else {
    box.className = 'calm';
    box.innerText = '🟢 Тривоги немає';
  }

  currentAlertStatus = hasAlert;
}

function playAlertSound() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 900;
    gain.gain.value = 0.18;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('Помилка звуку:', e.message);
  }
}

function loadSchedule() {
  try {
    const saved = localStorage.getItem('dtefk_schedule');
    schedule = saved ? JSON.parse(saved) : DEFAULT_SCHEDULE;
    validateSchedule();
  } catch (e) {
    console.error('Помилка завантаження розкладу:', e);
    schedule = [...DEFAULT_SCHEDULE];
  }
}

function validateSchedule() {
  if (!Array.isArray(schedule) || !schedule.length) {
    schedule = [...DEFAULT_SCHEDULE];
    return;
  }

  schedule = schedule.filter(item => item && item.lesson && item.start && item.end);
  if (!schedule.length) schedule = [...DEFAULT_SCHEDULE];
}

function saveSchedule() {
  try {
    const rows = document.querySelectorAll('#scheduleInputs .input-row');
    if (!rows.length) {
      alert('Додайте хоча б один урок!');
      return;
    }

    const nextSchedule = Array.from(rows)
      .map(row => {
        const inputs = row.querySelectorAll('input');
        const lesson = inputs[0]?.value?.trim();
        const start = inputs[1]?.value;
        const end = inputs[2]?.value;
        return { lesson, start, end };
      })
      .filter(item => item.lesson && item.start && item.end && item.start < item.end);

    if (!nextSchedule.length) {
      alert('Перевірте, чи всі уроки мають коректний час');
      return;
    }

    schedule = nextSchedule;
    localStorage.setItem('dtefk_schedule', JSON.stringify(schedule));
    alert('✅ Розклад збережено!');
    toggleAdmin();
  } catch (e) {
    alert('Помилка: ' + e.message);
  }
}

function renderInputs() {
  const container = document.getElementById('scheduleInputs');
  if (!container) return;

  container.innerHTML = schedule
    .map((item, index) => `
      <div class="input-row">
        <input type="text" value="${escapeHtml(item.lesson)}" placeholder="1" maxlength="10">
        <input type="time" value="${item.start}">
        <input type="time" value="${item.end}">
        <button onclick="removeLesson(${index})" type="button">✕</button>
      </div>
    `)
    .join('');
}

function removeLesson(index) {
  if (index < 0 || index >= schedule.length) return;
  schedule.splice(index, 1);
  renderInputs();
}

function addInputRow() {
  schedule.push({ lesson: String(schedule.length + 1), start: '08:00', end: '09:00' });
  renderInputs();
}

function exportSchedule() {
  try {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dtefk_schedule_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Розклад експортовано');
  } catch (e) {
    alert('Помилка експорту: ' + e.message);
  }
}

function importSchedule(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!Array.isArray(parsed) || !parsed.every(item => item.lesson && item.start && item.end)) {
        alert('❌ Некоректний формат JSON');
        return;
      }

      schedule = parsed;
      localStorage.setItem('dtefk_schedule', JSON.stringify(schedule));
      renderInputs();
      alert('✅ Розклад імпортовано успішно');
    } catch (e) {
      alert('❌ Помилка парсингу JSON: ' + e.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.innerText = timeStr;

  const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  const dateEl = document.getElementById('date');
  if (dateEl) {
    dateEl.innerText = `${days[now.getDay()]} • ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  const hm = timeStr.substring(0, 5);
  let active = null;
  schedule.forEach(item => {
    if (hm >= item.start && hm < item.end) active = item;
  });

  const lessonInfo = document.getElementById('lessonInfo');
  if (lessonInfo) {
    if (active) {
      lessonInfo.innerText = `ЗАРАЗ ПАРА №${active.lesson}`;
      lessonInfo.style.background = 'rgba(0, 255, 245, 0.2)';
      lessonInfo.style.borderColor = '#00fff5';
      lessonInfo.style.color = '#00fff5';
    } else {
      lessonInfo.innerText = 'ПЕРЕРВА 🙌';
      lessonInfo.style.background = 'rgba(76, 175, 80, 0.2)';
      lessonInfo.style.borderColor = '#4caf50';
      lessonInfo.style.color = '#4caf50';
    }
  }

  if (now.getSeconds() === 0) {
    schedule.forEach(item => {
      if (hm === item.start || hm === item.end) playBell();
    });
  }
}

function playBell() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 1200;
    gain.gain.value = 0.12;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  } catch (e) {
    console.warn('Помилка звуку:', e.message);
  }
}

const GROUP_RE = /^[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+(?:-[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+)+$/;

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseReplacesHtml(htmlContent) {
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
  const result = [];

  doc.querySelectorAll('table').forEach(table => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => cleanText(th.textContent).toLowerCase());
    const col = name => headers.findIndex(h => h.includes(name));

    const idx = {
      group: col('груп'),
      lesson: col('пара'),
      subject: col('предмет'),
      teacher: col('виклад'),
      room: col('аудит')
    };

    const hasHeaders = idx.group !== -1;

    table.querySelectorAll('tr').forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) return;

      const pick = i => (i !== -1 && cells[i]) ? cleanText(cells[i].textContent) : '';
      const group = hasHeaders ? pick(idx.group) : cleanText(cells[0]?.textContent || '');
      if (!GROUP_RE.test(group)) return;

      let info = '';
      let room = '';

      if (hasHeaders) {
        const lesson = pick(idx.lesson);
        const subject = pick(idx.subject);
        const teacher = pick(idx.teacher);
        room = pick(idx.room);
        info = [lesson ? `${lesson} пара` : '', subject, teacher].filter(Boolean).join(' • ');
      } else {
        room = cleanText(cells[cells.length - 1]?.textContent || '');
        info = cells.slice(1, -1).map(cell => cleanText(cell.textContent)).filter(Boolean).join(' • ');
      }

      result.push({
        group,
        info: info || 'Зміна розкладу',
        room: room.replace(/[-–—]/g, '').trim() || '--',
        date: new Date().toISOString().split('T')[0]
      });
    });
  });

  return result;
}

async function fetchReplaces() {
  console.log('🔄 Завантаження замін...');

  let parsed = null;
  const proxies = [
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(REPLACES_URL)}&t=${Date.now()}`, json: true },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(REPLACES_URL)}&t=${Date.now()}`, json: false },
    { url: `https://corsproxy.io/?url=${encodeURIComponent(REPLACES_URL)}`, json: false }
  ];

  try {
    const response = await Promise.race([
      fetch(`${REPLACES_JSON_URL}?t=${Date.now()}`, { cache: 'no-store' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT))
    ]);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        parsed = data.items.map(item => ({
          ...item,
          date: item.date || new Date().toISOString().split('T')[0]
        }));

        if (data.updated) {
          const updatedDate = new Date(data.updated);
          replacesUpdatedTime = updatedDate.toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }
    }
  } catch (e) {
    console.warn('GitHub JSON недоступний:', e.message);
  }

  if (!parsed) {
    for (const proxy of proxies) {
      try {
        const response = await Promise.race([
          fetch(proxy.url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT))
        ]);

        if (!response.ok) continue;

        const text = proxy.json ? (await response.json()).contents : await response.text();
        if (!text || !text.includes('<table')) continue;

        parsed = parseReplacesHtml(text);
        replacesUpdatedTime = new Date().toLocaleString('uk-UA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        break;
      } catch (e) {
        console.warn('Proxy не працює:', e.message);
      }
    }
  }

  if (parsed === null) {
    replacesError = true;
    allReplaces = [];
    allDatesWithReplaces = [];
    replacesUpdatedTime = null;
  } else {
    replacesError = false;
    allReplaces = parsed;
    const uniqueDates = [...new Set(allReplaces.map(item => item.date || new Date().toISOString().split('T')[0]))].sort();
    allDatesWithReplaces = uniqueDates;
  }

  currentPageIndex = 0;
  startReplacesAutoScroll();
  renderReplaces();
}

function formatReplaceDate(dateStr) {
  if (!dateStr) return 'Без дати';
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = new Intl.DateTimeFormat('uk-UA', { weekday: 'long' }).format(d);
  const day = d.getDate();
  const month = new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(d);
  return `${day} ${month} (${weekday})`;
}

function startReplacesAutoScroll() {
  if (replacesPageTimer) {
    clearInterval(replacesPageTimer);
    replacesPageTimer = null;
  }

  if (!allReplaces.length || !allDatesWithReplaces.length) return;

  replacesPageTimer = setInterval(() => {
    renderReplaces();
  }, 10000);
}

function renderReplaces() {
  const list = document.getElementById('replacesList');
  if (!list) return;

  if (!allReplaces.length) {
    const text = replacesError === null ? '⏳ Завантаження замін...' : replacesError ? '⚠️ Не вдалося завантажити заміни' : '✅ Замін немає';
    list.innerHTML = `<div style="text-align:center;margin-top:50px;opacity:0.7;">${text}</div>`;
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = replacesUpdatedTime ? `${replacesUpdatedTime}` : '0/0';
    return;
  }

  if (!allDatesWithReplaces.length) {
    allDatesWithReplaces = [new Date().toISOString().split('T')[0]];
  }

  const currentDate = allDatesWithReplaces[currentPageIndex % allDatesWithReplaces.length];
  let itemsForDate = allReplaces.filter(item => (item.date || new Date().toISOString().split('T')[0]) === currentDate);

  const ITEMS_PER_PAGE = 12;
  const pageNumber = Math.floor(currentPageIndex / allDatesWithReplaces.length);
  const startIdx = (pageNumber % Math.ceil(itemsForDate.length / ITEMS_PER_PAGE)) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageItems = itemsForDate.slice(startIdx, endIdx);

  const header = `▼ Зміни до розкладу на ${formatReplaceDate(currentDate)}`;
  const rows = pageItems.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.12);font-weight:700;color:#ecfeff;">${escapeHtml(item.group)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.12);color:#eaf7ff;">${escapeHtml(item.info)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.12);color:#eaf7ff;text-align:center;">${escapeHtml(item.room)}</td>
    </tr>
  `).join('');

  list.innerHTML = `
    <div style="margin-bottom: 18px; border-radius: 12px; overflow: hidden; background: rgba(18, 38, 57, 0.78); border: 1px solid rgba(0,255,245,0.25); box-shadow: 0 8px 22px rgba(0,0,0,0.22);">
      <div style="background: rgba(9, 89, 111, 0.9); color: #ff5a5a; font-weight: 800; font-size: 15px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.12);">${header}</div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; color:#fff; font-size:13px;">
          <thead>
            <tr style="background: rgba(9, 30, 45, 0.9);">
              <th style="text-align:left;padding:12px 10px;font-weight:800;color:#dffbff;width:15%;">Група</th>
              <th style="text-align:left;padding:12px 10px;font-weight:800;color:#dffbff;width:70%;">Пара</th>
              <th style="text-align:center;padding:12px 10px;font-weight:800;color:#dffbff;width:15%;">Аудиторія</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  currentPageIndex++;

  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) {
    const totalPages = Math.ceil(itemsForDate.length / ITEMS_PER_PAGE);
    const currentShowPage = (pageNumber % totalPages) + 1;
    const info = replacesUpdatedTime ? `${replacesUpdatedTime} • ` : '';
    const dateCounter = `${(currentPageIndex % allDatesWithReplaces.length) || allDatesWithReplaces.length} / ${allDatesWithReplaces.length}`;
    pageInfo.innerText = `${info}${currentShowPage} / ${totalPages || 1} • ${pageItems.length} замін`;
  }
}

async function loadWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_COORDS.lat}&longitude=${WEATHER_COORDS.lon}&current_weather=true`;
    const response = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT))
    ]);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    weatherData = data.current_weather;

    const temp = Math.round(weatherData.temperature);
    const code = weatherData.weather_code;

    let icon = '☀️';
    if ([80, 81, 82].includes(code)) icon = '🌧';
    else if ([71, 73, 75, 77, 85, 86].includes(code)) icon = '❄️';
    else if ([45, 48].includes(code)) icon = '🌫';
    else if (code >= 3 && code <= 48) icon = '☁️';

    const iconEl = document.getElementById('weatherIcon');
    const tempEl = document.getElementById('temp');
    if (iconEl) iconEl.innerText = icon;
    if (tempEl) tempEl.innerText = String(temp);
  } catch (e) {
    const iconEl = document.getElementById('weatherIcon');
    if (iconEl) iconEl.innerText = '❓';
  }
}

function toggleAdmin() {
  const modal = document.getElementById('adminModal');
  const overlay = document.getElementById('overlay');
  if (!modal || !overlay) return;

  const isVisible = modal.style.display === 'block';
  modal.style.display = isVisible ? 'none' : 'block';
  overlay.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) renderInputs();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
