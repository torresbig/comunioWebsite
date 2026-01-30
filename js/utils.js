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

// Hilfsfunktion innerhalb von renderNews oder global verfügbar
function linkPlayer(playerId, playerName) {
    if (!playerId) {
        // Keine playerId vorhanden, kein Link, nur farbig hervorgehoben
        return `<span style="color:#80f; font-weight:bold;">${playerName}</span>`;
    }
    const url = getPlayerUrl(playerId);
    return `<a href="${url}" style="color:#80f; font-weight:bold;">${playerName}</a>`;
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
    case 'FUENFTE_GELBE_KARTE': return '🟨';
    case 'GELBROTE_KARTE': return '🟨🟥';
    case 'ROTE_KARTE': return '🟥';
    case 'NICHT_IM_KADER': return '🚫';
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
    'NICHT_IN_LIGA': 'Nicht in Liga'
  };
  return statusMap[status] || status || 'Unbekannt';
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

// Cache / Promise für Points-DB
let pointsDbCache = null;
let pointsDbPromise = null;

/**
 * Liefert die Spieltagspunkte für einen Spieler aus der externen Points-DB (DATA_URLS.points).
 * Die Points-DB wird einmal geladen und dann gecached.
 * Erwartetes Format: JSON-Object mit playerId als Key und dem Wert (z.B. Array) wie früher.
 * @param {string|number} playerId
 * @returns {Promise<any[]>} Spieltagspunkte oder leeres Array bei Fehler/fehlen.
 */
async function getPlayerSpieltagspunkte(playerId) {
  if (!playerId && playerId !== 0) return [];
  // Hilfsfunktion: Lookup robust (number / string)
  function lookup(db, id) {
    if (!db) return undefined;
    return db[id] ?? db[String(id)] ?? db[Number(id)];
  }

  try {
    // Wenn bereits geladen oder im Ladevorgang, nutze das
    if (pointsDbPromise) {
      await pointsDbPromise;
    }
    if (pointsDbCache) {
      return lookup(pointsDbCache, playerId) || [];
    }

    // Versuche PRIMARY URL aus config
    pointsDbPromise = fetchJSON(DATA_URLS.points);
    let data = null;
    try {
      data = await pointsDbPromise;
    } catch (errPrimary) {
      addDebug('Primärer Points-URL-Load fehlgeschlagen: ' + (errPrimary.message || errPrimary), 'warn');
      // Fallback: konstruiere Raw-URL ins Data-Repo (falls config falsch war)
      try {
        const fallbackUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/PointsDB.json`;
        addDebug('Versuche Fallback-URL für Points-DB: ' + fallbackUrl, 'info');
        data = await fetchJSON(fallbackUrl);
      } catch (errFallback) {
        addDebug('Fallback-Load Points-DB ebenfalls fehlgeschlagen: ' + (errFallback.message || errFallback), 'error');
        throw errFallback;
      }
    }

    pointsDbCache = data || {};
    const found = lookup(pointsDbCache, playerId);
    return found || [];
  } catch (err) {
    addDebug('Fehler beim Laden der Points-DB: ' + (err.message || err), 'error');
    return [];
  } finally {
    pointsDbPromise = null;
  }
}
