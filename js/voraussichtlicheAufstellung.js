/**
 * Voraussichtliche Aufstellungen für den nächsten Spieltag.
 * Datenquelle: PossibleFormatin.json (siehe js/config.js -> DATA_URLS.possibleLineups).
 *
 * possibleFormationMap: { "<clubId>": [ { comunioPlayerId, playerName, clubId,
 *   playerNote, playerLink, playerId, last5MatchStatus: [ {"1": "START"}, ... ] } ] }
 *
 * Zuordnungen:
 *   clubId        -> Vereinsdatenbank (DATA_URLS.clubs), Fallback EspnClubMapping
 *   comunioPlayerId -> Spielerdatenbank (DATA_URLS.players, Key "id")
 *   Owner         -> ownerToUserMap (users + playerToUser, Key: comunioPlayerId)
 */

let possibleLineupData = null;   // { matchday, lastUpdate, possibleFormationMap }
let clubsMap = new Map();        // clubId -> Vereinsname (Vereinsdatenbank)
let fallbackClubMap = new Map(); // clubId -> Vereinsname (EspnClubMapping)
let playersMap = new Map();      // comunioPlayerId -> Spielerdatenbank-Eintrag
let ownerToUserMap = new Map();  // comunioPlayerId -> { userId, name, isComputer }
let ownerPlayersIndex = new Map(); // Owner-Name -> [{playerId, name, status, ...}]
let enrichedClubs = [];          // Render-Daten (pro Verein sortierte Spielerliste)
let selectedPlayerId = null;     // Angeklickte Spielerzeile (comunioPlayerId)

const currentFilter = { search: '', club: '', owner: '', onlyOut: false };

/** Reihenfolge der Positionen innerhalb eines Vereins. */
const POSITION_ORDER = ['TORHÜTER', 'ABWEHR', 'MITTELFELD', 'STURM'];

document.addEventListener('DOMContentLoaded', async () => {
  setupFilterToggle();
  bindFilterEvents();
  try {
    await loadData();
    renderStats();
    initClubSelect();
    render();
    showContent();
  } catch (error) {
    showError('Laden fehlgeschlagen: ' + (error && error.message ? error.message : error));
    addDebug('Fehler beim Laden: ' + (error && error.message ? error.message : error));
  }
});

/** Lädt alle benötigten Daten und baut die internen Maps auf. */
async function loadData() {
  showLoading();
  addDebug('Starte Ladevorgang...');
  addDebug(`Lade URLs:
      PossibleLineups: ${DATA_URLS.possibleLineups}
      Clubs: ${DATA_URLS.clubs}
      Players: ${DATA_URLS.players}
      Users: ${DATA_URLS.users}
      PlayerToUser: ${DATA_URLS.playerToUser}`);

  const [lineupData, clubsData, playersPayload, usersData, playerToUserMap, clubMappingData] = await Promise.all([
    fetchJSON(DATA_URLS.possibleLineups),
    fetchJSON(DATA_URLS.clubs),
    fetchJSON(DATA_URLS.players),
    fetchJSON(DATA_URLS.users),
    fetchJSON(DATA_URLS.playerToUser),
    loadClubMappingSafe(),
    // Status-Spalte: NotInLigaDB vor InjuriesDB (Helfer aus js/utils.js)
    loadNotInLigaMap(),
    loadInjuriesMap()
  ]);

  possibleLineupData = lineupData || {};

  // Clubmapping: Vereinsdatenbank (id -> Name) + EspnClubMapping als Fallback
  (Array.isArray(clubsData) ? clubsData : []).forEach(club => {
    if (club?.id !== undefined && club?.id !== null && club?.name) {
      clubsMap.set(String(club.id), club.name);
    }
  });
  clubMappingData.forEach((name, clubId) => fallbackClubMap.set(clubId, name));
  addDebug(`Vereine geladen: ${clubsMap.size} (Mapping-Fallback: ${fallbackClubMap.size})`);

  // Spielerdatenbank: comunioPlayerId -> Eintrag
  const playerList = Array.isArray(playersPayload)
    ? playersPayload
    : (playersPayload?.playerDB || []);
  playerList.forEach(player => {
    if (!player || player.id === undefined || player.id === null) return;
    playersMap.set(String(player.id), {
      ...player,
      position: player.data?.position || 'Unbekannt'
    });
  });
  addDebug(`Spieler geladen: ${playersMap.size}`);

  // ownerToUserMap: comunioPlayerId -> { userId, name, isComputer }
  buildOwnerToUserMap(usersData, playerToUserMap);
  addDebug(`Owner-Zuordnungen: ${ownerToUserMap.size}`);

  // Index: Owner-Name -> alle Spieler dieses Users (für die Auswahlanzeige)
  buildOwnerPlayersIndex();

  enrichedClubs = buildEnrichedClubs();
  addDebug(`Vereine mit Aufstellung: ${enrichedClubs.length}`);
}

/**
 * Lädt das EspnClubMapping tolerant (auch 404/leer akzeptabel).
 * @returns {Map<string,string>} clubId (comunioId) -> Vereinsname
 */
async function loadClubMappingSafe() {
  const map = new Map();
  if (!DATA_URLS.clubMapping) return map;
  try {
    const data = await fetchJSON(DATA_URLS.clubMapping);
    const entries = Array.isArray(data) ? data : (data?.mapping || []);
    entries.forEach(entry => {
      const clubId = String(entry?.comunioId ?? '').trim();
      const name = entry?.comunioName || entry?.espnName;
      if (clubId && name) map.set(clubId, name);
    });
  } catch (error) {
    addDebug('ClubMapping konnte nicht geladen werden: ' + (error?.message || error));
  }
  return map;
}

/**
 * Baut die ownerToUserMap aus Userdaten und PlayerToUserMap.
 * Owner mit userId 1 gelten als "Computer" (nicht verlinkbar).
 * @param {Array} usersData Userdatenbank
 * @param {Array} playerToUserMap PlayerToUserMap ([{ "<playerId>": "<userId>" }])
 */
function buildOwnerToUserMap(usersData, playerToUserMap) {
  const userMap = new Map();
  (Array.isArray(usersData) ? usersData : []).forEach(entry => {
    const user = entry?.user;
    if (!user || user.id === undefined || user.id === null) return;
    userMap.set(String(user.id), {
      id: String(user.id),
      firstName: user.firstName || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || `Unbekannt (${user.id})`
    });
  });

  ownerToUserMap = new Map();
  (Array.isArray(playerToUserMap) ? playerToUserMap : []).forEach(item => {
    if (!item || typeof item !== 'object') return;
    const playerId = Object.keys(item)[0];
    if (!playerId) return;
    const userId = String(item[playerId]);
    const user = userMap.get(userId);
    ownerToUserMap.set(String(playerId), {
      userId,
      name: user ? user.name : `Unbekannt (${userId})`,
      firstName: user ? user.firstName : '',
      isComputer: userId === '1'
    });
  });
}

/* ── Daten-Anreicherung ───────────────────────────────────────────────────── */

/**
 * Baut den Index ownerPlayersIndex: Owner-Name -> alle Spieler dieses Users
 * (inkl. aktuellem Status) für die kompakte Auswahlanzeige.
 */
function buildOwnerPlayersIndex() {
  ownerPlayersIndex = new Map();
  ownerToUserMap.forEach((owner, playerId) => {
    const dbEntry = playersMap.get(playerId);
    const statusEntry = getPlayerStatusEntry(playerId);
    const status = (statusEntry && statusEntry.status) ? statusEntry.status : 'AKTIV';
    const list = ownerPlayersIndex.get(owner.name) || [];
    list.push({
      playerId,
      name: dbEntry?.name || `Spieler ${playerId}`,
      status,
      statusTooltip: buildInjuryStatusTooltip(statusEntry, status)
    });
    ownerPlayersIndex.set(owner.name, list);
  });
}

/**
 * Erzeugt die Render-Daten: pro Verein die Spieler mit allen Zusatzinfos,
 * sortiert nach Position (TOR -> ABWEHR -> MITTELFELD -> STURM) und Name.
 * @returns {Array<{clubId: string, clubName: string, players: Array}>}
 */
function buildEnrichedClubs() {
  const formationMap = possibleLineupData?.possibleFormationMap || {};
  return Object.entries(formationMap)
    .map(([clubId, players]) => {
      const enriched = (Array.isArray(players) ? players : [])
        .map(enrichPlayer)
        .sort((a, b) => {
          const posDiff = positionSortValue(a.position) - positionSortValue(b.position);
          if (posDiff !== 0) return posDiff;
          return (a.playerName || '').localeCompare(b.playerName || '', 'de');
        });
      return {
        clubId: String(clubId),
        clubName: getClubName(clubId),
        players: enriched
      };
    })
    .filter(club => club.players.length > 0)
    .sort((a, b) => a.clubName.localeCompare(b.clubName, 'de'));
}

/**
 * Vereint Aufstellungs-Eintrag, Spielerdatenbank, Status und Owner.
 * @param {Object} entry Eintrag aus possibleFormationMap
 * @returns {Object} angereicherter Spieler
 */
function enrichPlayer(entry) {
  const comunioPlayerId = String(entry?.comunioPlayerId ?? '');
  const dbEntry = playersMap.get(comunioPlayerId);
  const position = dbEntry?.position || 'Unbekannt';

  // Status zentral aus utils: NotInLigaDB -> NICHT_IN_LIGA, sonst InjuriesDB
  const statusEntry = getPlayerStatusEntry(comunioPlayerId, { unknown: !dbEntry });
  const status = (statusEntry && statusEntry.status) ? statusEntry.status : 'AKTIV';
  const statusTooltip = (statusEntry && statusEntry.notInLiga)
    ? buildNotInLigaTooltip(statusEntry)
    : buildInjuryStatusTooltip(statusEntry, status);

  const marketValueRaw = dbEntry?.data?.wert || 0;

  return {
    comunioPlayerId,
    playerName: entry?.playerName || dbEntry?.name || 'Unbekannt',
    ligainsiderId: entry?.playerId || dbEntry?.data?.ligainsider?.playerId || '',
    playerLink: entry?.playerLink || dbEntry?.data?.ligainsider?.playerLink || '',
    clubId: String(entry?.clubId ?? ''),
    noteRaw: entry?.playerNote || '',
    noteValue: parseGermanNumber(entry?.playerNote),
    recentForm: parseRecentForm(entry?.last5MatchStatus),
    position,
    positionSort: positionSortValue(position),
    marketValue: marketValueRaw,
    marketValueHtml: formatMarktwert(marketValueRaw) + ' ' + unicodeTrend(getPlayerValueTrend(dbEntry)),
    points: dbEntry?.data?.punkte || 0,
    status,
    statusClass: getStatusClass(status),
    statusTooltip,
    unknownPlayer: !dbEntry,
    owner: ownerToUserMap.get(comunioPlayerId) || null
  };
}

/** Sortierschlüssel für Positionen (TOR zuerst). */
function positionSortValue(position) {
  const index = POSITION_ORDER.indexOf(String(position || '').toUpperCase());
  return index === -1 ? POSITION_ORDER.length : index;
}

/** Vereinsname aus Vereinsdatenbank, Fallback EspnClubMapping. */
function getClubName(clubId) {
  const key = String(clubId);
  return clubsMap.get(key) || fallbackClubMap.get(key) || `Verein (ID: ${key})`;
}

/**
 * Liefert die letzten bis zu fünf Einsätze (Index 1 = aktuellster Einsatz).
 * @param {Array} last5MatchStatus Rohdaten aus PossibleFormatin.json
 * @returns {Array<{index: string, status: string}>}
 */
function parseRecentForm(last5MatchStatus) {
  if (!Array.isArray(last5MatchStatus)) return [];
  const entries = [];
  last5MatchStatus.forEach(item => {
    if (!item || typeof item !== 'object') return;
    Object.entries(item).forEach(([index, status]) => {
      entries.push({ index: String(index), status: String(status || 'NONE') });
    });
  });
  return entries
    .sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0))
    .slice(0, 5);
}

/** "3,0" -> 3.0 (NaN, wenn nicht parsebar). */
function parseGermanNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Marktwert kompakt ("2,82 Mio. €" / "750 Tsd. €"). */
function formatMarktwert(value) {
  const amount = Number(value) || 0;
  if (!amount) return '–';
  if (amount >= 1000000) return (amount / 1000000).toFixed(2).replace('.', ',') + ' Mio. €';
  if (amount >= 1000) return Math.round(amount / 1000).toLocaleString('de-DE') + ' Tsd. €';
  return amount.toLocaleString('de-DE') + ' €';
}

/** HTML-Escaping (eigener Helper, da userInfo.js hier nicht geladen wird). */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[char]));
}

/** Noten-Klasse: niedrig ist besser (LigaInsider-Note). */
function getNoteClass(noteValue) {
  if (!Number.isFinite(noteValue)) return '';
  if (noteValue <= 3.0) return 'note-good';
  if (noteValue <= 3.5) return 'note-mid';
  return 'note-bad';
}

/** Kurzlabel für die Einsatz-Badges. */
const FORM_LABELS = {
  START: { label: 'S', title: 'Starter (START)' },
  SUBIN: { label: 'E', title: 'Eingewechselt (SUBIN)' },
  BANK: { label: 'B', title: 'Auf der Bank (BANK)' },
  NOTINTEAM: { label: '–', title: 'Nicht im Kader (NOTINTEAM)' },
  NONE: { label: '?', title: 'Keine Daten (NONE)' }
};

/* ── Rendering ────────────────────────────────────────────────────────────── */

/** Statistik: Spieltags-Chips + User-Balken. */
function renderStats() {
  setText('statMatchday', possibleLineupData?.matchday ?? '–');
  setText('statLastUpdate', formatLastUpdate(possibleLineupData?.lastUpdate));
  renderOwnerStats();
}

/**
 * Zählt die Spieler pro Owner (User) über alle voraussichtlichen
 * Aufstellungen hinweg und rendert Balken dazu.
 */
function renderOwnerStats() {
  const list = document.getElementById('ownerStatsList');
  if (!list) return;
  list.innerHTML = '';

  const counts = new Map(); // ownerKey -> { name, isComputer, count }
  enrichedClubs.forEach(club => {
    club.players.forEach(player => {
      const owner = player.owner;
      const key = owner ? owner.name : 'Computer';
      const entry = counts.get(key) || {
        name: key,
        isComputer: !owner || owner.isComputer === true,
        count: 0
      };
      entry.count += 1;
      counts.set(key, entry);
    });
  });

  const rows = [...counts.values()].sort((a, b) => {
    // Echte User zuerst (nach Anzahl), Computer am Ende
    if (a.isComputer !== b.isComputer) return a.isComputer ? 1 : -1;
    return b.count - a.count || a.name.localeCompare(b.name, 'de');
  });

  if (!rows.length) {
    list.innerHTML = '<div class="owner-stats-empty">Keine Owner-Daten verfügbar.</div>';
    return;
  }

  // Balken skaliert nach den echten Usern; Computer wird gedeckelt,
  // damit einzelne User-Balken nicht verschwinden.
  const maxUserCount = Math.max(
    1,
    ...rows.filter(row => !row.isComputer).map(row => row.count)
  );
  rows.forEach(row => {
    const barRow = document.createElement('div');
    barRow.className = 'owner-stat-row';
    barRow.setAttribute('role', 'button');
    barRow.setAttribute('tabindex', '0');
    barRow.setAttribute('title', `${row.name}: ${row.count} Spieler in den voraussichtlichen Aufstellungen (klicken zum Filtern)`);
    barRow.dataset.owner = row.name;

    const percent = Math.min(100, Math.round((row.count / maxUserCount) * 100));

    const nameEl = document.createElement('span');
    nameEl.className = 'owner-stat-name';
    nameEl.textContent = row.name;

    const track = document.createElement('div');
    track.className = 'owner-stat-track';
    const fill = document.createElement('div');
    fill.className = 'owner-stat-fill';
    fill.style.width = percent + '%';
    track.appendChild(fill);

    const countEl = document.createElement('span');
    countEl.className = 'owner-stat-count';
    countEl.textContent = row.count;

    barRow.appendChild(nameEl);
    barRow.appendChild(track);
    barRow.appendChild(countEl);

    const toggleOwnerFilter = () => {
      currentFilter.owner = currentFilter.owner === row.name ? '' : row.name;
      render();
    };
    barRow.addEventListener('click', toggleOwnerFilter);
    barRow.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleOwnerFilter();
      }
    });

    list.appendChild(barRow);
  });

  updateOwnerStatsActive();
}

/**
 * Kompakte Auswahlanzeige: gewählter Spieler + Owner + dessen Spieler,
 * die (laut Status) nicht spielen.
 */
function updateSelectionInfo() {
  const box = document.getElementById('selectionInfo');
  if (!box) return;

  if (!selectedPlayerId) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  // Gewählter Spieler in den Render-Daten suchen
  let selected = null;
  enrichedClubs.forEach(club => {
    club.players.forEach(player => {
      if (player.comunioPlayerId === selectedPlayerId) selected = player;
    });
  });
  if (!selected) {
    box.style.display = 'none';
    box.innerHTML = '';
    selectedPlayerId = null;
    return;
  }

  const owner = selected.owner;
  const ownerName = owner ? owner.name : 'Computer';
  const squad = owner ? (ownerPlayersIndex.get(ownerName) || []) : [];

  // Alle Spieler in den voraussichtlichen Aufstellungen (für den Vergleich)
  const lineupIds = new Set();
  enrichedClubs.forEach(club => club.players.forEach(player => lineupIds.add(player.comunioPlayerId)));

  // Spieler dieses Users, die nicht spielen:
  //  a) nicht in der voraussichtlichen Aufstellung, oder
  //  b) in der Aufstellung, aber Status ungleich aktiv
  const unavailable = squad
    .filter(player => !lineupIds.has(player.playerId) || player.status !== 'AKTIV')
    .map(player => ({
      ...player,
      inLineup: lineupIds.has(player.playerId)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const ownerHtml = (owner && !owner.isComputer && owner.firstName)
    ? `<a href="${getUseruebersichtUrl(owner.firstName)}" class="owner-link">${escapeHtml(ownerName)}</a>`
    : escapeHtml(ownerName);

  const unavailableHtml = unavailable.length
    ? unavailable.map(player => {
        const hint = player.inLineup
          ? `Steht in der Aufstellung, aber Status: ${player.statusTooltip}`
          : `${player.statusTooltip} – nicht in der voraussichtlichen Aufstellung`;
        return `
        <span class="sel-chip${player.inLineup ? ' sel-chip-warning' : ''}" title="${escapeHtml(hint)}">
          <a href="${getPlayerUrl(player.playerId)}">${escapeHtml(player.name)}</a>
          <i class="sel-status">${getStatusIndicator(player.status)}</i>
        </span>`;
      }).join('')
    : '<span class="sel-none">Alle Spieler dieses Users stehen in der Aufstellung und sind aktiv.</span>';

  const closeBtn = '<button type="button" class="sel-close" title="Auswahl aufheben">×</button>';

  box.innerHTML = `
    <div class="sel-head">
      <b>${escapeHtml(selected.playerName)}</b>
      <span class="sel-owner">Owner: ${ownerHtml}</span>
      ${closeBtn}
    </div>
    <div class="sel-body">
      <span class="sel-label">Nicht spielend (${unavailable.length}):</span>
      <span class="sel-chips">${unavailableHtml}</span>
    </div>`;

  box.style.display = '';
  const closeBtnEl = box.querySelector('.sel-close');
  if (closeBtnEl) {
    closeBtnEl.addEventListener('click', () => {
      selectedPlayerId = null;
      document.querySelectorAll('#lineupList tr.selected').forEach(r => r.classList.remove('selected'));
      updateSelectionInfo();
    });
  }
}

/** Hebt die aktive Owner-Auswahl in der Balken-Statistik hervor. */
function updateOwnerStatsActive() {
  const list = document.getElementById('ownerStatsList');
  if (!list) return;
  const rows = list.querySelectorAll('.owner-stat-row');
  rows.forEach(row => {
    row.classList.toggle('active', !!currentFilter.owner && row.dataset.owner === currentFilter.owner);
  });
}

/** "2026-10-16T14:39:30Z" -> "16.10.2026 14:39" */
function formatLastUpdate(value) {
  if (!value) return '–';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/** Füllt die Vereins-Auswahl (nur Vereine mit Aufstellung). */
function initClubSelect() {
  const select = document.getElementById('clubSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Alle Vereine</option>';
  enrichedClubs.forEach(club => {
    const option = document.createElement('option');
    option.value = club.clubId;
    option.textContent = club.clubName;
    select.appendChild(option);
  });
}

/** Rendert die gefilterten Vereins-Sektionen. */
function render() {
  const container = document.getElementById('lineupList');
  if (!container) return;
  container.innerHTML = '';

  const filtered = enrichedClubs
    .map(club => ({ ...club, players: filterPlayers(club.players) }))
    .filter(club => !currentFilter.club || club.clubId === currentFilter.club)
    .filter(club => club.players.length > 0);

  updateResultInfo(filtered);
  renderClubNav(filtered);

  if (!filtered.length) {
    container.innerHTML = '<div class="lineup-empty">Keine Spieler für die aktuellen Filter gefunden.</div>';
    updateSelectionInfo();
    return;
  }

  filtered.forEach(club => {
    container.appendChild(renderClubCard(club));
  });

  updateSelectionInfo();
  updateOwnerStatsActive();
}

/**
 * Baut die Logo-Reihe über den Vereinskarten. Klick springt zur Sektion.
 * @param {Array} clubs Angezeigte Vereine (gefiltert)
 */
function renderClubNav(clubs) {
  const nav = document.getElementById('clubNav');
  if (!nav) return;
  nav.innerHTML = '';
  nav.style.display = clubs.length ? '' : 'none';

  clubs.forEach(club => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'club-nav-item';
    button.title = `${club.clubName} – zu den Spielern springen`;
    button.setAttribute('data-club-id', club.clubId);
    button.innerHTML = `<img src="logos/${getLogoFileName(club.clubId)}" alt="${escapeHtml(club.clubName)}">`;
    button.addEventListener('click', () => scrollToClub(club.clubId));
    nav.appendChild(button);
  });
}

/** Scrollt smooth zur Vereins-Sektion und blitzt sie kurz auf. */
function scrollToClub(clubId) {
  const card = document.querySelector(`.lineup-club-card[data-club-id="${CSS.escape(String(clubId))}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.classList.remove('club-nav-flash');
  // Reflow erzwingen, damit die Animation bei erneutem Klick neu startet
  void card.offsetWidth;
  card.classList.add('club-nav-flash');
  window.setTimeout(() => card.classList.remove('club-nav-flash'), 1800);
}

/** Wendet die aktiven Filter auf eine Spielerliste an. */
function filterPlayers(players) {
  const search = currentFilter.search.trim().toLowerCase();
  return players.filter(player => {
    if (currentFilter.onlyOut && player.status === 'AKTIV') return false;
    if (currentFilter.owner) {
      const ownerName = player.owner ? player.owner.name : 'Computer';
      if (ownerName !== currentFilter.owner) return false;
    }
    if (!search) return true;
    const ownerName = player.owner ? player.owner.name.toLowerCase() : 'computer';
    return player.playerName.toLowerCase().includes(search) || ownerName.includes(search);
  });
}

/** Hinweistext zu den aktuellen Filtern. */
function updateResultInfo(filteredClubs) {
  const info = document.getElementById('filterResultInfo');
  if (!info) return;
  const shown = filteredClubs.reduce((sum, club) => sum + club.players.length, 0);
  const total = enrichedClubs.reduce((sum, club) => sum + club.players.length, 0);
  const hasFilter = currentFilter.search || currentFilter.club || currentFilter.owner || currentFilter.onlyOut;
  info.textContent = hasFilter
    ? `${shown} von ${total} Spielern angezeigt${currentFilter.owner ? ` (Owner: ${currentFilter.owner})` : ''}`
    : `${shown} Spieler in ${filteredClubs.length} Vereinen`;
}

/** Karte (Sektion) für einen Verein. */
function renderClubCard(club) {
  const card = document.createElement('section');
  card.className = 'lineup-club-card';
  card.setAttribute('data-club-id', club.clubId);

  const header = document.createElement('div');
  header.className = 'lineup-club-header';
  header.innerHTML = `
      <img src="logos/${getLogoFileName(club.clubId)}" class="lineup-club-logo"
           alt="${escapeHtml(club.clubName)}" title="${escapeHtml(club.clubName)}">
      <span class="lineup-club-name">${escapeHtml(club.clubName)}</span>
      <span class="lineup-club-count">${club.players.length} Spieler</span>`;

  const body = document.createElement('div');
  body.className = 'lineup-club-body';
  const table = document.createElement('table');
  table.className = 'lineup-table';
  table.innerHTML = `
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Spieler</th>
          <th>Status</th>
          <th>Note</th>
          <th>Letzte Einsätze</th>
          <th>Marktwert</th>
          <th>Punkte</th>
          <th>Owner</th>
        </tr>
      </thead>
      <tbody></tbody>`;
  const tbody = table.querySelector('tbody');
  club.players.forEach(player => tbody.appendChild(renderPlayerRow(player)));
  body.appendChild(table);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

/** Eine Spielerzeile (im Mobile-Layout als Karte via data-label). */
function renderPlayerRow(player) {
  const row = document.createElement('tr');
  row.setAttribute('data-player-id', player.comunioPlayerId);
  if (selectedPlayerId === player.comunioPlayerId) row.classList.add('selected');
  // Klick auf die Zeile (außerhalb von Links) wählt den Spieler aus
  row.addEventListener('click', event => {
    if (event.target.closest('a') || event.target.closest('.ligainsider-link')) return;
    selectedPlayerId = selectedPlayerId === player.comunioPlayerId ? null : player.comunioPlayerId;
    document.querySelectorAll('#lineupList tr.selected').forEach(r => r.classList.remove('selected'));
    if (selectedPlayerId) row.classList.add('selected');
    updateSelectionInfo();
  });

  const playerUrl = getPlayerUrl(player.comunioPlayerId);
  const playerLinkHtml = `<a href="${playerUrl}" title="${escapeHtml(player.playerName)} (ID: ${player.comunioPlayerId})">${escapeHtml(player.playerName)}</a>`;
  const ligainsiderHtml = (player.playerLink && player.ligainsiderId)
    ? `<a href="${escapeHtml(player.playerLink)}" class="ligainsider-link" target="_blank" rel="noopener" title="LigaInsider-Profil öffnen">↗</a>`
    : '';

  const noteHtml = player.noteRaw
    ? `<span class="note-badge ${getNoteClass(player.noteValue)}" title="LigaInsider-Note">${escapeHtml(player.noteRaw)}</span>`
    : '–';

  row.innerHTML = `
    <td class="col-pos" data-label="Pos.">
      <img src="logos/${getLogoPositionFilename(player.position)}" class="pos-logo"
           width="16" height="16"
           alt="${escapeHtml(player.position)}" title="${escapeHtml(player.position)}">
    </td>
    <td data-label="Spieler">
      <span class="lineup-player-cell">${playerLinkHtml}${ligainsiderHtml}</span>
    </td>
    <td class="status-cell ${player.statusClass}" data-label="Status">
      <span title="${escapeHtml(player.statusTooltip)}">${getStatusIndicator(player.status)}</span>
    </td>
    <td data-label="Note">${noteHtml}</td>
    <td data-label="Letzte Einsätze">${renderRecentForm(player.recentForm)}</td>
    <td class="market-value" data-label="Marktwert">${player.marketValueHtml}</td>
    <td class="points-cell" data-label="Punkte">${player.points}</td>
    <td data-label="Owner">${renderOwnerLink(player.owner)}</td>`;
  return row;
}

/** Owner als Link zur Userübersicht (Computer bleibt Text). */
function renderOwnerLink(owner) {
  if (!owner) return 'Computer';
  if (owner.isComputer || !owner.firstName) {
    return `<span class="owner-name" title="Computer">${escapeHtml(owner.name)}</span>`;
  }
  const url = getUseruebersichtUrl(owner.firstName);
  return `<a href="${url}" class="owner-link" title="${escapeHtml(owner.name)}">${escapeHtml(owner.name)}</a>`;
}

/** Einsatz-Badges der letzten Spiele (Index 1 = aktuellster Einsatz). */
function renderRecentForm(form) {
  if (!form || !form.length) return '–';
  const badges = form.map(entry => {
    const config = FORM_LABELS[entry.status] || { label: entry.status.charAt(0), title: entry.status };
    return `<span class="form-badge form-${escapeHtml(entry.status)}" title="Einsatz ${entry.index}: ${escapeHtml(config.title)}">${escapeHtml(config.label)}</span>`;
  });
  return `<span class="recent-form">${badges.join('')}</span>`;
}

/* ── UI-Helfer ────────────────────────────────────────────────────────────── */

/** Text eines Elements setzen (nicht vorhandene Elemente werden ignoriert). */
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function showLoading() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const error = document.getElementById('error');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  if (error) error.style.display = 'none';
}

function showContent() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'block';
}

function showError(message) {
  showLoading();
  const error = document.getElementById('error');
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) errorMessage.textContent = message;
  if (error) error.style.display = 'block';
  addDebug('Fehler angezeigt: ' + message);
}

/** Auf-/Zuklappen des Filterbereichs (standardmäßig zu). */
function setupFilterToggle() {
  const label = document.getElementById('filterLabel');
  const content = document.getElementById('filterContentWrapper');
  if (!label || !content) return;
  let open = false;
  const update = () => {
    label.classList.toggle('open', open);
  };
  label.addEventListener('click', () => {
    open = !open;
    update();
  });
  update();
}

/** Events für Suche, Vereinsauswahl, Ausfall-Filter und Reset. */
function bindFilterEvents() {
  const searchInput = document.getElementById('searchInput');
  const clubSelect = document.getElementById('clubSelect');
  const onlyOutInput = document.getElementById('onlyOutInput');
  const resetButton = document.getElementById('resetFilters');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentFilter.search = searchInput.value || '';
      render();
    });
  }
  if (clubSelect) {
    clubSelect.addEventListener('change', () => {
      currentFilter.club = clubSelect.value || '';
      render();
    });
  }
  if (onlyOutInput) {
    onlyOutInput.addEventListener('change', () => {
      currentFilter.onlyOut = onlyOutInput.checked === true;
      render();
    });
  }
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (clubSelect) clubSelect.value = '';
      if (onlyOutInput) onlyOutInput.checked = false;
      currentFilter.search = '';
      currentFilter.club = '';
      currentFilter.owner = '';
      currentFilter.onlyOut = false;
      render();
    });
  }
}

