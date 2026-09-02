// Забирає заміни з dtrek.dp.ua і зберігає replaces.json (запускається GitHub Action)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const REPLACES_URL = 'https://dtrek.dp.ua/stud/class-replaces';
const GROUP_RE = /^[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+(?:-[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]+)+$/;

const decode = s => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const cleanText = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const cellsOf = (row, tag) => [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(m => cleanText(m[1]));

function parse(html) {
  const result = [];
  for (const [table] of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const headers = cellsOf(table, 'th').map(h => h.toLowerCase());
    const col = name => headers.findIndex(h => h.includes(name));
    const idx = { group: col('груп'), lesson: col('пара'), subject: col('предмет'), teacher: col('виклад'), room: col('аудит') };
    const hasHeaders = idx.group !== -1;

    for (const [row] of table.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = cellsOf(row, 'td');
      if (cells.length < 2) continue;
      const pick = i => (i !== -1 && cells[i] !== undefined) ? cells[i] : '';
      const group = hasHeaders ? pick(idx.group) : cells[0];
      if (!GROUP_RE.test(group)) continue;

      let info, room;
      if (hasHeaders) {
        const lesson = pick(idx.lesson);
        room = pick(idx.room);
        info = [lesson ? `${lesson} пара` : '', pick(idx.subject), pick(idx.teacher)].filter(Boolean).join(' • ');
      } else {
        room = cells[cells.length - 1];
        info = cells.slice(1, -1).filter(Boolean).join(' • ');
      }
      result.push({ group, info: info || 'Зміна розкладу', room: room.replace(/[-–—]/g, '').trim() || '--' });
    }
  }
  return result;
}

const res = await fetch(REPLACES_URL, { signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const html = await res.text();
if (!html.includes('<table')) throw new Error('Таблицю не знайдено');

const items = parse(html);
const previous = existsSync('replaces.json') ? JSON.parse(readFileSync('replaces.json', 'utf8')).items : null;
if (JSON.stringify(previous) === JSON.stringify(items)) {
  console.log('Замін без змін');
} else {
  writeFileSync('replaces.json', JSON.stringify({ updated: new Date().toISOString(), items }, null, 2) + '\n');
  console.log(`Збережено ${items.length} замін`);
}
