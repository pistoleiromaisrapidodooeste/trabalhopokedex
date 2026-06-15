const API_BASE = 'https://pokeapi.co/api/v2';
const INITIAL_LIMIT = 40;   
const LOAD_MORE_LIMIT = 40; 

const TYPE_COLORS = {
  normal:   '#9a9a7a',
  fire:     '#f08030',
  water:    '#6890f0',
  electric: '#f8d030',
  grass:    '#78c850',
  ice:      '#98d8d8',
  fighting: '#c03028',
  poison:   '#a040a0',
  ground:   '#e0c068',
  flying:   '#a890f0',
  psychic:  '#f85888',
  bug:      '#a8b820',
  rock:     '#b8a038',
  ghost:    '#705898',
  dragon:   '#7038f8',
  dark:     '#705848',
  steel:    '#b8b8d0',
  fairy:    '#f0b6bc',
};

const STAT_LABELS = {
  hp:              'HP',
  attack:          'Ataque',
  defense:         'Defesa',
  'special-attack': 'Sp. Atk',
  'special-defense':'Sp. Def',
  speed:           'Velocidade',
};

const STAT_COLORS = {
  hp:              '#ff5959',
  attack:          '#f5ac78',
  defense:         '#fae078',
  'special-attack': '#9db7f5',
  'special-defense':'#a7db8d',
  speed:           '#fa92b2',
};

/* ──────────────────────────────────────────────────────────────
   ESTADO
────────────────────────────────────────────────────────────── */
let currentOffset = 0;
let isLoading     = false;
let isSearchMode  = false; // true quando o usuário fez uma busca específica

/* ──────────────────────────────────────────────────────────────
   ELEMENTOS DO DOM
────────────────────────────────────────────────────────────── */
const searchForm     = document.getElementById('search-form');
const searchInput    = document.getElementById('search-input');
const errorSection   = document.getElementById('error-section');
const errorMessage   = document.getElementById('error-message');
const errorClose     = document.getElementById('error-close');
const loader         = document.getElementById('loader');
const pokemonGrid    = document.getElementById('pokemon-grid');
const gridCount      = document.getElementById('grid-count');
const loadMoreBtn    = document.getElementById('load-more-btn');
const loadMoreSection= document.getElementById('load-more-section');
const detailModal    = document.getElementById('detail-modal');
const modalBackdrop  = document.getElementById('modal-backdrop');
const modalClose     = document.getElementById('modal-close');
const suggestions    = document.querySelectorAll('.search__suggestion');

/* ──────────────────────────────────────────────────────────────
   UTILITÁRIOS
────────────────────────────────────────────────────────────── */
function pad(number, size = 3) {
  return String(number).padStart(size, '0');
}

function decimetresToMeters(dm) {
  return (dm / 10).toFixed(1) + ' m';
}

function hectogramsToKg(hg) {
  return (hg / 10).toFixed(1) + ' kg';
}

function capitalize(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getTypeColor(type) {
  return TYPE_COLORS[type] ?? '#777';
}

/* ──────────────────────────────────────────────────────────────
   FETCH
────────────────────────────────────────────────────────────── */
async function fetchPokemon(nameOrId) {
  const query = String(nameOrId).toLowerCase().trim();
  const res   = await fetch(`${API_BASE}/pokemon/${query}`);
  if (!res.ok) throw new Error(`Pokémon "${query}" não encontrado.`);
  return res.json();
}

async function fetchPokemonList(limit, offset) {
  const res = await fetch(`${API_BASE}/pokemon?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Erro ao buscar lista de Pokémon.');
  return res.json();
}

/* ──────────────────────────────────────────────────────────────
   ERRO
────────────────────────────────────────────────────────────── */
function showError(msg) {
  errorMessage.textContent = msg;
  errorSection.removeAttribute('hidden');
}

function hideError() {
  errorSection.setAttribute('hidden', '');
}

errorClose.addEventListener('click', hideError);

/* ──────────────────────────────────────────────────────────────
   LOADER
────────────────────────────────────────────────────────────── */
function showLoader() {
  loader.removeAttribute('hidden');
  pokemonGrid.setAttribute('aria-busy', 'true');
}

function hideLoader() {
  loader.setAttribute('hidden', '');
  pokemonGrid.removeAttribute('aria-busy');
}

/* ──────────────────────────────────────────────────────────────
   CARD
────────────────────────────────────────────────────────────── */
function createCard(data) {
  const primaryType = data.types[0]?.type.name ?? 'normal';
  const typeColor   = getTypeColor(primaryType);

  const card = document.createElement('article');
  card.className = 'pokemon-card';
  card.style.setProperty('--card-type-color', typeColor);
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${capitalize(data.name)}, número ${data.id}`);

  const typeBadges = data.types
    .map(t => `<span class="type-badge type--${t.type.name}" style="background:${getTypeColor(t.type.name)}">${capitalize(t.type.name)}</span>`)
    .join('');

  const imgSrc = data.sprites.other?.['official-artwork']?.front_default
    ?? data.sprites.front_default
    ?? '';

  card.innerHTML = `
    <span class="pokemon-card__number">#${pad(data.id)}</span>
    <div class="pokemon-card__image-wrap">
      <img
        class="pokemon-card__image"
        src="${imgSrc}"
        alt="Ilustração oficial de ${capitalize(data.name)}"
        loading="lazy"
        width="110" height="110"
      />
    </div>
    <h2 class="pokemon-card__name">${capitalize(data.name)}</h2>
    <div class="pokemon-card__types">${typeBadges}</div>
  `;

  card.addEventListener('click',   () => openModal(data));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(data); } });

  return card;
}

/* ──────────────────────────────────────────────────────────────
   MODAL
────────────────────────────────────────────────────────────── */
function openModal(data) {
  const primaryType = data.types[0]?.type.name ?? 'normal';
  const typeColor   = getTypeColor(primaryType);

  /* Cabeçalho */
  document.getElementById('modal-number').textContent = `#${pad(data.id)}`;
  document.getElementById('modal-pokemon-name').textContent = capitalize(data.name);

  /* Cor de fundo temática */
  const header = document.getElementById('modal-header');
  header.style.setProperty('--modal-type-color', typeColor);

  /* Tipos */
  const typesEl = document.getElementById('modal-types');
  typesEl.innerHTML = data.types
    .map(t => `<span class="type-badge type--${t.type.name}" style="background:${getTypeColor(t.type.name)}">${capitalize(t.type.name)}</span>`)
    .join('');

  /* Imagem */
  const imgSrc = data.sprites.other?.['official-artwork']?.front_default
    ?? data.sprites.front_default ?? '';
  const imgEl  = document.getElementById('modal-image');
  imgEl.src    = imgSrc;
  imgEl.alt    = `Ilustração oficial de ${capitalize(data.name)}`;

  /* Altura e Peso */
  document.getElementById('modal-height').textContent = decimetresToMeters(data.height);
  document.getElementById('modal-weight').textContent = hectogramsToKg(data.weight);

  /* Habilidades */
  const abilitiesEl = document.getElementById('modal-abilities');
  abilitiesEl.innerHTML = data.abilities
    .map(a => `<li class="${a.is_hidden ? 'is-hidden' : ''}" title="${a.is_hidden ? 'Habilidade oculta' : ''}">${capitalize(a.ability.name)}${a.is_hidden ? ' 🔒' : ''}</li>`)
    .join('');

  /* Barras de estatísticas */
  const barsEl = document.getElementById('modal-bars');
  barsEl.innerHTML = data.stats.map(s => {
    const key   = s.stat.name;
    const label = STAT_LABELS[key] ?? capitalize(key);
    const value = s.base_stat;
    const max   = 255; // máximo possível
    const pct   = Math.min(100, Math.round((value / max) * 100));
    const color = STAT_COLORS[key] ?? typeColor;
    return `
      <li class="stat-bar" aria-label="${label}: ${value}">
        <span class="stat-bar__label">${label}</span>
        <span class="stat-bar__value">${value}</span>
        <div class="stat-bar__track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}">
          <div class="stat-bar__fill" style="--bar-color:${color}" data-width="${pct}"></div>
        </div>
      </li>
    `;
  }).join('');

  /* Mostrar modal */
  detailModal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  modalClose.focus();

  /* Animar barras após render */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.stat-bar__fill').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
    });
  });
}

function closeModal() {
  detailModal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !detailModal.hasAttribute('hidden')) closeModal();
});

/* ──────────────────────────────────────────────────────────────
   GRID — CARREGAR LISTA
────────────────────────────────────────────────────────────── */
async function loadPokemonBatch(limit, offset, append = false) {
  if (isLoading) return;
  isLoading = true;
  showLoader();
  if (!append) {
    pokemonGrid.innerHTML = '';
    gridCount.textContent = '';
  }
  hideError();

  try {
    const listData = await fetchPokemonList(limit, offset);

    // Busca todos os detalhes em paralelo
    const details = await Promise.all(
      listData.results.map(p => fetchPokemon(p.name))
    );

    details.forEach(d => pokemonGrid.appendChild(createCard(d)));

    currentOffset = offset + details.length;

    // Exibe ou esconde botão "Carregar mais"
    if (listData.next) {
      loadMoreSection.removeAttribute('hidden');
    } else {
      loadMoreSection.setAttribute('hidden', '');
    }

    gridCount.textContent = `Exibindo ${pokemonGrid.children.length} Pokémon`;
  } catch (err) {
    showError(err.message || 'Erro ao carregar Pokémon. Tente novamente.');
    loadMoreSection.setAttribute('hidden', '');
  } finally {
    isLoading = false;
    hideLoader();
  }
}

loadMoreBtn.addEventListener('click', () => {
  if (isSearchMode) return;
  loadPokemonBatch(LOAD_MORE_LIMIT, currentOffset, true);
});

/* ──────────────────────────────────────────────────────────────
   BUSCA
────────────────────────────────────────────────────────────── */
async function searchPokemon(query) {
  if (!query) return;

  isLoading = true;
  isSearchMode = true;
  showLoader();
  hideError();
  pokemonGrid.innerHTML = '';
  gridCount.textContent = '';
  loadMoreSection.setAttribute('hidden', '');

  try {
    const data = await fetchPokemon(query);
    pokemonGrid.appendChild(createCard(data));
    gridCount.textContent = '1 Pokémon encontrado';

    // Abre o modal automaticamente na busca
    openModal(data);
  } catch (err) {
    showError(
      `😕 Pokémon "${query}" não encontrado. Verifique o nome ou número e tente novamente.`
    );
    // Recarrega lista padrão em background após erro
    isSearchMode = false;
    await loadPokemonBatch(INITIAL_LIMIT, 0);
  } finally {
    isLoading = false;
    hideLoader();
  }
}

searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    // Se limpar a busca, recarrega tudo
    isSearchMode = false;
    currentOffset = 0;
    loadPokemonBatch(INITIAL_LIMIT, 0);
    return;
  }
  searchPokemon(query);
});

/* Sugestões rápidas */
suggestions.forEach(btn => {
  btn.addEventListener('click', () => {
    searchInput.value = btn.dataset.name;
    searchPokemon(btn.dataset.name);
  });
});

/* ──────────────────────────────────────────────────────────────
   INICIALIZAÇÃO
────────────────────────────────────────────────────────────── */
(function init() {
  loadPokemonBatch(INITIAL_LIMIT, 0);
})();