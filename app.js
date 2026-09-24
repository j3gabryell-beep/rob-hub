'use strict';
const APP_VERSION = '0.6.0';
const WHATSAPP = '5581997932766';           // número que recebe os relatos (55 + DDD + número)
const DATASETS = {
  'yaskawa-dx100': 'yaskawa-dx100.json',
  'comau-c5g': 'comau-c5g.json'
};
const REPORTS_FILE = 'relatos.json';       // relatos aprovados: { "comau-c5g:59424": [ {nome, data, texto} ] }

const T = {
  pt: {
    mCode: 'Código', mKw: 'Palavras-chave', tabResults: 'Buscar', tabFavs: 'Favoritos', tabRecent: 'Recentes',
    phCode: 'Código do alarme', phKw: 'Ex.: encoder, bateria, colisão',
    loading: 'Carregando…', loadError: 'Não foi possível carregar a base. Abra o app uma vez com internet.',
    results: n => n === 1 ? '1 alarme' : `${n} alarmes`, showing: (a, b) => `mostrando ${a} de ${b} — refine a busca`,
    none: 'Nenhum alarme encontrado.', noFavs: 'Nenhum favorito ainda. Toque na estrela dentro de um alarme.',
    noRecent: 'Nenhum alarme aberto ainda.',
    major: 'GRAVE', minor: 'LEVE', io: 'I/O',
    reset: { major: 'Alarme grave: desligue e religue a alimentação principal depois de corrigir a causa.',
             minor: 'Alarme leve: depois de corrigir a causa, dá para resetar (RESET na tela ALARM).',
             io: 'Alarme de I/O: resetável depois que o sinal de entrada for desligado.' },
    level: 'Nível', sub: 'Subcódigo', subAll: 'Todos os subcódigos', meaning: 'Significado',
    cause: 'Causa', remedy: 'Solução', noDetail: 'O manual do fabricante não traz detalhes para este alarme.',
    page: p => `Manual, pág. ${p}`,
    note: 'Tradução livre do manual do fabricante, para referência. Siga sempre os procedimentos de segurança e a documentação oficial. Toque em EN para ver o texto original.',
    noteOrig: 'Texto do manual do fabricante (versão em português), para referência. Siga sempre os procedimentos de segurança e a documentação oficial.',
    offline: 'Funciona offline', back: 'Voltar',
    wTitleCode: 'Digite o código do alarme', wTextCode: 'O ROB HUB procura em todos os controladores e mostra de qual robô é o alarme.',
    wTitleKw: 'Busque por palavras-chave', wTextKw: 'Descreva o problema com uma ou mais palavras. A busca é feita em todos os controladores.',
    wStat: (n, k) => `${n} alarmes · ${k} controladores · offline`, wStat1: n => `${n} alarmes · offline`,
    onlyDigits: 'Aqui a busca é só pelo número do alarme. Para buscar por texto, use a aba Palavras-chave.',
    dDetails: 'Detalhes', dReports: 'Relatos',
    repTitle: 'Relatos de campo', repNone: 'Ainda não há relatos aprovados para este alarme.',
    repNew: 'Enviar um relato', repName: 'Seu nome', repText: 'Onde estava o problema? O que resolveu?',
    repSend: 'Enviar pelo WhatsApp', repHelp: 'O relato é enviado para avaliação. Depois de aprovado, ele aparece aqui para todos.',
    repMsg: 'ROB HUB · Relato de alarme'
  },
  en: {
    mCode: 'Code', mKw: 'Keywords', tabResults: 'Search', tabFavs: 'Favorites', tabRecent: 'Recent',
    phCode: 'Alarm code', phKw: 'e.g. encoder, battery, collision',
    loading: 'Loading…', loadError: 'Could not load the database. Open the app once while online.',
    results: n => n === 1 ? '1 alarm' : `${n} alarms`, showing: (a, b) => `showing ${a} of ${b} — refine your search`,
    none: 'No alarms found.', noFavs: 'No favorites yet. Tap the star inside an alarm.',
    noRecent: 'No alarms opened yet.',
    major: 'MAJOR', minor: 'MINOR', io: 'I/O',
    reset: { major: 'Major alarm: turn the main power OFF and back ON after fixing the cause.',
             minor: 'Minor alarm: after fixing the cause, clear it with RESET on the ALARM screen.',
             io: 'I/O alarm: can be reset once the input signal is cleared.' },
    level: 'Level', sub: 'Sub code', subAll: 'All sub codes', meaning: 'Meaning',
    cause: 'Cause', remedy: 'Remedy', noDetail: 'The manufacturer manual gives no details for this alarm.',
    page: p => `Manual, p. ${p}`,
    note: 'Technical text extracted from the manufacturer manual, for reference. Always follow safety procedures and official documentation.',
    noteOrig: 'Text from the manufacturer manual (Portuguese edition only), for reference. Always follow safety procedures and official documentation.',
    offline: 'Works offline', back: 'Back',
    wTitleCode: 'Type the alarm code', wTextCode: 'ROB HUB searches every controller and tells you which robot the alarm belongs to.',
    wTitleKw: 'Search by keywords', wTextKw: 'Describe the problem with one or more words. Every controller is searched.',
    wStat: (n, k) => `${n} alarms · ${k} controllers · offline`, wStat1: n => `${n} alarms · offline`,
    onlyDigits: 'This tab searches by alarm number only. To search by text, use the Keywords tab.',
    dDetails: 'Details', dReports: 'Field reports',
    repTitle: 'Field reports', repNone: 'No approved reports for this alarm yet.',
    repNew: 'Send a report', repName: 'Your name', repText: 'Where was the problem? What fixed it?',
    repSend: 'Send via WhatsApp', repHelp: 'Your report is sent for review. Once approved, it shows up here for everyone.',
    repMsg: 'ROB HUB · Alarm report'
  }
};

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let lang = store.get('lang', (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
let mode = store.get('mode', 'code');
let tab = 'results';
let detailTab = 'details';
const DB = {};                 // ctrl -> dataset
let INDEX = [];                // { k, db, a, name, body }
let REPORTS = {};
const t = k => T[lang][k];
const PT = () => lang === 'pt';
const fmt = n => n.toLocaleString(PT() ? 'pt-BR' : 'en-US');

/* ---------- severity helpers (per dataset) ---------- */
const lvInfo = (db, l) => db.levels && db.levels[l];
const sev = (db, l) => { const i = lvInfo(db, l); return i ? i.cls : (l <= 3 ? 'major' : l <= 8 ? 'minor' : 'io'); };
const badge = (db, l) => { const i = lvInfo(db, l); return i ? i[lang] : t(sev(db, l)); };
const resetTxt = (db, l) => { const i = lvInfo(db, l); return i ? (PT() ? i.rpt : i.ren) : T[lang].reset[sev(db, l)]; };
const mean = s => (PT() && s.mp) || s.m;
const cz = k => (PT() && k[2]) || k[0];
const rem = k => (PT() && k[3]) || k[1];

/* ---------- favorites / recents (global, "ctrl:code") ---------- */
function migrate() {
  if (store.get('migrated05', false)) return;
  for (const k of Object.keys(DATASETS)) {
    const f = store.get('favs:' + k, []), r = store.get('recent:' + k, []);
    store.set('favs', [...store.get('favs', []), ...f.map(c => k + ':' + c)]);
    store.set('recent', [...store.get('recent', []), ...r.map(c => k + ':' + c)]);
  }
  store.set('migrated05', true);
}
const findRef = ref => { const [k, c] = ref.split(':'); const db = DB[k]; const a = db && db.alarms.find(x => x.c === c); return a ? { k, db, a } : null; };

/* ---------- loading ---------- */
async function loadAll() {
  $('#count').textContent = t('loading');
  const errs = [];
  await Promise.all(Object.entries(DATASETS).map(async ([k, url]) => {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      DB[k] = await r.json();
    } catch (e) { errs.push(url + ' — ' + e.message); }
  }));
  try { const r = await fetch(REPORTS_FILE, { cache: 'no-cache' }); if (r.ok) REPORTS = await r.json(); } catch {}
  INDEX = [];
  for (const [k, db] of Object.entries(DB)) for (const a of db.alarms) INDEX.push({
    k, db, a, name: norm(a.n + ' ' + (a.np || '')),
    body: norm(a.s.map(s => [s.s, s.m, s.mp, ...s.k.flat()].join(' ')).join(' '))
  });
  if (!INDEX.length) {
    $('#count').textContent = '';
    $('#list').innerHTML = `<li class="empty">${esc(t('loadError'))}<br><small>${esc(errs.join(' · '))}</small></li>`;
    return;
  }
  migrate(); applyLang(); route();
}

/* ---------- search ---------- */
function search(q) {
  q = norm(q).trim();
  const pool = INDEX;
  if (mode === 'code') {
    const m = q.match(/^(\d{1,6})(?:\s*[-/ ]\s*(\d+))?$/);
    if (!m) return [];
    const pad = m[1].padStart(4, '0');
    const isExact = c => c === m[1] || c === pad;
    return [...pool.filter(x => isExact(x.a.c)), ...pool.filter(x => !isExact(x.a.c) && x.a.c.startsWith(m[1]))];
  }
  const toks = q.split(/\s+/).filter(Boolean), hits = [];
  for (const x of pool) {
    let score = 0, ok = true;
    for (const tk of toks) {
      if (x.name.includes(tk)) score += 10; else if (x.body.includes(tk)) score += 1; else { ok = false; break; }
    }
    if (ok) hits.push([score, x]);
  }
  return hits.sort((a, b) => b[0] - a[0] || a[1].a.c.localeCompare(b[1].a.c)).map(h => h[1]);
}

function hint(a) {
  if (PT() && a.np) return a.np;
  const s = a.s.find(s => s.m) || a.s[0];
  return s ? (mean(s) || (s.k[0] && cz(s.k[0])) || '') : '';
}
const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function itemHTML(x, showTag) {
  const v = sev(x.db, x.a.l);
  return `<li class="item" data-ref="${x.k}:${esc(x.a.c)}"><span class="dot ${v}"></span><span class="code">${esc(x.a.c)}</span>
    <span class="name">${esc(x.a.n)}<span class="hint">${esc(hint(x.a))}</span></span>
    ${showTag ? `<span class="tag">${esc(x.db.controller)}</span>` : ''}${CHEV}</li>`;
}

/* ---------- list view ---------- */
function renderList() {
  const list = $('#list');
  list.classList.remove('plain');
  let arr, emptyMsg = t('none'), tagAll = true;
  if (tab === 'favs' || tab === 'recent') {
    arr = store.get(tab === 'favs' ? 'favs' : 'recent', []).map(findRef).filter(Boolean);
    emptyMsg = tab === 'favs' ? t('noFavs') : t('noRecent'); tagAll = true;
    $('#count').textContent = '';
  } else {
    if (!$('#q').value.trim()) {
      $('#count').textContent = '';
      list.classList.add('plain');
      const code = mode === 'code';
      const ex = code ? ['4100', '59424', '1325', '40001'] : (PT() ? ['encoder', 'bateria', 'colisão', 'fusível'] : ['encoder', 'battery', 'collision', 'fuse']);
      list.innerHTML = `<li class="welcome"><div class="w-title">${esc(code ? t('wTitleCode') : t('wTitleKw'))}</div>
        <p>${esc(code ? t('wTextCode') : t('wTextKw'))}</p>
        <div class="examples">${ex.map(x => `<button class="ex" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <div class="w-stat">${esc(t('wStat')(fmt(INDEX.length), Object.keys(DB).length))}</div></li>`;
      return;
    }
    arr = search($('#q').value);
    if (mode === 'code' && !/^\s*\d/.test($('#q').value)) emptyMsg = t('onlyDigits');
  }
  const LIMIT = 150, shown = arr.slice(0, LIMIT);
  if (tab === 'results') $('#count').textContent = arr.length > LIMIT ? t('showing')(LIMIT, arr.length) : t('results')(arr.length);
  list.innerHTML = shown.length ? shown.map(x => itemHTML(x, tagAll)).join('') : `<li class="empty">${esc(emptyMsg)}</li>`;
}

/* ---------- detail view ---------- */
const STAR = on => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const WA_ICO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>';

function renderDetail(k, code, subSel) {
  const db = DB[k], a = db && db.alarms.find(x => x.c === code);
  if (!a) { location.hash = ''; return; }
  const ref = k + ':' + code;
  const rec = store.get('recent', []).filter(r => r !== ref); rec.unshift(ref); store.set('recent', rec.slice(0, 40));
  const isFav = store.get('favs', []).includes(ref), v = sev(db, a.l);
  const reports = REPORTS[ref] || [];
  let h = `<section class="hero">
    <div class="hero-top"><span class="code">${esc(a.c)}</span><span class="pill ${v}">${esc(badge(db, a.l))}</span>
      <button class="fav${isFav ? ' on' : ''}" id="fav" aria-pressed="${isFav}">${STAR(isFav)}</button></div>
    <h1>${esc(a.n)}</h1>${PT() && a.np ? `<p class="np">${esc(a.np)}</p>` : ''}
    <p class="meta">${esc(db.brand)} · ${esc(db.controller)} · ${esc(t('level'))} ${a.l}${a.p ? ' · ' + esc(t('page')(a.p)) : ''}</p>
    <div class="reset ${v}"><span>${esc(resetTxt(db, a.l))}</span></div></section>
    <div class="seg dtabs"><button data-dt="details" class="${detailTab === 'details' ? 'active' : ''}">${esc(t('dDetails'))}</button>
      <button data-dt="reports" class="${detailTab === 'reports' ? 'active' : ''}">${esc(t('dReports'))}${reports.length ? `<span class="badge-n">${reports.length}</span>` : ''}</button></div>`;

  if (detailTab === 'details') {
    const numbered = a.s.filter(s => s.s);
    const subs = subSel && numbered.some(s => s.s === subSel) ? a.s.filter(s => s.s === subSel) : a.s;
    if (numbered.length > 3) {
      h += `<select class="subfilter" id="subsel"><option value="">${esc(t('subAll'))} (${numbered.length})</option>` +
        numbered.map(s => `<option value="${esc(s.s)}"${s.s === subSel ? ' selected' : ''}>${esc(t('sub'))} ${esc(s.s)} — ${esc(mean(s).slice(0, 50))}</option>`).join('') + `</select>`;
    }
    if (!a.s.length) h += `<div class="card"><p class="remedy">${esc(t('noDetail'))}</p></div>`;
    for (const s of subs) {
      h += `<div class="card">${s.s ? `<h2>${esc(t('sub'))} ${esc(s.s)}</h2>` : ''}
        ${s.m ? `<p class="lbl">${esc(t('meaning'))}</p><p class="meaning">${esc(mean(s))}</p>` : ''}
        ${s.k.map(x => `<div class="cause">${cz(x) ? `<p class="lbl">${esc(t('cause'))}</p><p class="cz">${esc(cz(x))}</p>` : ''}${rem(x) ? `<p class="lbl">${esc(t('remedy'))}</p><p class="remedy">${esc(rem(x))}</p>` : ''}</div>`).join('')}</div>`;
    }
    h += `<p class="note">${esc(db.lang === 'pt' ? t('noteOrig') : t('note'))}</p>`;
  } else {
    h += `<div class="card"><h2>${esc(t('repTitle'))}</h2>` +
      (reports.length ? reports.map(r => `<div class="report"><div class="who">${esc(r.nome)}<span class="when">${esc(r.data || '')}</span></div><p>${esc(r.texto)}</p></div>`).join('')
        : `<p class="remedy" style="color:var(--muted)">${esc(t('repNone'))}</p>`) + `</div>
      <div class="card form"><h2>${esc(t('repNew'))}</h2>
        <label for="rname">${esc(t('repName'))}</label><input id="rname" maxlength="60" autocomplete="name" value="${esc(store.get('repName', ''))}">
        <label for="rtext">${esc(t('repText'))}</label><textarea id="rtext" maxlength="1500"></textarea>
        <button class="btn" id="rsend" disabled>${WA_ICO}${esc(t('repSend'))}</button>
        <p class="help">${esc(t('repHelp'))}</p></div>`;
  }
  $('#view-detail').innerHTML = h;

  $('#fav').onclick = () => {
    let f = store.get('favs', []);
    f = f.includes(ref) ? f.filter(r => r !== ref) : [ref, ...f];
    store.set('favs', f); renderDetail(k, code, subSel);
  };
  document.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => { detailTab = b.dataset.dt; renderDetail(k, code, subSel); });
  const ss = $('#subsel');
  if (ss) ss.onchange = () => location.replace(`#/a/${k}/${code}` + (ss.value ? '/' + ss.value : ''));
  const rn = $('#rname'), rt = $('#rtext'), rs = $('#rsend');
  if (rs) {
    const upd = () => { rs.disabled = !(rn.value.trim() && rt.value.trim().length >= 5); };
    rn.oninput = upd; rt.oninput = upd;
    rs.onclick = () => {
      store.set('repName', rn.value.trim());
      const msg = `${t('repMsg')}\n` +
        `Controlador: ${db.brand} ${db.controller}\n` +
        `Alarme: ${a.c}${subSel ? '-' + subSel : ''} — ${a.n}\n` +
        `Nome: ${rn.value.trim()}\n\nRelato:\n${rt.value.trim()}`;
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
    };
  }
}

/* ---------- routing ---------- */
function route() {
  if (!INDEX.length) return;
  const m = location.hash.match(/^#\/a\/([a-z0-9-]+)\/(\d+)(?:\/(\d+))?/);
  const detail = !!(m && DB[m[1]]);
  $('#view-search').hidden = detail; $('#view-detail').hidden = !detail; $('#back').hidden = !detail;
  $('#title').textContent = detail ? `${DB[m[1]].controller} · ${m[2]}` : 'ROB HUB';
  document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#q').placeholder = mode === 'code' ? t('phCode') : t('phKw');
  $('#q').setAttribute('inputmode', mode === 'code' ? 'numeric' : 'search');
  $('#clear').hidden = !$('#q').value;
  if (detail) { renderDetail(m[1], m[2], m[3]); window.scrollTo(0, 0); }
  else renderList();
}

function applyLang() {
  document.documentElement.lang = PT() ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  $('#lang').textContent = PT() ? 'EN' : 'PT';
  $('#back').setAttribute('aria-label', t('back'));
  $('#foot').textContent = `ROB HUB v${APP_VERSION} · ${t('offline')}`;
}

/* ---------- events ---------- */
let fromList = false, pendingNav = null;
const go = ref => { const [k, c] = ref.split(':'); const q = $('#q').value.match(/^\s*\d{1,6}\s*[-/ ]\s*(\d+)\s*$/);
  detailTab = 'details'; pendingNav = `#/a/${k}/${c}` + (q && tab === 'results' ? '/' + q[1] : ''); location.hash = pendingNav; };
$('#q').addEventListener('input', () => { $('#clear').hidden = !$('#q').value; if (tab !== 'results') setTab('results'); else renderList(); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = search($('#q').value); if (r.length === 1) go(r[0].k + ':' + r[0].a.c); $('#q').blur(); } });
$('#clear').onclick = () => { $('#q').value = ''; $('#clear').hidden = true; renderList(); $('#q').focus(); };
$('#list').addEventListener('click', e => {
  const ex = e.target.closest('.ex');
  if (ex) { $('#q').value = ex.dataset.q; $('#clear').hidden = false; renderList(); return; }
  const li = e.target.closest('.item'); if (li) go(li.dataset.ref);
});
function setTab(name) {
  tab = name;
  if (location.hash) location.hash = '';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  renderList();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
document.querySelectorAll('#mode button').forEach(b => b.onclick = () => {
  if (mode === b.dataset.mode && tab === 'results') { $('#q').focus(); return; }
  mode = b.dataset.mode; store.set('mode', mode); $('#q').value = '';
  if (tab !== 'results') setTab('results'); route(); $('#q').focus();
});
$('#back').onclick = () => { if (fromList) { fromList = false; history.back(); } else location.hash = ''; };
$('#lang').onclick = () => { lang = PT() ? 'en' : 'pt'; store.set('lang', lang); applyLang(); route(); };
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/a/')) fromList = location.hash === pendingNav; pendingNav = null; route(); });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
applyLang();
loadAll();
