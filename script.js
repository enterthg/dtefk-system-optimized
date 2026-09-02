// ==================== КОНСТАНТИ ====================
const DEFAULT_SCHEDULE = [
  { lesson: "1", start: "08:30", end: "09:50" },
  { lesson: "2", start: "10:00", end: "11:20" },
  { lesson: "3", start: "11:30", end: "12:50" },
  { lesson: "4", start: "13:00", end: "14:20" },
  { lesson: "5", start: "14:30", end: "15:50" }
];

const WEATHER_COORDS = { lat: 48.45, lon: 34.98 }; // Дніпро
const API_TIMEOUT = 5000;
const DNIPRO_REGION_ID = 12; // ID регіону Дніпро в API

// ==================== ГЛОБАЛЬНІ ЗМІННІ ====================
let schedule = [];
let allReplaces = [];
let currentPage = 0;
let weatherData = null;
let alertCheckInterval = null;

// ==================== ІНІЦІАЛІЗАЦІЯ ====================
function init() {
  loadSchedule();
  updateClock();
  loadWeather();
  fetchReplaces();
  checkAirAlerts();
  
  setInterval(updateClock, 1000);
  setInterval(renderReplaces, 5000);
  setInterval(fetchReplaces, 600000); // 10 хвилин
  setInterval(loadWeather, 1800000); // 30 хвилин
  setInterval(checkAirAlerts, 30000); // Перевіра кожні 30 секунд
  
  document.addEventListener('click', () => {
    const bell = document.getElementById('bell');
    if (bell.paused) {
      bell.play().catch(() => {});
    }
  });
}

// ==================== СИСТЕМА ТРИВОГ ====================
async function checkAirAlerts() {
  try {
    const response = await fetch('https://api.ukrainealerts.com/v3/alerts', {
      signal: AbortSignal.timeout(API_TIMEOUT)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const dnipro_alerts = data.alerts?.filter(alert => 
      alert.region_id === DNIPRO_REGION_ID || 
      alert.location_title?.includes('Дніпро') ||
      alert.location_title?.includes('Днепр')
    );
    
    if (dnipro_alerts && dnipro_alerts.length > 0) {
      const active_alert = dnipro_alerts.find(a => a.alert);
      if (active_alert && active_alert.alert) {
        showAirAlert(active_alert);
      } else {
        hideAirAlert();
      }
    } else {
      hideAirAlert();
    }
  } catch (e) {
    console.warn('Помилка перевірки тривог:', e);
  }
}

function showAirAlert(alert) {
  let alertBox = document.getElementById('airAlertBox');
  
  if (!alertBox) {
    alertBox = document.createElement('div');
    alertBox.id = 'airAlertBox';
    alertBox.innerHTML = `
      <div id="alertContent">
        <div id="alertIcon">🚨</div>
        <div id="alertText">ПОВІТРЯНА ТРИВОГА!</div>
        <div id="alertTime">--:--</div>
      </div>
    `;
    document.body.appendChild(alertBox);
    
    const style = document.createElement('style');
    style.textContent = `
      #airAlertBox {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 0, 0, 0.15);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        pointer-events: none;
      }

      #alertContent {
        text-align: center;
        font-size: 80px;
        font-weight: 900;
        color: #ff0000;
        text-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
        animation: alertBlink 0.6s infinite, alertPulse 1s ease-in-out infinite;
        font-family: 'Arial', sans-serif;
      }

      #alertIcon {
        font-size: 120px;
        margin-bottom: 20px;
        animation: alertShake 0.3s infinite;
      }

      #alertText {
        font-size: 60px;
        margin-bottom: 30px;
        letter-spacing: 3px;
      }

      #alertTime {
        font-size: 40px;
        color: #ffaa00;
        margin-top: 20px;
      }

      @keyframes alertBlink {
        0%, 50% { opacity: 1; }
        25%, 75% { opacity: 0.3; }
      }

      @keyframes alertPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      @keyframes alertShake {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        25% { transform: translateX(-10px) rotate(-5deg); }
        75% { transform: translateX(10px) rotate(5deg); }
      }

      @keyframes alertFlash {
        0%, 49% { background: rgba(255, 0, 0, 0.15); }
        50%, 100% { background: rgba(255, 0, 0, 0.3); }
      }

      #airAlertBox.active {
        animation: alertFlash 1s infinite;
      }
    `;
    document.head.appendChild(style);
  }
  
  alertBox.classList.add('active');
  
  // Оновлення часу тривоги
  if (alert.started_at) {
    const startTime = new Date(alert.started_at);
    const updateAlertTime = () => {
      const now = new Date();
      const diff = Math.floor((now - startTime) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      document.getElementById('alertTime').textContent = 
        `Тривога ${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    updateAlertTime();
    
    if (alertCheckInterval) clearInterval(alertCheckInterval);
    alertCheckInterval = setInterval(updateAlertTime, 1000);
  }

  // Звуковий сигнал
  playAlertSound();
  
  console.log('🚨 ПОВІТРЯНА ТРИВОГА У ДНІПРІ!');
}

function hideAirAlert() {
  const alertBox = document.getElementById('airAlertBox');
  if (alertBox) {
    alertBox.classList.remove('active');
    alertBox.style.display = 'none';
  }
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
  }
}

function playAlertSound() {
  // Синтезуємо звук тривоги
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
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
  const bell = document.getElementById('bell');
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
}

// ==================== ЗАМІНИ ====================
async function fetchReplaces() {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent('https://dtrek.dp.ua/stud/class-replaces')}&t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const res = await fetch(proxy, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const doc = new DOMParser().parseFromString(data.contents, 'text/html');

    allReplaces = [];
    const rows = doc.querySelectorAll('tr');

    rows.forEach(row => {
      const td = row.querySelectorAll('td');
      if (td.length >= 2 && /\d/.test(td[0].innerText)) {
        allReplaces.push({
          group: td[0].innerText.trim(),
          info: Array.from(td)
            .slice(1, -1)
            .map(c => c.innerText.trim())
            .join(' ')
            .replace(/-{2,}/g, '')
            .trim(),
          room: td[td.length - 1]?.innerText?.trim()?.replace(/-/g, '') || '--'
        });
      }
    });

    currentPage = 0;
    renderReplaces();
  } catch (e) {
    console.warn('Помилка завантаження замін:', e);
    const list = document.getElementById('replacesList');
    if (allReplaces.length === 0) {
      list.innerHTML = `<div style="text-align:center;margin-top:50px;opacity:0.5;">⚠️ Помилка завантаження</div>`;
    }
  }
}

function renderReplaces() {
  const list = document.getElementById('replacesList');

  if (allReplaces.length === 0) {
    list.innerHTML = "<div style='text-align:center;margin-top:50px;opacity:0.5;'>✅ Замін немає</div>";
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

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
  } catch (e) {
    console.warn('Помилка завантаження погоди:', e);
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
