'use strict';
const APP_VERSION = '0.1.1';
const DATASETS = { 'yaskawa-dx100': 'yaskawa-dx100.json' };

const T = {
  pt: {
    controller: 'Controlador', tabResults: 'Resultados', tabFavs: 'Favoritos', tabRecent: 'Recentes',
    placeholder: 'Código ou palavra (ex.: 4100, encoder)',
    loading: 'Carregando base…', loadError: 'Não foi possível carregar a base. Abra o app uma vez com internet.',
    results: n => n === 1 ? '1 alarme' : `${n} alarmes`, showing: (a, b) => `mostrando ${a} de ${b} — refine a busca`,
    none: 'Nenhum alarme encontrado.', noFavs: 'Nenhum favorito ainda. Toque na estrela dentro de um alarme.',
    noRecent: 'Nenhum alarme aberto ainda.',
    major: 'GRAVE', minor: 'LEVE', io: 'I/O',
    reset: { major: 'Alarme grave: desligue e religue a alimentação principal depois de corrigir a causa.',
             minor: 'Alarme leve: depois de corrigir a causa, dá para resetar (RESET na tela ALARM).',
             io: 'Alarme de I/O: resetável depois que o sinal de entrada for desligado.' },
    level: 'Nível', sub: 'Subcódigo', subAll: 'Todos os subcódigos', meaning: 'Significado',
    cause: 'Causa', remedy: 'Solução', noDetail: 'O manual do fabricante não traz detalhes para este alarme.',
    page: p => `Manual, pág. ${p} do PDF`,
    note: 'Texto técnico em inglês extraído do manual do fabricante, para referência. Siga sempre os procedimentos de segurança e a documentação oficial.',
    offline: 'Funciona offline', back: 'Voltar'
  },
  en: {
    controller: 'Controller', tabResults: 'Results', tabFavs: 'Favorites', tabRecent: 'Recent',
    placeholder: 'Code or keyword (e.g. 4100, encoder)',
    loading: 'Loading database…', loadError: 'Could not load the database. Open the app once while online.',
    results: n => n === 1 ? '1 alarm' : `${n} alarms`, showing: (a, b) => `showing ${a} of ${b} — refine your search`,
    none: 'No alarms found.', noFavs: 'No favorites yet. Tap the star inside an alarm.',
    noRecent: 'No alarms opened yet.',
    major: 'MAJOR', minor: 'MINOR', io: 'I/O',
    reset: { major: 'Major alarm: turn the main power OFF and back ON after fixing the cause.',
             minor: 'Minor alarm: after fixing the cause, clear it with RESET on the ALARM screen.',
             io: 'I/O alarm: can be reset once the input signal is cleared.' },
    level: 'Level', sub: 'Sub code', subAll: 'All sub codes', meaning: 'Meaning',
    cause: 'Cause', remedy: 'Remedy', noDetail: 'The manufacturer manual gives no details for this alarm.',
    page: p => `Manual, PDF page ${p}`,
    note: 'Technical text extracted from the manufacturer manual, for reference. Always follow safety procedures and official documentation.',
    offline: 'Works offline', back: 'Back'
  }
};

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

let lang = store.get('lang', (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
let ctrl = store.get('ctrl', 'yaskawa-dx100');
let tab = 'results';
let db = null, index = [];
const t = k => T[lang][k];
const sev = l => l <= 3 ? 'major' : l <= 8 ? 'minor' : 'io';
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const favKey = () => 'favs:' + ctrl, recKey = () => 'recent:' + ctrl;

function applyLang() {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  $('#q').placeholder = t('placeholder');
  $('#lang').textContent = lang === 'pt' ? 'EN' : 'PT';
  $('#back').setAttribute('aria-label', t('back'));
  $('#foot').textContent = `ROB HUB v${APP_VERSION} · ${t('offline')}` + (db ? ` · ${db.source}` : '');
}

async function load() {
  $('#count').textContent = t('loading');
  try {
    const r = await fetch(DATASETS[ctrl], { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    db = await r.json();
    index = db.alarms.map(a => ({
      a, name: norm(a.n),
      body: norm(a.s.map(s => [s.s, s.m, ...s.k.flat()].join(' ')).join(' '))
    }));
    applyLang(); route();
  } catch (e) {
    $('#count').textContent = '';
    $('#list').innerHTML = `<li class="empty" style="color:var(--major)">${esc(t('loadError'))}<br><small>${esc(DATASETS[ctrl])} — ${esc(e.message)}</small></li>`;
  }
}

function search(q) {
  q = norm(q).trim();
  if (!q) return index.map(x => x.a);
  const m = q.match(/^(\d{1,4})(?:\s*[-/ ]\s*(\d+))?$/);
  if (m) {
    const pad = m[1].padStart(4, '0');
    const exact = index.filter(x => x.a.c === pad).map(x => x.a);
    const pref = index.filter(x => x.a.c !== pad && x.a.c.startsWith(m[1])).map(x => x.a);
    return [...exact, ...pref];
  }
  const toks = q.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const x of index) {
    let score = 0, ok = true;
    for (const tk of toks) {
      if (x.name.includes(tk)) score += 10;
      else if (x.body.includes(tk)) score += 1;
      else { ok = false; break; }
    }
    if (ok) hits.push([score, x.a]);
  }
  return hits.sort((a, b) => b[0] - a[0] || a[1].c.localeCompare(b[1].c)).map(h => h[1]);
}

function hint(a) {
  const s = a.s.find(s => s.m) || a.s[0];
  if (!s) return '';
  const txt = s.m || (s.k[0] && s.k[0][0]) || '';
  return txt.length > 90 ? txt.slice(0, 88) + '…' : txt;
}

function itemHTML(a) {
  const v = sev(a.l);
  return `<li class="item" data-code="${a.c}"><span class="code">${a.c}</span>
    <span class="name">${esc(a.n)}<span class="hint">${esc(hint(a))}</span></span>
    <span class="badge b-${v}">${t(v)}</span></li>`;
}

function renderList() {
  if (!db) return;
  let arr, emptyMsg = t('none');
  if (tab === 'favs') { const f = store.get(favKey(), []); arr = f.map(c => db.alarms.find(a => a.c === c)).filter(Boolean); emptyMsg = t('noFavs'); }
  else if (tab === 'recent') { const r = store.get(recKey(), []); arr = r.map(c => db.alarms.find(a => a.c === c)).filter(Boolean); emptyMsg = t('noRecent'); }
  else arr = search($('#q').value);
  const LIMIT = 150, shown = arr.slice(0, LIMIT);
  $('#count').textContent = tab === 'results'
    ? (arr.length > LIMIT ? t('showing')(LIMIT, arr.length) : t('results')(arr.length)) : '';
  $('#list').innerHTML = shown.length ? shown.map(itemHTML).join('') : `<li class="empty">${esc(emptyMsg)}</li>`;
}

function renderDetail(code, subSel) {
  const a = db.alarms.find(x => x.c === code);
  if (!a) { location.hash = ''; return; }
  const rec = store.get(recKey(), []).filter(c => c !== code); rec.unshift(code); store.set(recKey(), rec.slice(0, 30));
  const favs = store.get(favKey(), []), isFav = favs.includes(code), v = sev(a.l);
  const subs = subSel ? a.s.filter(s => s.s === subSel) : a.s;
  let h = `<section class="hero">
    <div class="row"><span class="code">${a.c}</span><span class="badge b-${v}">${t(v)} · ${t('level')} ${a.l}</span>
    <button class="fav" id="fav" aria-pressed="${isFav}">${isFav ? '★' : '☆'}</button></div>
    <h1>${esc(a.n)}</h1>
    <div class="reset ${v}">${esc(T[lang].reset[v])}</div>
    <p class="muted">${esc(db.brand)} · ${esc(db.controller)} · ${esc(t('page')(a.p))}</p></section>`;
  const numbered = a.s.filter(s => s.s);
  if (numbered.length > 3) {
    h += `<div class="subfilter"><select id="subsel"><option value="">${t('subAll')} (${numbered.length})</option>` +
      numbered.map(s => `<option value="${esc(s.s)}"${s.s === subSel ? ' selected' : ''}>${t('sub')} ${esc(s.s)} — ${esc(s.m.slice(0, 50))}</option>`).join('') +
      `</select></div>`;
  }
  if (!a.s.length) h += `<div class="sub"><p>${esc(t('noDetail'))}</p></div>`;
  for (const s of subs) {
    h += `<div class="sub">${s.s ? `<h2>${t('sub')} ${esc(s.s)}</h2>` : ''}
      ${s.m ? `<p class="meaning"><b>${t('meaning')}:</b> ${esc(s.m)}</p>` : ''}
      ${s.k.map(k => `<div class="cause"><b>${t('cause')}: ${esc(k[0])}</b><div class="remedy">${esc(k[1])}</div></div>`).join('')}</div>`;
  }
  h += `<p class="note">${esc(t('note'))}</p>`;
  const view = $('#view-detail');
  view.innerHTML = h;
  $('#fav').onclick = () => {
    let f = store.get(favKey(), []);
    f = f.includes(code) ? f.filter(c => c !== code) : [code, ...f];
    store.set(favKey(), f); renderDetail(code, subSel);
  };
  const ss = $('#subsel');
  if (ss) ss.onchange = () => { location.replace('#/a/' + code + (ss.value ? '/' + ss.value : '')); };
}

function route() {
  if (!db) return;
  const m = location.hash.match(/^#\/a\/(\d{4})(?:\/(\d+))?/);
  const detail = !!m;
  $('#view-search').hidden = detail; $('#view-detail').hidden = !detail; $('#back').hidden = !detail;
  $('#title').textContent = detail ? `${db.controller} · ${m[1]}` : 'ROB HUB';
  if (detail) { renderDetail(m[1], m[2]); window.scrollTo(0, 0); }
  else renderList();
}

$('#q').addEventListener('input', () => { if (tab !== 'results') setTab('results'); else renderList(); });
$('#q').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const r = search($('#q').value); if (r.length === 1) location.hash = pendingNav = '#/a/' + r[0].c; $('#q').blur(); }
});
$('#list').addEventListener('click', e => {
  const li = e.target.closest('.item'); if (!li) return;
  const q = $('#q').value.match(/^\s*\d{1,4}\s*[-/ ]\s*(\d+)\s*$/);
  pendingNav = '#/a/' + li.dataset.code + (q && tab === 'results' ? '/' + q[1] : '');
  location.hash = pendingNav;
});
function setTab(name) {
  tab = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  renderList();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
let fromList = false, pendingNav = null;
$('#back').onclick = () => { if (fromList) { fromList = false; history.back(); } else location.hash = ''; };
$('#lang').onclick = () => { lang = lang === 'pt' ? 'en' : 'pt'; store.set('lang', lang); applyLang(); route(); };
$('#ctrl').value = ctrl;
$('#ctrl').onchange = e => { ctrl = e.target.value; store.set('ctrl', ctrl); load(); };
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/a/')) fromList = location.hash === pendingNav; pendingNav = null; route(); });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
applyLang();
load();
