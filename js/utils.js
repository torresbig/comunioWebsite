/**
 * Sammlung von Hilfsfunktionen
 */

/**
 * Debug-Ausgabefunktion, hier über die Konsole.
 * Du kannst sie anpassen, um Debug-Informationen z.B. in die Seite zu schreiben.
 * @param {string} message Text für Debug-Zwecke
 */
function addDebug(message) {
  const debugDiv = document.getElementById('floatingDebugContent');
  debugDiv.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
  debugDiv.scrollTop = debugDiv.scrollHeight;
}

/**
 * Funktion zum Umschalten der Sichtbarkeit der News-Liste.
 * Wird z.B. vom Icon-Click-Event benutzt.
 */
function toggleNewsList() {
  const list = document.getElementById('news-list');
  const icon = document.getElementById('news-toggle-icon');
  if (!list || !icon) {
    addDebug('toggleNewsList: news-list oder news-toggle-icon nicht gefunden!');
    return;
  }
  if (list.style.display === 'none') {
    list.style.display = '';
    icon.style.transform = 'rotate(0deg)';
  } else {
    list.style.display = 'none';
    icon.style.transform = 'rotate(-90deg)';
  }
}

function getLokalOderGitURL(websiteUrl, lokalUrl) {
  const currentUrl = window.location.href;
  if (currentUrl.includes('https://${GITHUB_USER}.github.io/')) {
    return websiteUrl;
  } else {
    return lokalUrl;
  }
}

function getPlayerUrl(playerId) {
  const currentUrl = window.location.href;
  if (currentUrl.includes('htmlpreview.github.io')) {
    return WEBSITE_URLS.playerUrl + `${playerId}`;
  } else if (currentUrl.includes('github.com') || currentUrl.includes('githubusercontent.com')) {
    return WEBSITE_URLS.playerUrl + `${playerId}`;
  } else {
    return `player.html?id=${playerId}`;
  }
}

function getValueTrend(value, lastValue) {
  if (lastValue === null || lastValue === undefined || lastValue === '') return '';
  const current = Number(value);
  const previous = Number(lastValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return '';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'eq';
}

function getPlayerValueTrend(player) {
  return getValueTrend(player?.data?.wert, player?.data?.lastWert);
}

function unicodeTrend(trend) {
  if (trend === "up") return '<span class="trend-mini trend-up" title="Wert gestiegen">&#9650;</span>';
  if (trend === "down") return '<span class="trend-mini trend-down" title="Wert gefallen">&#9660;</span>';
  if (trend === "eq") return '<span class="trend-mini trend-eq" title="Wert gleichbleibend">&#8226;</span>';
  return "";
}

// Hilfsfunktion innerhalb von renderNews oder global verfügbar
function linkPlayer(playerId, playerName) {
    if (!playerId) {
    return `<span class="player-link">${playerName}</span>`;
    }
    const url = getPlayerUrl(playerId);
  return `<a class="player-link" href="${url}">${playerName}</a>`;
}


function getLogoFileName(clubId) {
  if (!clubId) return "unbestimmt.png";
  const mapping = {
    "3": "gladbach",
    "21": "freiburg",
    "18": "mainz",
    "92": "leipzig",
    "1": "bayern",
    "6": "werderBremen",
    "12": "wolfsburg",
    "5": "dortmund",
    "8": "leverkusen",
    "13": "koeln",
    "14": "stuttgart",
    "62": "hoffenheim",
    "68": "augsburg",
    "9": "frankfurt",
    "109": "unionBerlin",
    "110": "heidenheim",
    "25": "stpauli",
    "4": "hamburg",
    "81": "paderborn",
    "10": "schalke",
    "118": "elversberg",
  };
  return (mapping[clubId] || "unbestimmt") + ".png";
}

function getLogoPositionFilename(pos) {
  if (!pos) return "unbestimmt.png";
  const mapping = {
    "STURM": "sts",
    "MITTELFELD": "mits",
    "ABWEHR": "defs",
    "TORHÜTER": "tors",
  };
  return (mapping[pos] || "ubs") + ".png";
}


function getStatusIndicator(status) {
  switch (status) {
    case 'AKTIV': return '👍';
    case 'VERLETZT': return '🚨';
    case 'REHA': return '🔄';
    case 'AUFBAUTRAINING': return '🏋️';
    case 'NICHT_IN_LIGA': return '❌';
    case 'FUENFTE_GELBE_KARTE': return '5x🟨';
    case 'GELBROTE_KARTE': return '🟨🟥';
    case 'ROTE_KARTE': return '🟥';
    case 'NICHT_IM_KADER': return '🚫';
    case 'GESPERRT': return '🚫';
    default: return '❓';
  }
}

function getStatusDisplayName(status) {
  const statusMap = {
    'AKTIV': 'Aktiv',
    'VERLETZT': 'Verletzt',
    'REHA': 'Reha',
    'AUFBAUTRAINING': 'Aufbautraining',
    'NICHT_IM_KADER': 'Nicht im Kader',
    'ROTE_KARTE': 'Rote Karte',
    'GELBROTE_KARTE': 'Gelbrote Karte',
    'FUENFTE_GELBE_KARTE': '5. gelbe Karte',
    'NICHT_IN_LIGA': 'Nicht in Liga',
    'GESPERRT': 'Gesperrt'
  };
  return statusMap[status] || status || 'Unbekannt';
}

/**
 * Alle bekannten Spielerstatus-Werte (InjuriesDB und NewsDB).
 * @returns {string[]}
 */
function getKnownInjuryStatuses() {
  return [
    'AKTIV',
    'VERLETZT',
    'REHA',
    'AUFBAUTRAINING',
    'NICHT_IN_LIGA',
    'NICHT_IM_KADER',
    'ROTE_KARTE',
    'GELBROTE_KARTE',
    'FUENFTE_GELBE_KARTE',
    'GESPERRT'
  ];
}

/**
 * Prüft, ob ein Status ein bekannter Spielerstatus ist.
 * @param {string} status
 * @returns {boolean}
 */
function isKnownInjuryStatus(status) {
  if (!status) return false;
  return getKnownInjuryStatuses().includes(String(status).toUpperCase());
}

/**
 * Zerlegt den Text einer SPIELERSTATUS-News der NewsDB.
 * Unterstützte Formate (echte Beispiele aus der NewsDB):
 *   "Statuswechsel: Xaver Schlager (33420) ist jetzt VERLETZT"
 *   "Statuswechsel: Tim Breithaupt (33808) ist jetzt AUFBAUTRAINING"
 *   "Statuswechsel: M. Kohr (33567) ist jetzt geperrt (GESPERRT)"
 *   "Statuswechsel:  (33296) ist wieder AKTIV"      <- Spielername kann fehlen
 * Der Spielername ist optional und wird vom Aufrufer ggf. nachgeladen.
 * @param {string} text Roh-Text der News
 * @returns {{playerId: string, playerName: string, changeWord: string, status: string, statusDetail: string}|null}
 */
function parseSpielerstatusNewsText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = /^Statuswechsel:\s*(.*?)\s*\((\d+)\)\s*ist\s*(wieder|jetzt)\s*(.+?)\s*$/i.exec(text);
  if (!match) return null;

  const playerName = (match[1] || '').trim();
  const playerId = match[2] || '';
  const changeWord = (match[3] || '').toLowerCase();
  let statusText = match[4] || '';
  let statusDetail = '';

  // Optionaler Zusatz in Klammern, z.B. "VERLETZT (unbekannte Verletzung)"
  const detailMatch = /^(.*?)\s*\((.+)\)$/.exec(statusText);
  if (detailMatch) {
    statusText = (detailMatch[1] || '').trim();
    statusDetail = (detailMatch[2] || '').trim();
  }

  let status = statusText.toUpperCase().replace(/\s+/g, '_');
  if (!isKnownInjuryStatus(status) && statusDetail) {
    // z.B. "geperrt (GESPERRT)": Status aus der Klammer übernehmen
    const detailStatus = statusDetail.toUpperCase().replace(/\s+/g, '_');
    if (isKnownInjuryStatus(detailStatus)) {
      status = detailStatus;
      statusDetail = '';
    }
  }

  return { playerId, playerName, changeWord, status, statusDetail };
}



async function fetchJSON(url) {
  addDebug(`Lade Datei: ${url}`);
  const cacheBusterUrl = url + '?t=' + new Date().getTime();
  try {
    const response = await fetch(cacheBusterUrl);
    if (!response.ok) {
      addDebug(`Fehler beim Laden: HTTP ${response.status}`);
      throw new Error(`HTTP ${response.status} für ${url}`);
    }
    const text = await response.text();
    if (!text.trim()) {
      addDebug("Warnung: Datei ist leer!");
      throw new Error("Leere Datei: " + url);
    }
    addDebug("Datei geladen, versuche JSON zu parsen...");
    const data = JSON.parse(text);
    addDebug(`Erfolgreich geparst: ${data.length || Object.keys(data).length} Einträge`);
    return data;
  } catch (error) {
    addDebug("Fehler beim Laden/JSON-Parsen: " + error.message);
    throw error;
  }
}

// Cache für Benutzerdaten
let userMapCache = null;
let userDataPromise = null;

async function getUserString(userId) {
  try {
    // Wenn wir bereits Daten laden, warten wir auf diese
    if (userDataPromise) {
      await userDataPromise;
    }
    
    // Wenn wir einen Cache haben, nutzen wir diesen
    if (userMapCache) {
      return userMapCache.get(userId) || `Unbekannt (${userId})`;
    }
    
    // Ersten Ladevorgang starten
    userDataPromise = fetchJSON(DATA_URLS.users);
    const usersData = await userDataPromise;
    
    // Cache erstellen
    userMapCache = new Map();
    usersData.forEach(user => {
      userMapCache.set(user.user.id, `${user.user.firstName} ${user.user.lastName || ''}`);
    });
    
    return userMapCache.get(userId) || `Unbekannt (${userId})`;
  } catch (error) {
    console.error('Fehler beim Laden der Benutzerdaten:', error);
    return `Unbekannt (${userId})`;
  } finally {
    userDataPromise = null;
  }
}

/**
 * Generiert die URL zur Userübersichtsseite mit dem Usernamen als Parameter.
 * @param {string} username - Vorname des Users
 * @returns {string} URL zur Userübersicht mit ?username=...&withMenue=true/false
 */
function getUseruebersichtUrl(username) {
  if (!username) return '';
  // Falls der Name Leerzeichen enthält, nimm nur den ersten Teil (Vorname)
  const firstName = username.split(' ')[0];
  let baseUrl;
  if (typeof ACTIVE_WEBSITE_URLS !== 'undefined' && ACTIVE_WEBSITE_URLS.useruebersichtUrl) {
    baseUrl = ACTIVE_WEBSITE_URLS.useruebersichtUrl;
  } else if (typeof WEBSITE_URLS !== 'undefined' && WEBSITE_URLS.useruebersichtUrl) {
    baseUrl = WEBSITE_URLS.useruebersichtUrl;
  } else {
    baseUrl = 'useruebersicht.html';
  }
  const currentParams = new URLSearchParams(window.location.search);
  const withMenue = currentParams.get('withMenue') !== 'false';
  return `${baseUrl}?username=${encodeURIComponent(firstName)}&withMenue=${withMenue}`;
}

/**
 * Erzeugt einen anklickbaren Link zur Userübersicht für eine userId.
 * @param {string|number} userId
 * @returns {Promise<string>} HTML-Link oder nur Name bei Computer
 */
async function getUserLink(userId) {
  if (!userId || userId == 1) {
    const name = await getUserString(userId);
    return name || 'Computer';
  }
  const name = await getUserString(userId);
  if (!name) return `Unbekannt (${userId})`;
  const firstName = name.split(' ')[0];
  const url = getUseruebersichtUrl(firstName);
  return `<a href="${url}" style="color:#00c; text-decoration:underline;">${name.trim()}</a>`;
}

// Cache / Promise für Points-DB
let pointsDbCache = null;
let pointsDbPromise = null;

/**
 * Lädt die Points-DB (DATA_URLS.points) und cached sie (ein einziger Request).
 * Format: { "<playerId>": [ { key, value, status, einsatzzeit, ... }, ... ] }
 * Die Spieltagseinträge liegen flach vor (kein "stats"-Unterobjekt mehr).
 * @returns {Promise<Object>} Points-DB (leeres Objekt bei Fehler)
 */
async function getPointsDb() {
  if (pointsDbCache) return pointsDbCache;
  if (!pointsDbPromise) pointsDbPromise = loadPointsDb();
  try {
    await pointsDbPromise;
  } catch (err) {
    addDebug('Fehler beim Laden der Points-DB: ' + (err.message || err), 'error');
    pointsDbPromise = null;
    return pointsDbCache || {};
  }
  return pointsDbCache || {};
}

/**
 * Interner Ladevorgang inkl. Fallback-URL (falls config falsch war).
 * @returns {Promise<Object>}
 */
async function loadPointsDb() {
  let data = null;
  try {
    data = await fetchJSON(DATA_URLS.points);
  } catch (errPrimary) {
    addDebug('Primärer Points-URL-Load fehlgeschlagen: ' + (errPrimary.message || errPrimary), 'warn');
    const fallbackUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/PointsDB.json`;
    addDebug('Versuche Fallback-URL für Points-DB: ' + fallbackUrl, 'info');
    data = await fetchJSON(fallbackUrl);
  }
  pointsDbCache = data || {};
  return pointsDbCache;
}

/**
 * Spieltagseinträge eines Spielers aus einer geladenen Points-DB.
 * Lookup robust für number/string-IDs.
 * @param {Object} db Ergebnis von getPointsDb()
 * @param {string|number} playerId
 * @returns {any[]} Einträge oder leeres Array
 */
function getPointsEntriesForPlayer(db, playerId) {
  if (playerId === null || playerId === undefined || playerId === '') return [];
  if (!db) return [];
  const found = db[playerId] ?? db[String(playerId)] ?? db[Number(playerId)];
  return Array.isArray(found) ? found : [];
}

/**
 * Liefert die Spieltagspunkte für einen Spieler aus der externen Points-DB (DATA_URLS.points).
 * Die Points-DB wird einmal geladen und dann gecached.
 * @param {string|number} playerId
 * @returns {Promise<any[]>} Spieltagspunkte oder leeres Array bei Fehler/fehlen.
 */
async function getPlayerSpieltagspunkte(playerId) {
  if (!playerId && playerId !== 0) return [];
  const db = await getPointsDb();
  return getPointsEntriesForPlayer(db, playerId);
}

  // Cache / Promise für die Spielerdatenbank (nur für Namens-Lookups)
  let playerDbCache = null;
  let playerDbPromise = null;

  /**
   * Lädt die Spielerdatenbank (DATA_URLS.players) einmalig und cached sie.
   * Wird u.a. genutzt, um fehlende Spielernamen (z.B. in Statusnews) zu ermitteln.
   * @returns {Promise<Array>} playerDB-Array (leer bei Fehler)
   */
  async function getPlayerDb() {
    if (playerDbCache) return playerDbCache;
    if (!playerDbPromise) {
      playerDbPromise = fetchJSON(DATA_URLS.players)
        .then(data => {
          playerDbCache = (data && Array.isArray(data.playerDB)) ? data.playerDB : [];
          addDebug(`Spielerdatenbank geladen: ${playerDbCache.length} Spieler`);
          return playerDbCache;
        })
        .catch(err => {
          addDebug('Fehler beim Laden der Spielerdatenbank: ' + (err.message || err), 'error');
          playerDbCache = [];
          return playerDbCache;
        })
        .finally(() => { playerDbPromise = null; });
    }
    return playerDbPromise;
  }

  /**
   * Ermittelt den Spielernamen anhand der comunioPlayerId.
   * @param {string|number} playerId
   * @returns {Promise<string>} Name oder '' (wenn nicht gefunden)
   */
  async function getPlayerNameById(playerId) {
    if (playerId === null || playerId === undefined || playerId === '') return '';
    const players = await getPlayerDb();
    const entry = players.find(p => String(p.id) === String(playerId));
    return entry?.name || '';
  }

  // Cache / Promise für Injuries-DB
  let injuriesDbCache = null;
  let injuriesDbPromise = null;

  /**
   * Bekannte Zweige der InjuriesDB, die die aktiven Ausfälle enthalten.
   * Aktuell: "injuriedAndBannedPlayer" (Achtung: Schreibweise des Datenlieferanten).
   * Die weiteren Varianten bleiben aus Tippfehler-/Kompatibilitätsgründen erhalten,
   * "injuries" stammt aus dem alten Format.
   */
  const INJURIES_PAYLOAD_KEYS = [
    'injuriedAndBannedPlayer',
    'injuredAndBannedPlayer',
    'injuredAndBannedPlayers',
    'injuries'
  ];

  /**
   * Prüft, ob ein Objekt direkt Status-Einträge enthält, also
   * { "<comunioPlayerId>": { status: "VERLETZT", ... } }.
   * Listen (z.B. die "history" der InjuriesDB) liefern false.
   * @param {any} branch
   * @returns {boolean}
   */
  function hasStatusEntries(branch) {
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) return false;
    return Object.values(branch).some(
      value => value && typeof value === 'object' && !Array.isArray(value) && 'status' in value
    );
  }

  /**
   * Ermittelt aus den Rohdaten der InjuriesDB den Zweig mit den aktiven Ausfällen
   * { "<comunioPlayerId>": {status, reason, ...} }.
   * Unterstützte Formate:
   *   neu:  { "lastUpdate": "2026-09-26T13:14:28Z",
   *           "injuriedAndBannedPlayer": { "<id>": {...} },
   *           "history": { "<id>": [ {...} ] } }
   *   alt:  { "<playerId>": {status, grund, ...} }
   * Wichtig: Es wird nie das Root-Objekt zurückgegeben, damit Metadaten
   * ("lastUpdate") und die "history" nicht als Status interpretiert werden.
   * @param {any} data Rohdaten aus DATA_URLS.injuries
   * @returns {Object|null} Objekt mit Player-Keys oder null (kein passender Zweig)
   */
  function extractInjuriesPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    // 1. Bekannte Zweige (mehrfach verschachtelt, falls sich das Format erneut ändert)
    let payload = data;
    for (let depth = 0; depth < 3; depth++) {
      const key = INJURIES_PAYLOAD_KEYS.find(
        k => payload[k] && typeof payload[k] === 'object' && !Array.isArray(payload[k])
      );
      if (!key) break;
      payload = payload[key];
    }
    if (payload !== data) return payload;

    // 2. Legacy: flaches Format { "<playerId>": { status, grund, ... } }
    if (hasStatusEntries(data)) return data;

    // 3. Fallback: Zweig wurde umbenannt -> erstes Objekt mit Status-Einträgen
    const fallbackKey = Object.keys(data).find(k => hasStatusEntries(data[k]));
    return fallbackKey ? data[fallbackKey] : null;
  }

  /**
   * Vereinheitlicht einen Eintrag aus der InjuriesDB ("injuriedAndBannedPlayer").
   * Alle Felder des Datenlieferanten bleiben erhalten, die bekannten Felder werden
   * zusätzlich explizit gesetzt (leerer String statt undefined).
   * Bekannte Felder: comunioPlayerId, status, reason, sinceString, sinceTimestamp,
   * statusChangeString, statusChangeTimestamp, lastNewsText, lastNewsLink,
   * playerName, playerLink, club, quelle, ligainsiderPlayerId.
   * @param {Object} raw Eintrag aus der InjuriesDB
   * @param {string} [fallbackId] Objekt-Key, falls comunioPlayerId fehlt
   * @returns {Object} normalisierter Status-Eintrag
   */
  function normalizeInjuryEntry(raw, fallbackId) {
    const entry = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? { ...raw } : {};
    const comunioPlayerId = entry.comunioPlayerId ?? entry.comunioId ?? entry.playerId ?? fallbackId;
    return {
      ...entry,
      comunioPlayerId: (comunioPlayerId !== null && comunioPlayerId !== undefined) ? String(comunioPlayerId) : '',
      status: entry.status || '',
      reason: entry.reason || '',
      sinceString: entry.sinceString || '',
      sinceTimestamp: entry.sinceTimestamp || '',
      statusChangeString: entry.statusChangeString || '',
      statusChangeTimestamp: entry.statusChangeTimestamp || '',
      lastNewsText: entry.lastNewsText || '',
      lastNewsLink: entry.lastNewsLink || '',
      playerName: entry.playerName || '',
      playerLink: entry.playerLink || '',
      club: entry.club || '',
      quelle: entry.quelle || '',
      ligainsiderPlayerId: entry.ligainsiderPlayerId ? String(entry.ligainsiderPlayerId) : ''
    };
  }

  /**
   * Baut aus den Injuries-Rohdaten die Map (comunioPlayerId -> Status-Objekt).
   * Es wird ausschließlich der Zweig "injuriedAndBannedPlayer" verwendet, die
   * "history" wird bewusst ignoriert. Einträge ohne Status werden übersprungen
   * (kein Eintrag = AKTIV).
   * @param {any} data Rohdaten aus DATA_URLS.injuries
   * @returns {Map<string, Object>} Map mit Status-Objekten (Key: comunioPlayerId)
   */
  function buildInjuriesMap(data) {
    const map = new Map();
    const payload = extractInjuriesPayload(data);
    if (!payload) return map;
    Object.entries(payload).forEach(([playerId, rawEntry]) => {
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return;
      const entry = normalizeInjuryEntry(rawEntry, playerId);
      if (!entry.status) return; // ohne Status ist der Spieler aktiv
      map.set(String(entry.comunioPlayerId || playerId), entry);
    });
    return map;
  }

  /**
   * Liefert den Status-Eintrag (aus window.injuriesMap) für eine comunioPlayerId.
   * Der Lookup ist robust für String- und Number-IDs.
   * @param {string|number} playerId comunioPlayerId des Spielers
   * @returns {Object|null} Status-Eintrag oder null (wenn kein Ausfall vorliegt)
   */
  function getInjuryStatusEntry(playerId) {
    if (playerId === null || playerId === undefined || playerId === '') return null;
    const map = window.injuriesMap;
    if (!map || typeof map.get !== 'function') return null;
    return map.get(String(playerId)) || map.get(Number(playerId)) || null;
  }

  /**
   * Baut den Tooltip-Text für einen Status-Eintrag der InjuriesDB.
   * Verwendet die Felder der aktuellen Struktur (reason, sinceString,
   * statusChangeString, lastNewsText).
   * @param {Object|null} entry Status-Eintrag aus getInjuryStatusEntry()
   * @param {string} [status] Status-Fallback (z.B. 'AKTIV')
   * @returns {string} Tooltip-Text
   */
  function buildInjuryStatusTooltip(entry, status) {
    const statusValue = (entry && entry.status) || status || 'AKTIV';
    const parts = [getStatusDisplayName(statusValue)];
    if (!entry) return parts[0];
    if (entry.reason) parts.push(entry.reason);
    if (entry.sinceString) parts.push('seit ' + entry.sinceString);
    else if (entry.statusChangeString) parts.push('seit ' + entry.statusChangeString);
    if (entry.statusChangeString) parts.push('Änderung: ' + entry.statusChangeString);
    if (entry.lastNewsText) parts.push(entry.lastNewsText);
    return parts.join(' | ');
  }

  /**
   * Liest den optionalen Zeitstempel des Datenstands aus den Injuries-Rohdaten.
   * @param {any} data Rohdaten aus DATA_URLS.injuries
   * @returns {number|string|null} Zeitstempel oder null
   */
  function getInjuriesLastUpdate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const candidates = [data.lastUpdate, data.updatedAt, data.meta && data.meta.lastUpdate];
    for (const candidate of candidates) {
      if (candidate !== null && candidate !== undefined && candidate !== '') return candidate;
    }
    return null;
  }

  /**
   * Formatiert den optionalen "lastUpdate"-Zeitstempel der InjuriesDB lesbar.
   * Akzeptiert ISO-Strings (z.B. "2026-09-26T13:14:28.123456789Z"),
   * Millisekunden-/Sekunden-Epochs sowie bereits lesbare Strings.
   * @param {number|string|null|undefined} lastUpdate
   * @returns {string} Lesbarer Zeitstempel oder '' (wenn nicht vorhanden)
   */
  function formatInjuriesLastUpdate(lastUpdate) {
    if (lastUpdate === null || lastUpdate === undefined || lastUpdate === '') return '';
    if (typeof lastUpdate === 'string') {
      // ISO-Zeitstempel: mehr als 3 Nachkommastellen auf Millisekunden kürzen,
      // damit Date.parse den Wert zuverlässig versteht
      const isoLike = lastUpdate.replace(/(\.\d{3})\d+/, '$1');
      const parsed = new Date(isoLike);
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('de-DE');
      const numeric = Number(lastUpdate);
      if (Number.isFinite(numeric)) return formatInjuriesLastUpdate(numeric);
      return lastUpdate;
    }
    const num = Number(lastUpdate);
    if (!Number.isFinite(num)) return String(lastUpdate);
    // Sekunden-Epochs (10-stellig) auf Millisekunden hochrechnen
    const ms = num < 1e11 ? num * 1000 : num;
    return new Date(ms).toLocaleString('de-DE');
  }

  /**
   * Lädt die InjuriesDB und cached sie als Map (comunioPlayerId -> Status-Objekt).
   * Aktuelles Format:
   *   { "lastUpdate": "2026-09-26T13:14:28Z",
   *     "injuriedAndBannedPlayer": { "<comunioPlayerId>": {...} },
   *     "history": { "<comunioPlayerId>": [ {...} ] } }
   * Es wird nur "injuriedAndBannedPlayer" verwendet (history folgt später).
   * Unterstützt zusätzlich das alte flache Format { playerId: {...} }.
   * Speichert das Ergebnis in window.injuriesMap für globalen Zugriff,
   * die Rohdaten in window.injuriesRawData und den Zeitstempel (falls
   * vorhanden) in window.injuriesLastUpdate.
   * Gibt die Map zurück.
   */
  async function loadInjuriesMap() {
    try {
      if (injuriesDbPromise) await injuriesDbPromise;
    
      if (injuriesDbCache) {
        window.injuriesMap = injuriesDbCache;
        return injuriesDbCache;
      }
    
      injuriesDbPromise = fetchJSON(DATA_URLS.injuries);
      const data = await injuriesDbPromise;
    
      // Rohdaten global verfügbar machen (z.B. für die spätere "history"-Auswertung)
      window.injuriesRawData = data;

      // Optionaler Datenstand des Gesamtdatensatzes (ISO-String oder Epoch)
      const lastUpdate = getInjuriesLastUpdate(data);
      if (lastUpdate !== null) {
        window.injuriesLastUpdate = lastUpdate;
      }
    
      // Nur der Zweig "injuriedAndBannedPlayer" wird zur Map verarbeitet
      // (Key: comunioPlayerId). Die "history" wird bewusst ignoriert.
      injuriesDbCache = buildInjuriesMap(data);
      if (extractInjuriesPayload(data)) {
        const stand = formatInjuriesLastUpdate(lastUpdate);
        addDebug(`InjuriesDB geladen: ${injuriesDbCache.size} Einträge${stand ? ` (Stand: ${stand})` : ''}`);
      } else {
        addDebug("InjuriesData ist kein Objekt oder leer!", "warn");
      }
    
      window.injuriesMap = injuriesDbCache;
      return injuriesDbCache;
    } catch (err) {
      addDebug('Fehler beim Laden der Injuries-DB: ' + (err.message || err), 'error');
      window.injuriesMap = new Map();
      return window.injuriesMap;
    } finally {
      injuriesDbPromise = null;
    }
  }
