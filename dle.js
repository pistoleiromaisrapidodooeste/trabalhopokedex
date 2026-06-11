/**
 * dle.js — Single JS file for all Pokédle game pages.
 * Shared utilities run on every page.
 * Game-specific blocks are gated by checking for a unique element on the page.
 */

/* ═══════════════════════════════════════════════════════
   SHARED — CONSTANTS & UTILS
═══════════════════════════════════════════════════════ */
const MAX_GUESSES = 8;
const SIL_MAX     = 6;
const POOL_SIZE   = 898;
const DAILY_POOL  = 386;

const GEN_RANGES = [
  { gen:1, min:1,   max:151  },
  { gen:2, min:152, max:251  },
  { gen:3, min:252, max:386  },
  { gen:4, min:387, max:493  },
  { gen:5, min:494, max:649  },
  { gen:6, min:650, max:721  },
  { gen:7, min:722, max:809  },
  { gen:8, min:810, max:905  },
  { gen:9, min:906, max:1025 },
];

function getGen(id)   { for (const r of GEN_RANGES) if (id >= r.min && id <= r.max) return r.gen; return 9; }
function cap(s)       { return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function todayKey()   { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function dailySeed()  { return Math.floor(Date.now() / 864e5); }
function randInt(a,b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

/* ═══════════════════════════════════════════════════════
   SHARED — DATA / CACHE
═══════════════════════════════════════════════════════ */
let allNames = [];
const enrichCache = new Map();

async function loadAllNames() {
  if (allNames.length) return;
  const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0');
  const data = await res.json();
  allNames   = data.results.map((p, i) => ({ name: p.name, id: i + 1 }));
}

async function fetchEnriched(nameOrId) {
  const key = String(nameOrId).toLowerCase();
  if (enrichCache.has(key)) return enrichCache.get(key);
  const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
  if (!pokeRes.ok) throw new Error('not found');
  const poke    = await pokeRes.json();
  const specRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${poke.id}`);
  const spec    = await specRes.json();
  const obj = {
    id:         poke.id,
    name:       poke.name,
    type1:      poke.types[0]?.type.name ?? 'none',
    type2:      poke.types[1]?.type.name ?? 'none',
    generation: getGen(poke.id),
    color:      spec.color?.name ?? '?',
    height:     poke.height,
    weight:     poke.weight,
    legendary:  spec.is_legendary || spec.is_mythical,
    sprite:     poke.sprites.other?.['official-artwork']?.front_default
                ?? poke.sprites.front_default ?? '',
  };
  enrichCache.set(key, obj);
  enrichCache.set(String(poke.id), obj);
  return obj;
}

/* ═══════════════════════════════════════════════════════
   SHARED — AUTOCOMPLETE FACTORY
═══════════════════════════════════════════════════════ */
function makeAutocomplete(inputEl, listEl, onSelect) {
  inputEl.addEventListener('input', () => {
    onSelect(null);
    const q = inputEl.value.trim().toLowerCase();
    if (q.length < 2) { listEl.setAttribute('hidden', ''); return; }
    const matches = allNames.filter(p => p.name.includes(q)).slice(0, 8);
    if (!matches.length) { listEl.setAttribute('hidden', ''); return; }
    listEl.innerHTML = matches.map(p => `
      <li class="dle-suggestion-item" role="option" data-name="${p.name}" tabindex="-1">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png"
             alt="" width="36" height="36" loading="lazy"/>
        <span>${cap(p.name)}</span>
      </li>`).join('');
    listEl.removeAttribute('hidden');
  });

  listEl.addEventListener('click', e => {
    const item = e.target.closest('.dle-suggestion-item');
    if (item) pick(item.dataset.name);
  });

  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.dle-autocomplete')) listEl.setAttribute('hidden', '');
  }, { passive: true });

  document.addEventListener('click', e => {
    if (!e.target.closest('.dle-autocomplete')) listEl.setAttribute('hidden', '');
  });

  inputEl.addEventListener('keydown', e => {
    const items = [...listEl.querySelectorAll('.dle-suggestion-item')];
    if (e.key === 'ArrowDown') { e.preventDefault(); items[0]?.focus(); }
    if (e.key === 'Escape')    listEl.setAttribute('hidden', '');
  });

  listEl.addEventListener('keydown', e => {
    const items = [...listEl.querySelectorAll('.dle-suggestion-item')];
    const idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[idx + 1]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); idx > 0 ? items[idx-1].focus() : inputEl.focus(); }
    if (e.key === 'Enter')     { e.preventDefault(); pick(document.activeElement.dataset?.name); }
  });

  function pick(name) {
    if (!name) return;
    inputEl.value = cap(name);
    listEl.setAttribute('hidden', '');
    onSelect(name);
    inputEl.blur();
  }

  function reset() {
    inputEl.value = '';
    listEl.setAttribute('hidden', '');
    onSelect(null);
  }

  return { reset };
}

/* ═══════════════════════════════════════════════════════
   SHARED — HOW TO PLAY OVERLAYS
═══════════════════════════════════════════════════════ */
document.querySelectorAll('.dle-how-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.how)?.removeAttribute('hidden');
  });
});
document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.close)?.setAttribute('hidden', '');
  });
});

/* ═══════════════════════════════════════════════════════
   SHARED — STATUS HELPERS
═══════════════════════════════════════════════════════ */
function setStatus(el, type, html) {
  el.className = `dle-status dle-status--${type}`;
  el.innerHTML = html;
  el.removeAttribute('hidden');
}
function hideStatus(el) { el.setAttribute('hidden', ''); }
function flash(el, type, msg, ms = 2500) {
  setStatus(el, type, msg);
  setTimeout(() => hideStatus(el), ms);
}

/* ═══════════════════════════════════════════════════════
   SHARED — GUESS ROW RENDERER
═══════════════════════════════════════════════════════ */
function renderRow(guess, target, boardEl) {
  function numDir(g, tv) { return g === tv ? 'correct' : g < tv ? 'higher' : 'lower'; }

  const type1R = guess.type1 === target.type1 ? 'correct'
    : (guess.type1 === target.type2 || guess.type2 === target.type1) ? 'partial' : 'wrong';
  const type2R = guess.type2 === target.type2 ? 'correct'
    : (guess.type2 !== 'none' && (guess.type2 === target.type1 || guess.type1 === target.type2)) ? 'partial' : 'wrong';
  const genR   = guess.generation === target.generation ? 'correct'
    : Math.abs(guess.generation - target.generation) <= 1 ? 'partial' : 'wrong';
  const colorR = guess.color === target.color ? 'correct' : 'wrong';
  const htR    = guess.height === target.height ? 'correct' : numDir(guess.height, target.height);
  const wtR    = guess.weight === target.weight ? 'correct' : numDir(guess.weight, target.weight);
  const legR   = guess.legendary === target.legendary ? 'correct' : 'wrong';

  const icon = { correct:'✓', partial:'~', wrong:'✕', higher:'↑', lower:'↓' };
  const cell = (r, text) =>
    `<span class="dle-cell dle-cell--${r}" title="${text}">${icon[r]}<small>${text}</small></span>`;

  const row = document.createElement('div');
  row.className = 'dle-row';
  row.innerHTML = `
    <div class="dle-row__pokemon">
      <img src="${guess.sprite}" alt="${cap(guess.name)}" width="48" height="48" loading="lazy"/>
      <span class="dle-row__name">${cap(guess.name)}</span>
    </div>
    ${cell(type1R, cap(guess.type1))}
    ${cell(type2R, guess.type2 === 'none' ? '—' : cap(guess.type2))}
    ${cell(genR,   `Gen ${guess.generation}`)}
    ${cell(colorR, cap(guess.color))}
    ${cell(htR,    (guess.height / 10).toFixed(1) + 'm')}
    ${cell(wtR,    (guess.weight / 10).toFixed(1) + 'kg')}
    ${cell(legR,   guess.legendary ? 'Sim' : 'Não')}`;

  boardEl.prepend(row);
  row.querySelectorAll('.dle-cell').forEach((c, i) => {
    c.style.animationDelay = `${i * 80}ms`;
    c.classList.add('dle-cell--animate');
  });
}

/* ═══════════════════════════════════════════════════════
   SHARED — END BANNER
═══════════════════════════════════════════════════════ */
function endBanner(won, target, guessCount, statusEl, extra = '') {
  const text = `${guessCount}/${MAX_GUESSES}`;
  if (won) {
    setStatus(statusEl, 'win',
      `🎉 Acertou em <strong>${text}</strong>! Era <strong>${cap(target.name)}</strong> #${String(target.id).padStart(3,'0')}
       <img src="${target.sprite}" class="dle-status__img" alt=""/> ${extra}`);
  } else {
    setStatus(statusEl, 'lose',
      `😔 Era <strong>${cap(target.name)}</strong> #${String(target.id).padStart(3,'0')}
       <img src="${target.sprite}" class="dle-status__img" alt=""/> ${extra}`);
  }
}

/* ═══════════════════════════════════════════════════════
   DIÁRIO GAME  (runs only on diario.html)
═══════════════════════════════════════════════════════ */
if (document.getElementById('daily-input')) (function () {
  const LS_KEY = 'pokedle_daily_v2';

  const inputEl    = document.getElementById('daily-input');
  const listEl     = document.getElementById('daily-suggestions');
  const btn        = document.getElementById('daily-guess-btn');
  const statusEl   = document.getElementById('daily-status');
  const boardEl    = document.getElementById('daily-board');
  const colsHdr    = document.getElementById('daily-cols-header');
  const alreadyEl  = document.getElementById('daily-already-played');
  const alreadyRes = document.getElementById('daily-already-result');
  const searchWrap = document.getElementById('daily-search-wrap');
  const cntdwnEl   = document.getElementById('daily-next-countdown');
  const curEl      = document.getElementById('streak-current');
  const bestEl     = document.getElementById('streak-best');
  const totalEl    = document.getElementById('streak-total');

  let target = null, guesses = [], over = false, selected = null;

  function loadState()  { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
  function saveState(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  function updateStreakUI(s) {
    curEl.textContent   = s.streak    ?? 0;
    bestEl.textContent  = s.best      ?? 0;
    totalEl.textContent = s.totalWins ?? 0;
  }

  function startCountdown() {
    function tick() {
      const now  = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      const diff = next - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      cntdwnEl.textContent = `Próximo em: ${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  const ac = makeAutocomplete(inputEl, listEl, name => {
    selected = name;
    btn.disabled = !name;
  });

  btn.addEventListener('click', submit);

  async function init() {
    const state = loadState();
    updateStreakUI(state);
    const key = todayKey();

    if (state.lastPlayed === key) {
      alreadyEl.removeAttribute('hidden');
      searchWrap.setAttribute('hidden', '');
      alreadyRes.innerHTML = state.lastWon
        ? `✅ Você acertou hoje em <strong>${state.lastGuesses}/${MAX_GUESSES}</strong>!`
        : `❌ Você não acertou. Era <strong>${cap(state.lastTarget)}</strong>.`;
      startCountdown();
      if (state.lastTargetData && state.prevGuesses?.length) {
        target = state.lastTargetData;
        colsHdr.removeAttribute('hidden');
        state.prevGuesses.forEach(g => renderRow(g, target, boardEl));
      }
      return;
    }

    setStatus(statusEl, 'info', '⏳ Carregando Pokémon do dia…');
    try {
      await loadAllNames();
      target = await fetchEnriched((dailySeed() * 7 + 13) % DAILY_POOL + 1);
      hideStatus(statusEl);
      colsHdr.removeAttribute('hidden');
    } catch {
      setStatus(statusEl, 'error', '❌ Erro ao carregar. Tente novamente.');
    }
  }

  async function submit() {
    if (!selected || over || !target) return;
    if (guesses.some(g => g.name === selected)) { flash(statusEl, 'warning', '⚠️ Você já chutou esse Pokémon!'); return; }
    btn.disabled = true; inputEl.disabled = true;
    try {
      const guess = await fetchEnriched(selected);
      guesses.push(guess);
      renderRow(guess, target, boardEl);
      const won = guess.name === target.name;
      if (won || guesses.length >= MAX_GUESSES) {
        over = true;
        const state     = loadState();
        const newStreak = won ? (state.streak ?? 0) + 1 : 0;
        const newBest   = Math.max(state.best ?? 0, newStreak);
        const newTotal  = (state.totalWins ?? 0) + (won ? 1 : 0);
        saveState({ ...state, lastPlayed: todayKey(), lastWon: won, lastGuesses: guesses.length,
          lastTarget: target.name, lastTargetData: target, prevGuesses: guesses,
          streak: newStreak, best: newBest, totalWins: newTotal });
        updateStreakUI({ streak: newStreak, best: newBest, totalWins: newTotal });
        const streakMsg = won
          ? `<br><small>🔥 Sequência: ${newStreak} dia${newStreak !== 1 ? 's' : ''}</small>`
          : '<br><small>💔 Sequência zerada</small>';
        endBanner(won, target, guesses.length, statusEl, streakMsg);
        setTimeout(() => {
          alreadyEl.removeAttribute('hidden');
          searchWrap.setAttribute('hidden', '');
          startCountdown();
          alreadyRes.innerHTML = won
            ? `✅ Você acertou hoje em <strong>${guesses.length}/${MAX_GUESSES}</strong>!`
            : `❌ Você não acertou. Era <strong>${cap(target.name)}</strong>.`;
        }, 3000);
      } else {
        ac.reset(); selected = null;
        inputEl.disabled = false; inputEl.focus();
      }
    } catch {
      flash(statusEl, 'error', '❌ Pokémon não encontrado. Tente outro!');
      inputEl.disabled = false; btn.disabled = false;
    }
  }

  init();
})();

/* ═══════════════════════════════════════════════════════
   INFINITO GAME  (runs only on infinito.html)
═══════════════════════════════════════════════════════ */
if (document.getElementById('inf-input')) (function () {
  const inputEl  = document.getElementById('inf-input');
  const listEl   = document.getElementById('inf-suggestions');
  const btn      = document.getElementById('inf-guess-btn');
  const statusEl = document.getElementById('inf-status');
  const boardEl  = document.getElementById('inf-board');
  const colsHdr  = document.getElementById('inf-cols-header');
  const newBtn   = document.getElementById('inf-new-btn');
  const winsEl   = document.getElementById('inf-wins');
  const playedEl = document.getElementById('inf-played');

  let target = null, guesses = [], over = false, selected = null;
  let wins = 0, played = 0;

  const ac = makeAutocomplete(inputEl, listEl, name => {
    selected = name;
    btn.disabled = !name;
  });

  btn.addEventListener('click', submit);
  newBtn.addEventListener('click', startGame);

  async function startGame() {
    target = null; guesses = []; over = false; selected = null;
    boardEl.innerHTML = '';
    colsHdr.setAttribute('hidden', '');
    hideStatus(statusEl);
    btn.disabled = true; inputEl.disabled = false;
    ac.reset();
    setStatus(statusEl, 'info', '⏳ Carregando Pokémon misterioso…');
    try {
      await loadAllNames();
      target = await fetchEnriched(randInt(1, POOL_SIZE));
      hideStatus(statusEl);
      colsHdr.removeAttribute('hidden');
    } catch {
      setStatus(statusEl, 'error', '❌ Erro ao carregar. Tente novamente.');
    }
  }

  async function submit() {
    if (!selected || over || !target) return;
    if (guesses.some(g => g.name === selected)) { flash(statusEl, 'warning', '⚠️ Você já chutou esse Pokémon!'); return; }
    btn.disabled = true; inputEl.disabled = true;
    try {
      const guess = await fetchEnriched(selected);
      guesses.push(guess);
      renderRow(guess, target, boardEl);
      const won = guess.name === target.name;
      if (won || guesses.length >= MAX_GUESSES) {
        over = true; played++; if (won) wins++;
        winsEl.textContent = wins; playedEl.textContent = played;
        endBanner(won, target, guesses.length, statusEl);
      } else {
        ac.reset(); selected = null;
        inputEl.disabled = false; inputEl.focus();
      }
    } catch {
      flash(statusEl, 'error', '❌ Pokémon não encontrado. Tente outro!');
      inputEl.disabled = false; btn.disabled = false;
    }
  }

  startGame();
})();

/* ═══════════════════════════════════════════════════════
   SILHUETA GAME  (runs only on silhueta.html)
═══════════════════════════════════════════════════════ */
if (document.getElementById('sil-input')) (function () {
  const inputEl    = document.getElementById('sil-input');
  const listEl     = document.getElementById('sil-suggestions');
  const btn        = document.getElementById('sil-guess-btn');
  const statusEl   = document.getElementById('sil-status');
  const newBtn     = document.getElementById('sil-new-btn');
  const imgEl      = document.getElementById('sil-image');
  const attemptsEl = document.getElementById('sil-attempts');
  const hintType   = document.getElementById('sil-hint-type');
  const hintGen    = document.getElementById('sil-hint-gen');
  const hintLetter = document.getElementById('sil-hint-letter');
  const winsEl     = document.getElementById('sil-wins');
  const playedEl   = document.getElementById('sil-played');

  let target = null, guesses = 0, over = false, selected = null;
  let wins = 0, played = 0, won = false;

  const FILTERS = [
    'brightness(0)',
    'brightness(0)',
    'brightness(0.15) saturate(0)',
    'brightness(0.35) saturate(0)',
    'brightness(0.6)  saturate(0.3)',
    'brightness(0.85) saturate(0.6)',
    'brightness(1)    saturate(1)',
  ];

  const ac = makeAutocomplete(inputEl, listEl, name => {
    selected = name;
    btn.disabled = !name;
  });

  btn.addEventListener('click', submit);
  newBtn.addEventListener('click', startGame);

  function setFilter(idx) { imgEl.style.filter = FILTERS[Math.min(idx, FILTERS.length - 1)]; }

  function updateDots() {
    attemptsEl.innerHTML = Array.from({ length: SIL_MAX }, (_, i) => {
      let cls = 'sil-dot';
      if (i < guesses) cls += won ? ' sil-dot--used' : (over ? ' sil-dot--wrong' : ' sil-dot--used');
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  function showHints() {
    if (guesses >= 1) { hintType.textContent = `Tipo: ${cap(target.type1)}${target.type2 !== 'none' ? ' / ' + cap(target.type2) : ''}`; hintType.removeAttribute('hidden'); }
    if (guesses >= 2) { hintGen.textContent = `Geração: ${target.generation}`; hintGen.removeAttribute('hidden'); }
    if (guesses >= 3) { hintLetter.textContent = `Começa com: ${cap(target.name)[0]}`; hintLetter.removeAttribute('hidden'); }
  }

  async function startGame() {
    target = null; guesses = 0; over = false; selected = null; won = false;
    hideStatus(statusEl);
    imgEl.src = ''; imgEl.style.filter = FILTERS[0]; imgEl.style.transition = '';
    hintType.setAttribute('hidden', ''); hintGen.setAttribute('hidden', ''); hintLetter.setAttribute('hidden', '');
    attemptsEl.innerHTML = '';
    ac.reset(); btn.disabled = true; inputEl.disabled = false;
    setStatus(statusEl, 'info', '⏳ Carregando Pokémon…');
    try {
      await loadAllNames();
      target = await fetchEnriched(randInt(1, POOL_SIZE));
      imgEl.src = target.sprite;
      imgEl.onload = () => { setFilter(0); updateDots(); };
      hideStatus(statusEl);
    } catch {
      setStatus(statusEl, 'error', '❌ Erro ao carregar. Tente novamente.');
    }
  }

  async function submit() {
    if (!selected || over || !target) return;
    btn.disabled = true; inputEl.disabled = true;
    try {
      const guess = await fetchEnriched(selected);
      guesses++; showHints(); setFilter(guesses); updateDots();
      if (guess.name === target.name) {
        over = true; won = true; wins++; played++;
        imgEl.style.transition = 'filter 0.8s ease'; setFilter(6);
        winsEl.textContent = wins; playedEl.textContent = played;
        setStatus(statusEl, 'win', `🎉 É <strong>${cap(target.name)}</strong>! Acertou em ${guesses}/${SIL_MAX} tentativa${guesses !== 1 ? 's' : ''}!`);
      } else if (guesses >= SIL_MAX) {
        over = true; played++;
        imgEl.style.transition = 'filter 0.8s ease'; setFilter(6);
        winsEl.textContent = wins; playedEl.textContent = played;
        setStatus(statusEl, 'lose', `😔 Era <strong>${cap(target.name)}</strong>! <img src="${target.sprite}" class="dle-status__img" alt=""/>`);
      } else {
        flash(statusEl, 'warning', `❌ Não é ${cap(guess.name)}! Tente novamente.`, 2000);
        ac.reset(); selected = null; inputEl.disabled = false; inputEl.focus();
      }
    } catch {
      flash(statusEl, 'error', '❌ Pokémon não encontrado. Tente outro!');
      inputEl.disabled = false; btn.disabled = false;
    }
  }

  startGame();
})();
