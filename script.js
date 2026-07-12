// ==========================================================================
//  Reika Birthday 沖縄旅行 — しおり
// ==========================================================================

const KICKERS_EN = { transport: 'TRANSFER', hotel: 'STAY', breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER', snack: 'SNACK', sightseeing: 'SIGHTS', activity: 'EXPERIENCE', event: 'CEREMONY', free: 'FREE' };

const PACK = [
  { name: 'ビーチ', items: ['水着', 'ラッシュガード', 'サングラス', '日焼け止め', '帽子', 'ビーチサンダル', 'ビーチタオル'] },
  { name: '移動・貴重品', items: ['運転免許証（レンタカー）', '現金・クレジットカード', 'スマホ充電器・モバイルバッテリー', 'エコバッグ'] },
  { name: '身だしなみ・その他', items: ['スキンケア・化粧品', '常備薬', '虫除けスプレー', '着替え'] },
];

const PACK_KEY = 'okinawa-shiori-packing';

const TEAL = '#167E7E';
const CORAL = '#C36A4C';

let TRIP = null;
let RESTAURANTS = null;
let activeTab = 'day-0';
let packing = {};

// --------------------------------------------------------------------------
//  Helpers
// --------------------------------------------------------------------------
function clean(s) {
  if (!s) return s;
  return String(s)
    .replace(/⭐/g, '★')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s・:：]+/, '')
    .trim();
}

// Reikaに見せないサプライズ情報を除去
function scrub(note) {
  if (!note) return note;
  const secrets = ['誕生日を伝え', '誕生日と伝え', '誕生日演出', 'Reikaの誕生日', 'サプライズ'];
  return String(note)
    .split(/(?<=。)/)
    .filter((p) => !secrets.some((s) => p.includes(s)))
    .join('')
    .trim();
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function kicker(type) {
  return KICKERS_EN[type] || 'PLAN';
}

function loadPacking() {
  try { packing = JSON.parse(localStorage.getItem(PACK_KEY) || '{}') || {}; }
  catch (e) { packing = {}; }
}
function savePacking() {
  try { localStorage.setItem(PACK_KEY, JSON.stringify(packing)); } catch (e) {}
}

// --------------------------------------------------------------------------
//  Data
// --------------------------------------------------------------------------
async function loadData() {
  const [tripRes, restaurantsRes] = await Promise.all([
    fetch('data/trip.json'),
    fetch('data/restaurants.json'),
  ]);
  if (!tripRes.ok || !restaurantsRes.ok) throw new Error('データの読み込みに失敗しました');
  TRIP = await tripRes.json();
  RESTAURANTS = await restaurantsRes.json();
}

// --------------------------------------------------------------------------
//  Header / facts / tabs
// --------------------------------------------------------------------------
function renderHeader() {
  const days = TRIP.days;
  const first = days[0], last = days[days.length - 1];
  const t = TRIP.meta.travelers;
  document.getElementById('hero-names').textContent = clean(`${t.partner} & ${t.main}`);
  document.getElementById('hero-dates').textContent = `${first.date} (${first.day}) — ${last.date} (${last.day})`;

  const f = TRIP.meta.flights;
  document.getElementById('facts').innerHTML = `
    <div class="fact">
      <div class="fact-label">OUTBOUND</div>
      <div class="fact-value">${esc(clean(f.outbound))}</div>
    </div>
    <div class="fact">
      <div class="fact-label">RETURN</div>
      <div class="fact-value">${esc(clean(f.return))}</div>
    </div>
    <div class="fact full">
      <div class="fact-label">RENTAL CAR</div>
      <div class="fact-value">${esc(clean(TRIP.meta.rental_car))}</div>
    </div>`;
}

function renderTabs() {
  const nav = document.getElementById('tabs');
  const tabs = TRIP.days.map((d, i) => ({ id: `day-${i}`, l1: d.date, l2: d.day }));
  tabs.push({ id: 'rest', l1: 'お店', l2: 'FOOD' });
  tabs.push({ id: 'pack', l1: '持ち物', l2: 'PACK' });
  tabs.push({ id: 'resv', l1: '予約', l2: 'CHECK' });

  nav.innerHTML = tabs.map((t) => `
    <button class="tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">
      <span class="tab-l1">${esc(t.l1)}</span>
      <span class="tab-l2">${esc(t.l2)}</span>
    </button>`).join('');

  nav.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));

  const content = document.getElementById('content');
  if (tabId === 'rest') content.innerHTML = renderRestaurants();
  else if (tabId === 'pack') { content.innerHTML = renderPacking(); attachPackHandlers(content); }
  else if (tabId === 'resv') content.innerHTML = renderReservations();
  else {
    const idx = Number(tabId.split('-')[1]) || 0;
    content.innerHTML = renderDay(idx);
    attachRainHandlers(content);
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

// --------------------------------------------------------------------------
//  Day panel
// --------------------------------------------------------------------------
function renderHotel(day) {
  const hotel = TRIP.hotels.find((h) => h.nights.includes(day.date));
  if (!hotel) return '';
  const note = clean(scrub(hotel.note));
  return `
    <div class="hotel">
      <div class="hotel-label">STAY / 宿泊</div>
      <div class="hotel-row">
        <div class="hotel-name">${esc(clean(hotel.name))}</div>
        <a class="linkbtn" href="${esc(hotel.map)}" target="_blank" rel="noopener">地図 ↗</a>
      </div>
      ${note ? `<div class="hotel-note">${esc(note)}</div>` : ''}
    </div>`;
}

function renderScheduleItem(item, idx, i) {
  const isEvent = item.type === 'event';
  const special = !!item.reserved || isEvent;
  const whoColor = item.who === 'Reika' ? CORAL : TEAL;
  let dotColor = TEAL, kickerColor = '#A69E8C';
  if (item.reserved) { dotColor = CORAL; kickerColor = CORAL; }
  if (isEvent) { dotColor = TEAL; kickerColor = TEAL; }
  let bodyStyle = '';
  if (item.reserved) bodyStyle = 'background:#F7EEE8;';
  else if (isEvent) bodyStyle = 'background:#EAF1F0;';

  const note = clean(scrub(item.note));
  const whoTag = item.who ? `<span class="who-tag" style="background:${whoColor}">${esc(item.who)}</span>` : '';
  const reservedTag = item.reserved ? '<span class="reserved-tag">● 予約済</span>' : '';
  const mapLink = item.map ? `<a class="linkbtn" href="${esc(item.map)}" target="_blank" rel="noopener">地図 ↗</a>` : '';

  const key = `${idx}-${i}`;
  const rain = item.rain
    ? `<button class="rain-btn" data-rain="${key}">☂ 雨の日プラン <span class="caret">▼</span></button>`
    : '';
  const rainPanel = item.rain
    ? `<div class="rain-panel" data-rain-panel="${key}">${esc(clean(item.rain))}</div>`
    : '';

  return `
    <div class="tl-item">
      <div class="tl-time">${esc(item.time)}</div>
      <div class="tl-rail">
        <div class="tl-line"></div>
        <div class="tl-dot" style="background:${dotColor}"></div>
      </div>
      <div class="tl-body ${special ? 'special' : 'plain'}" style="${bodyStyle}">
        <div class="tl-meta">
          <span class="tl-kicker" style="color:${kickerColor}">${esc(kicker(item.type))}</span>
          ${whoTag}
          ${reservedTag}
        </div>
        <div class="tl-label">${esc(clean(item.label))}</div>
        ${note ? `<div class="tl-note">${esc(note)}</div>` : ''}
        ${(mapLink || rain) ? `<div class="tl-actions">${mapLink}${rain}</div>` : ''}
        ${rainPanel}
      </div>
    </div>`;
}

function renderDay(idx) {
  const day = TRIP.days[idx];
  const num = String(idx + 1).padStart(2, '0');
  const items = day.schedule.map((it, i) => renderScheduleItem(it, idx, i)).join('');
  return `
    <div class="day-head">
      <div class="day-masthead">
        <span class="day-num">${num}</span>
        <div>
          <div class="day-kicker">${esc(day.date)} ・ ${esc(day.day)}曜日</div>
          <h2 class="day-theme">${esc(clean(day.theme))}</h2>
        </div>
      </div>
      <div class="day-photo" style="background-image:url('photos/day-${idx}.png')"></div>
      ${renderHotel(day)}
    </div>
    <div class="timeline">${items}</div>`;
}

function attachRainHandlers(container) {
  container.querySelectorAll('[data-rain]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rain;
      const panel = container.querySelector(`[data-rain-panel="${key}"]`);
      const open = panel.classList.toggle('open');
      btn.classList.toggle('open', open);
    });
  });
}

// --------------------------------------------------------------------------
//  Restaurants
// --------------------------------------------------------------------------
function renderRestaurants() {
  const cats = RESTAURANTS.categories.map((cat) => {
    const items = cat.items.map((r) => `
      <div class="rest-item">
        <div>
          <div class="rest-name">${esc(clean(r.name))}</div>
          <div class="rest-area">${esc(clean(r.area))}</div>
          <div class="rest-note">${esc(clean(r.note))}</div>
        </div>
        ${r.tabelog ? `<a class="tag-link" href="${esc(r.tabelog)}" target="_blank" rel="noopener">食べログ ↗</a>` : ''}
      </div>`).join('');
    return `
      <div class="cat">
        <div class="cat-head roomy">
          <h3 class="cat-name">${esc(clean(cat.name))}</h3>
          <div class="cat-rule"></div>
        </div>
        ${items}
      </div>`;
  }).join('');

  const hints = RESTAURANTS.hints.map((h) => `<li>${esc(clean(h))}</li>`).join('');

  return `
    <div class="panel">
      <div class="panel-kicker">GOURMET NOTES</div>
      <h2 class="panel-title">気になるお店</h2>
      <p class="panel-lead">日程に組み込んでいない「もし時間があったら行きたい」参考リストです。</p>
      ${cats}
      <div class="tips">
        <div class="tips-label">PLANNING TIPS</div>
        <div class="tips-title">プランへの組み込みヒント</div>
        <ul>${hints}</ul>
      </div>
    </div>`;
}

// --------------------------------------------------------------------------
//  Packing checklist
// --------------------------------------------------------------------------
function packStats() {
  let total = 0, done = 0;
  PACK.forEach((g) => g.items.forEach((label) => { total += 1; if (packing[label]) done += 1; }));
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

function renderPacking() {
  const { total, done, pct } = packStats();
  const groups = PACK.map((g) => {
    const rows = g.items.map((label) => `
      <button class="pack-row${packing[label] ? ' checked' : ''}" data-pack="${esc(label)}">
        <span class="pack-box"></span>
        <span class="pack-label">${esc(label)}</span>
      </button>`).join('');
    return `
      <div class="cat">
        <div class="cat-head">
          <h3 class="cat-name sm">${esc(g.name)}</h3>
          <div class="cat-rule"></div>
        </div>
        ${rows}
      </div>`;
  }).join('');

  return `
    <div class="panel">
      <div class="panel-kicker">PACKING LIST</div>
      <h2 class="panel-title">持ち物チェックリスト</h2>
      <div class="pack-progress">
        <div class="pack-bar"><div class="pack-fill" id="pack-fill" style="width:${pct}%"></div></div>
        <div class="pack-count" id="pack-count">${done} / ${total}</div>
      </div>
      ${groups}
    </div>`;
}

function attachPackHandlers(container) {
  container.querySelectorAll('[data-pack]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.pack;
      packing[label] = !packing[label];
      savePacking();
      btn.classList.toggle('checked', !!packing[label]);
      const { total, done, pct } = packStats();
      const fill = container.querySelector('#pack-fill');
      const count = container.querySelector('#pack-count');
      if (fill) fill.style.width = pct + '%';
      if (count) count.textContent = `${done} / ${total}`;
    });
  });
}

// --------------------------------------------------------------------------
//  Reservations
// --------------------------------------------------------------------------
function renderReservations() {
  const items = TRIP.reservations.map((r) => {
    const done = (r.status || '').startsWith('済');
    const meta = [r.date, r.time].filter(Boolean).join(' ');
    const note = clean(scrub(r.note));
    return `
      <div class="resv-item">
        <div class="resv-mark ${done ? 'done' : 'pending'}"></div>
        <div class="resv-body">
          <div class="resv-top">
            <div class="resv-name">${esc(clean(r.name))}</div>
            <span class="resv-status ${done ? 'done' : 'pending'}">${esc(r.status)}</span>
          </div>
          ${meta ? `<div class="resv-meta">${esc(meta)}</div>` : ''}
          ${note ? `<div class="resv-note">${esc(note)}</div>` : ''}
          ${r.url ? `<a class="resv-link" href="${esc(r.url)}" target="_blank" rel="noopener">リンク ↗</a>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="panel">
      <div class="panel-kicker">CHECKLIST</div>
      <h2 class="panel-title">予約チェックリスト</h2>
      <div class="resv-list">${items}</div>
    </div>`;
}

// --------------------------------------------------------------------------
//  Init
// --------------------------------------------------------------------------
async function init() {
  const content = document.getElementById('content');
  loadPacking();
  try {
    await loadData();
    renderHeader();
    renderTabs();
    switchTab('day-0');
  } catch (err) {
    content.innerHTML = `<div class="error">読み込みに失敗しました。ページを再読み込みしてください。（${esc(err.message)}）</div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
