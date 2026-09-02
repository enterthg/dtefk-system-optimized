// ==================== КОНСТАНТИ ====================
const DEFAULT_SCHEDULE = [
  { lesson: "1", start: "08:30", end: "09:50" },
  { lesson: "2", start: "10:00", end: "11:20" },
  { lesson: "3", start: "11:30", end: "12:50" },
  { lesson: "4", start: "13:00", end: "14:20" },
  { lesson: "5", start: "14:30", end: "15:50" }
];

const WEATHER_COORDS = { lat: 48.45, lon: 34.98 }; // Дніпро
const API_TIMEOUT = 8000;
const REPLACES_URL = 'https://dtrek.dp.ua/stud/class-replaces';

// ==================== ГЛОБАЛЬНІ ЗМІННІ ====================
let schedule = [];
let allReplaces = [];
let replacesError = null;
let currentPage = 0;
let weatherData = null;
let currentAlertStatus = false;

// ==================== ІНІЦІАЛІЗАЦІЯ ====================
function init() {
  loadSchedule();
  updateClock();
  loadWeather();
  fetchReplaces();
  checkAirAlerts();
  
  setInterval(updateClock, 1000);
  setInterval(renderReplaces, 5000);
  setInterval(fetchReplaces, 300000); // 5 хвилин
  setInterval(loadWeather, 1800000); // 30 хвилин
  setInterval(checkAirAlerts, 30000); // Перевіра кожні 30 секунд
  
  console.log('✅ Система запущена');
  console.log('📡 Перевірка тривог активна');
  console.log('🔄 Завантаження замін з:', REPLACES_URL);
}

// ==================== СИСТЕМА ТРИВОГ ====================
async function checkAirAlerts() {
  try {
    const response = await fetch('https://api.ukrainealerts.com/v3/alerts', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      
      let hasAlert = false;
      
      if (data.alerts && Array.isArray(data.alerts)) {
        for (let alert of data.alerts) {
          if (alert.location_title && alert.alert === true) {
            const location = alert.location_title.toLowerCase();
            if (location.includes('дніпро') || 
                location.includes('днепр') || 
                location.includes('дніпропетровськ') ||
                location.includes('днепропетровск')) {
              hasAlert = true;
              break;
            }
          }
        }
      }
      
      if (hasAlert && !currentAlertStatus) {
        showAirAlert();
        currentAlertStatus = true;
      } else if (!hasAlert && currentAlertStatus) {
        hideAirAlert();
        currentAlertStatus = false;
      }
    }
  } catch (e) {
    console.warn('⚠️ Помилка перевірки тривог:', e.message);
  }
}

function showAirAlert() {
  const alertBox = document.getElementById('airAlertBox');
  
  if (!alertBox.innerHTML.includes('alertContent')) {
    alertBox.innerHTML = `
      <div id="alertContent">
        <div id="alertIcon">🚨</div>
        <div id="alertText">ПОВІТРЯНА ТРИВОГА!</div>
        <div id="alertTime">Тривога активна!</div>
      </div>
    `;
  }
  
  alertBox.classList.add('active');
  playAlertSound();
  
  console.log('🚨 ПОВІТРЯНА ТРИВОГА У ДНІПРІ!', new Date().toLocaleTimeString('uk-UA'));
}

function hideAirAlert() {
  const alertBox = document.getElementById('airAlertBox');
  alertBox.classList.remove('active');
  console.log('✅ Тривога завершена', new Date().toLocaleTimeString('uk-UA'));
}

function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 900;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.warn('Помилка звуку:', e.message);
  }
}

// ==================== РОЗКЛАД ====================
function loadSchedule() {
  try {
    const saved = localStorage.getItem('dtefk_schedule');
    schedule = saved ? JSON.parse(saved) : DEFAULT_SCHEDULE;
    validateSchedule();
  } catch (e) {
    console.error('Помилка завантаження розкладу:', e);
    schedule = DEFAULT_SCHEDULE;
  }
}

function validateSchedule() {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    schedule = DEFAULT_SCHEDULE;
  }
  schedule = schedule.filter(l => l.lesson && l.start && l.end);
}

function saveSchedule() {
  try {
    const rows = document.querySelectorAll("#scheduleInputs .input-row");
    if (rows.length === 0) {
      alert("Додайте хоча б один урок!");
      return;
    }

    schedule = Array.from(rows).map(r => {
      const inputs = r.querySelectorAll("input");
      return {
        lesson: inputs[0].value.trim(),
        start: inputs[1].value,
        end: inputs[2].value
      };
    }).filter(l => l.lesson && l.start && l.end && l.start < l.end);

    if (schedule.length === 0) {
      alert("Перевірте коректність даних!");
      return;
    }

    localStorage.setItem('dtefk_schedule', JSON.stringify(schedule));
    alert("✅ Розклад збережено!");
    toggleAdmin();
  } catch (e) {
    alert('Помилка: ' + e.message);
  }
}

function renderInputs() {
  document.getElementById("scheduleInputs").innerHTML = schedule.map((l, i) => `
    <div class="input-row">
      <input type="text" value="${escapeHtml(l.lesson)}" placeholder="1" maxlength="10">
      <input type="time" value="${l.start}">
      <input type="time" value="${l.end}">
      <button onclick="removeLesson(${i})" type="button">✕</button>
    </div>
  `).join('');
}

function removeLesson(index) {
  schedule.splice(index, 1);
  renderInputs();
}

function addInputRow() {
  const newLesson = {
    lesson: String(schedule.length + 1),
    start: "08:00",
    end: "09:00"
  };
  schedule.push(newLesson);
  renderInputs();
}

// ==================== ЕКСПОРТ / ІМПОРТ ====================
function exportSchedule() {
  try {
    const data = JSON.stringify(schedule, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dtefk_schedule_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("✅ Розклад експортовано!");
  } catch (e) {
    alert('Помилка: ' + e.message);
  }
}

function importSchedule(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data) && data.every(l => l.lesson && l.start && l.end)) {
        schedule = data;
        localStorage.setItem('dtefk_schedule', JSON.stringify(schedule));
        renderInputs();
        alert("✅ Розклад імпортовано успішно!");
      } else {
        alert("❌ Некоректний формат файлу!");
      }
    } catch (err) {
      alert('❌ Помилка парсингу JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ==================== ГОДИННИК ====================
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  document.getElementById("clock").innerText = timeStr;

  const days = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота"];
  const months = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  document.getElementById("date").innerText = `${days[now.getDay()]} • ${now.getDate()} ${months[now.getMonth()]}`;

  const hm = timeStr.substring(0, 5);
  let active = null;

  schedule.forEach(l => {
    if (hm >= l.start && hm < l.end) {
      active = l;
    }
  });

  const lessonInfo = document.getElementById("lessonInfo");
  if (active) {
    lessonInfo.innerText = `ЗАРАЗ ПАРА №${active.lesson}`;
    lessonInfo.style.background = "rgba(0, 255, 245, 0.2)";
    lessonInfo.style.borderColor = "#00fff5";
    lessonInfo.style.color = "#00fff5";
  } else {
    lessonInfo.innerText = "ПЕРЕРВА 🙌";
    lessonInfo.style.background = "rgba(76, 175, 80, 0.2)";
    lessonInfo.style.borderColor = "#4caf50";
    lessonInfo.style.color = "#4caf50";
  }

  if (now.getSeconds() === 0) {
    schedule.forEach(l => {
      if (hm === l.start || hm === l.end) {
        playBell();
      }
    });
  }
}

function playBell() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(1000, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Помилка звуку:', e);
  }
}

// ==================== ЗАМІНИ ====================
const GROUP_RE = /^[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+(?:-[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+)+$/;

function cleanText(cell) {
  return (cell?.textContent || '').replace(/\s+/g, ' ').trim();
}

function parseReplacesHtml(htmlContent) {
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
  const result = [];

  doc.querySelectorAll('table').forEach(table => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => cleanText(th).toLowerCase());
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

      const pick = i => (i !== -1 && cells[i]) ? cleanText(cells[i]) : '';
      const group = hasHeaders ? pick(idx.group) : cleanText(cells[0]);
      if (!GROUP_RE.test(group)) return;

      let info;
      let room;
      if (hasHeaders) {
        const lesson = pick(idx.lesson);
        const subject = pick(idx.subject);
        const teacher = pick(idx.teacher);
        room = pick(idx.room);
        info = [lesson ? `${lesson} пара` : '', subject, teacher].filter(Boolean).join(' • ');
      } else {
        room = cleanText(cells[cells.length - 1]);
        info = cells.slice(1, -1).map(cleanText).filter(Boolean).join(' • ');
      }

      result.push({
        group,
        info: info || 'Зміна розкладу',
        room: room.replace(/[-–—]/g, '').trim() || '--'
      });
    });
  });

  return result;
}

async function fetchReplaces() {
  console.log('🔄 Завантаження замін...');

  const corsProxies = [
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(REPLACES_URL)}&t=${Date.now()}`, json: true },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(REPLACES_URL)}&t=${Date.now()}`, json: false },
    { url: `https://corsproxy.io/?url=${encodeURIComponent(REPLACES_URL)}`, json: false },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(REPLACES_URL)}`, json: false }
  ];

  let parsed = null;

  for (const proxy of corsProxies) {
    try {
      const res = await Promise.race([
        fetch(proxy.url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT))
      ]);
      if (!res.ok) continue;

      const htmlContent = proxy.json ? (await res.json()).contents : await res.text();
      if (!htmlContent || !htmlContent.includes('<table')) continue;

      parsed = parseReplacesHtml(htmlContent);
      console.log('✅ Заміни завантажені:', parsed.length, 'записів');
      break;
    } catch (e) {
      console.warn('Proxy не працює:', e.message);
    }
  }

  if (parsed === null) {
    console.warn('❌ Не вдалося завантажити заміни');
    replacesError = true;
    allReplaces = [];
  } else {
    replacesError = false;
    allReplaces = parsed;
  }

  currentPage = 0;
  renderReplaces();
}

function renderReplaces() {
  const list = document.getElementById('replacesList');

  if (allReplaces.length === 0) {
    const text = replacesError === null
      ? '⏳ Завантаження замін...'
      : replacesError ? '⚠️ Не вдалося завантажити заміни' : '✅ Замін немає';
    list.innerHTML = `<div style='text-align:center;margin-top:50px;opacity:0.7;'>${text}</div>`;
    document.getElementById('pageInfo').innerText = "0/0";
    return;
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(allReplaces.length / itemsPerPage);
  const start = (currentPage % totalPages) * itemsPerPage;
  const items = allReplaces.slice(start, start + itemsPerPage);

  list.innerHTML = items.map(x => `
    <div class="replace-item" title="Група: ${escapeHtml(x.group)} | Кабінет: ${escapeHtml(x.room)}">
      <div class="rep-group">${escapeHtml(x.group)}</div>
      <div class="rep-info">${escapeHtml(x.info)}</div>
      <div class="rep-room">${escapeHtml(x.room)}</div>
    </div>
  `).join('');

  document.getElementById('pageInfo').innerText = `${currentPage + 1} / ${totalPages}`;
  currentPage = (currentPage + 1) % totalPages;
}

// ==================== ПОГОДА ====================
async function loadWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_COORDS.lat}&longitude=${WEATHER_COORDS.lon}&current_weather=true`;
    
    const res = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT))
    ]);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    weatherData = data.current_weather;

    const temp = Math.round(weatherData.temperature);
    const windCode = weatherData.weather_code;

    let icon = '☀️';
    if (windCode >= 80 && windCode <= 82) icon = '🌧';
    else if (windCode >= 71 && windCode <= 77) icon = '❄️';
    else if (windCode >= 80) icon = '⛈';
    else if (windCode >= 45) icon = '🌫';
    else if (windCode > 3) icon = '☁️';

    document.getElementById('weatherIcon').innerText = icon;
    document.getElementById('temp').innerText = temp;
    console.log('🌤️ Погода оновлена:', temp + '°C');
  } catch (e) {
    console.warn('⚠️ Помилка погоди:', e.message);
    document.getElementById('weatherIcon').innerText = '❓';
  }
}

// ==================== МОДАЛЬ ====================
function toggleAdmin() {
  const modal = document.getElementById("adminModal");
  const overlay = document.getElementById("overlay");
  const isVisible = modal.style.display === "block";

  modal.style.display = isVisible ? "none" : "block";
  overlay.style.display = isVisible ? "none" : "block";

  if (!isVisible) {
    renderInputs();
  }
}

// ==================== УТИЛІТИ ====================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Запуск
init();
