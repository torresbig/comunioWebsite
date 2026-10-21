
let newsData, playersData, p2uData, usersData, clubsData, lineupsData;
const clubsMap = new Map();
const ownersMap = new Map();
// URL-Parameter (werden nach dem Laden der Daten gesetzt)
let urlParams = { username: null, withMenue: true };

// Liest URL-Parameter: ?username=Name&withMenue=false
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        username: params.get('username'),
        withMenue: params.get('withMenue') !== 'false'
    };
}


// Findet User anhand Vor- oder Nachname (case-insensitive)
function findUserByName(users, username) {
    if (!username) return null;
    const name = username.toLowerCase();
    return users.find(u => (
        (u.user.firstName && u.user.firstName.toLowerCase() === name) ||
        (u.user.lastName && u.user.lastName.toLowerCase() === name)
    )) || null;
}

// Verarbeitet Params (z.B. Menü ausblenden)
function processUrlParams(params) {
    // Menü anzeigen/ausblenden
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    if (hamburgerMenu) hamburgerMenu.style.display = params.withMenue ? '' : 'none';
    // Merken für späteren Gebrauch (initUserDropdown)
    urlParams = params;
}

// Lade alle benötigten Daten
async function loadData() {
    try {
        [clubsData, playersData, usersData, p2uData, newsData, lineupsData] = await Promise.all([
            fetchJSON(DATA_URLS.clubs),
            fetchJSON(DATA_URLS.players),
            fetchJSON(DATA_URLS.users),
            fetchJSON(DATA_URLS.playerToUser),
            fetchJSON(DATA_URLS.news),
            fetchJSON(DATA_URLS.lineups),
            // NotInLigaDB: Spieler, die nicht mehr in der Spielerdatenbank stehen,
            // aber weiterhin Usern zugeordnet sind (Status: NICHT_IN_LIGA)
            loadNotInLigaMap(),
            // InjuriesDB (Key: comunioPlayerId) für die Status-Spalte; history wird noch nicht genutzt
            loadInjuriesMap()
        ]);
        addDebug(`InjuriesMap geladen: ${window.injuriesMap?.size || 0} Einträge`);
        addDebug(`NotInLigaMap geladen: ${window.notInLigaMap?.size || 0} Spieler`);

        // ClubsMap aufbauen
        clubsData.forEach(club => {
            if (club?.id && club?.name) {
                clubsMap.set(club.id, club.name);
            }
        });

        // OwnersMap - Beispiel: alle User als Besitzer "Computer" default-Map
        usersData.forEach(user => {
            ownersMap.set(user.user.id, user.user.firstName || 'Computer');
        });

        // URL-Parameter parsen und verarbeiten (funktioniert auch wenn keine params vorhanden sind)
        const params = getUrlParams();
        processUrlParams(params);

        initUserDropdown();
        // Run smoke tests (module import via dynamic import to avoid module scoping issues)
        try {
            import('./js/smokeTest.js').then(m => {
                if (m && typeof m.runSmokeTest === 'function') {
                    m.runSmokeTest({ newsData, playersData, usersData, p2uData });
                }
            }).catch(err => addDebug && addDebug('SmokeTest import error: ' + err.message));
        } catch (err) {
            addDebug && addDebug('SmokeTest error: ' + err.message);
        }
    } catch (error) {
        console.error("Fehler beim Laden:", error); // <-- alles ausgeben, nicht nur message!
        addDebug("Fehler beim Laden: " + (error && error.message ? error.message : JSON.stringify(error)));
    }
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

function initUserDropdown() {
    const btn = document.getElementById('userSelectBtn');
    const ul = document.getElementById('userDropdown');

    // Nur echte User nehmen!
    const realUsers = usersData.filter(u => u.user.firstName !== "Computer");

    ul.innerHTML = '';

    realUsers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.user.firstName + (u.user.lastName ? ' ' + u.user.lastName : '');
        li.onclick = () => {
            btn.textContent = li.textContent + ' ▼';
            ul.classList.remove('show');
            loadPlayersForUser(u.user.id);
        };
        ul.appendChild(li);
    });

    btn.onclick = function (e) {
        ul.classList.toggle('show');
        e.stopPropagation(); // Verhindert sofortiges Schließen!
    };

    // Schließt das Dropdown beim Klick überall sonst
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) ul.classList.remove('show');
    });

    // Wenn ein username-Parameter gesetzt ist, versuche den User zu finden
    if (urlParams && urlParams.username) {
        const userFromUrl = findUserByName(usersData, urlParams.username);
        const noticeEl = document.getElementById('urlNotice');
        if (userFromUrl) {
            const displayName = userFromUrl.user.firstName + (userFromUrl.user.lastName ? ' ' + userFromUrl.user.lastName : '');
            // Ersetze den Button durch ein unveränderliches Label (sauberer als disabled button)
            btn.style.display = 'none';
            ul.style.display = 'none';
            const label = document.createElement('div');
            label.id = 'selectedUserLabel';
            label.textContent = displayName;
            label.style.fontWeight = '600';
            label.style.margin = '6px 0';
            // Füge das Label an Stelle des Buttons ein
            btn.parentNode.insertBefore(label, btn);
            addDebug(`Username aus URL verwendet: ${displayName}`);
            loadPlayersForUser(userFromUrl.user.id);
            return; // fertig
        } else {
            const msg = `Username in URL nicht gefunden: ${urlParams.username} — zeige Standard-User.`;
            addDebug(msg);
            if (noticeEl) {
                noticeEl.textContent = msg;
                noticeEl.style.display = 'block';
            }
        }
    }

    // Beim Start: Ersten echten User vorauswählen (Fallback)
    const firstUser = realUsers[0];
    if (firstUser) {
        btn.textContent = firstUser.user.firstName + (firstUser.user.lastName ? ' ' + firstUser.user.lastName : '') + ' ▼';
        loadPlayersForUser(firstUser.user.id);
    }
}

const ul = document.getElementById('userDropdown');

document.addEventListener('click', function (e) {
    // Schließe Dropdown nur, wenn es existiert und offen ist
    if (ul && ul.classList.contains('show') && !e.target.closest('.dropdown')) {
        ul.classList.remove('show');
    }
});

function getPlayerUrlWithParams(playerId) {
    let playerUrl = getPlayerUrl(playerId);
    if (urlParams.withMenue === false) {
        playerUrl += '&withMenue=false';
    }
    return playerUrl;
}



// Spieler für ausgewählten User laden und Tabelle rendern
// --- Spieler-Lookup ueber beide Datenbanken (Liga + NotInLigaDB) -------------

/**
 * Index der Liga-Spieler (comunioPlayerId -> Eintrag der Spielerdatenbank).
 * @returns {Map<string, Object>}
 */
function buildPlayerIndex() {
    const index = new Map();
    (playersData?.playerDB || []).forEach(player => {
        if (!player || player.id === undefined || player.id === null) return;
        index.set(String(player.id), player);
    });
    return index;
}

/**
 * Sucht einen Spieler in der Spielerdatenbank und - falls er dort nicht mehr
 * steht - in der NotInLigaDB (Eintraege dort haben notInLiga: true).
 * @param {string|number} playerId
 * @returns {Object|null}
 */
function findPlayerById(playerId) {
    if (playerId === null || playerId === undefined || playerId === '') return null;
    const id = String(playerId);
    const fromDb = (playersData?.playerDB || []).find(p => String(p.id) === id);
    return fromDb || getNotInLigaEntry(id) || null;
}

/**
 * Sucht den Spielernamen zu einer ID in den Transfer-/Statusnews. Letzte
 * Rettung fuer IDs, die in keiner Datenbank mehr stehen.
 * @param {string|number} playerId
 * @returns {string} Name oder '' (wenn nicht gefunden)
 */
function findPlayerNameInNews(playerId) {
    const id = String(playerId);
    const days = newsData?.newsDB || [];
    for (const day of days) {
        for (const item of (day.news || [])) {
            if (String(item.playerId) !== id) continue;
            if (item.art === 'TRANSFER') {
                try {
                    const transfer = JSON.parse(item.text);
                    if (transfer?.playerName) return transfer.playerName;
                } catch (err) { /* ungueltiges JSON ignorieren */ }
            }
            const parsed = (typeof parseSpielerstatusNewsText === 'function')
                ? parseSpielerstatusNewsText(item.text)
                : null;
            if (parsed?.playerName) return parsed.playerName;
        }
    }
    return '';
}

/**
 * Fallback fuer IDs, die nur noch in der PlayerToUserMap stehen (weder
 * Spielerdatenbank noch NotInLigaDB) -> Status UNBEKANNT.
 * @param {string|number} playerId
 * @returns {Object} Spielerobjekt im Format der Spielerdatenbank
 */
function buildUnknownPlayer(playerId) {
    const name = findPlayerNameInNews(playerId);
    return {
        id: String(playerId),
        name: name || ('Spieler ' + playerId),
        data: {},
        unknown: true
    };
}

/**
 * Alle Spieler eines Users. Basis ist die PlayerToUserMap (nicht die
 * Spielerdatenbank), damit Spieler, die nicht mehr in der Liga sind,
 * weiterhin angezeigt werden.
 * @param {string|number} userId
 * @returns {Array<Object>}
 */
function getPlayersForUser(userId) {
    const map = Object.assign({}, ...p2uData);
    const index = buildPlayerIndex();
    const players = [];
    let notInLigaCount = 0;
    let unknownCount = 0;
    Object.keys(map).forEach(playerId => {
        if (String(map[playerId]) !== String(userId)) return;
        let player = index.get(String(playerId)) || getNotInLigaEntry(playerId);
        if (player) {
            if (player.notInLiga) notInLigaCount++;
        } else {
            player = buildUnknownPlayer(playerId);
            unknownCount++;
        }
        players.push(player);
    });
    addDebug(`Players for user ${userId}: ${players.length} (${notInLigaCount} nicht in Liga, ${unknownCount} unbekannt)`);
    return players;
}
function loadPlayersForUser(userId) {
    addDebug("=== loadPlayersForUser START ===");
    // Render user info card for selected user (if available)
    try { renderUserInfo(userId); } catch (err) { addDebug && addDebug('renderUserInfo error: ' + err.message); }
    // Basis ist bewusst die PlayerToUserMap und nicht die Spielerdatenbank:
    // sonst fehlen Spieler, die nicht mehr in der Liga stehen (NotInLigaDB).
    let list = getPlayersForUser(userId);

    addDebug(`Found ${list.length} players for user ${userId}`);

    // Debug positions before sorting
    list.forEach(p => {
        const hint = p.notInLiga ? ' (nicht in Liga)' : (p.unknown ? ' (unbekannt)' : '');
        addDebug(`Player ${p.name}: Position = ${p.data?.position}${hint}`);
    });

    // Hilfsfunktion für Positionssortierung
    const getPositionSortValue = (position) => {
        const positionOrder = {
            'TORHÜTER': 0,
            'ABWEHR': 1,
            'MITTELFELD': 2,
            'STURM': 3
        };
        const value = positionOrder[position];
        if (value === undefined) {
            addDebug(`WARNING: Unknown position: ${position}`);
            return 999; // Unbekannte Positionen ans Ende
        }
        return value;
    };

    // Liste nach Position sortieren
    const sortedList = [...list].sort((a, b) => {
        const posA = getPositionSortValue(a.data?.position || '');
        const posB = getPositionSortValue(b.data?.position || '');

        if (posA !== posB) {
            return posA - posB;
        }

        // Bei gleicher Position nach Name sortieren
        return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    });

    // Debug positions after sorting
    addDebug("=== Sorted Players ===");
    sortedList.forEach(p => {
        addDebug(`${p.data?.position}: ${p.name}`);
    });

    // Rendere die sortierte Liste und erzwinge die Positionssortierung
    renderTable(sortedList);
    // Token gegen veraltete Laeufe bei schnellem Userwechsel
    const renderToken = ++playerTableRenderToken;
    // Warte einen kurzen Moment und sortiere dann nochmal explizit nach Position
    setTimeout(() => {
        // Abbruch falls inzwischen ein neuer User geladen wurde
        if (renderToken !== playerTableRenderToken) return;
        const playerTable = document.getElementById('playerTable');
        if (playerTable) {
            playerTable.removeAttribute('data-sort-column');
            sortTable(playerTable, 3); // Position ist Spalte 3 (0-basiert)
        }
        // Beim Seitenaufruf (und bei jedem Userwechsel) immer den ersten Spieler anzeigen
        if (sortedList.length > 0) {
            selectPlayerRow(sortedList[0]);
            fillPlayerDetails(sortedList[0]);
        } else {
            clearDetails();
        }
    }, 100);

    renderTransfers(userId);
    renderLineups(userId);
    addDebug("=== loadPlayersForUser END ===");
}

function renderLineupDetailGroups(player) {
    const groups = buildLineupDetailGroups(player);
    if (!groups.length) return '<div class="lineup-detail-empty">Für diesen Spieltag liegen keine Detaildaten vor.</div>';
    return groups.map(group => `<div class="lineup-detail-group"><div class="lineup-detail-group-title">${escapeHtml(group.title)}</div><div class="lineup-detail-grid">${group.items.map(item => `<div class="lineup-detail-item"><small>${escapeHtml(item.label)}</small><b class="${item.tone ? `tone-${item.tone}` : ''}">${escapeHtml(item.value)}</b></div>`).join('')}</div></div>`).join('');
}

function renderLineupDetails(player) {
    return `<div class="lineup-player-details"><strong>${escapeHtml(player.name)}</strong><span class="lineup-detail-status">${escapeHtml(player.statusText)}</span>${renderLineupDetailGroups(player)}</div>`;
}

function getLineupPositionLogo(position) {
    const positionNames = { keeper: 'TORHÜTER', defender: 'ABWEHR', midfielder: 'MITTELFELD', striker: 'STURM' };
    return getLogoPositionFilename(positionNames[position] || position);
}

async function renderLineups(userId) {
    const status = document.getElementById('lineupStatus');
    const container = document.getElementById('lineupList');
    if (!status || !container) return;
    const matchdays = Object.entries(lineupsData || {})
        .map(([matchday, users]) => [matchday, users?.[String(userId)]])
        .filter(([, lineup]) => lineup)
        .sort((a, b) => Number(b[0]) - Number(a[0]));
    if (!matchdays.length) {
        status.textContent = 'Für diesen User sind keine Aufstellungen gespeichert.';
        container.innerHTML = '';
        return;
    }

    status.textContent = `${matchdays.length} Aufstellungen gefunden`;
    container.innerHTML = '<div class="lineup-loading">Aufstellungen und Spieltagspunkte werden geladen ...</div>';

    // Points-DB einmal laden (statt eines Abrufs pro Spieler) – getPointsDb() cached das Ergebnis.
    let pointsDb = {};
    try {
        pointsDb = await getPointsDb();
    } catch (error) {
        addDebug('Spieltagspunkte konnten nicht geladen werden: ' + (error?.message || error));
    }
    if (!Object.keys(pointsDb).length) {
        status.textContent = `${matchdays.length} Aufstellungen gefunden (Spieltagspunkte nicht verfügbar)`;
    }

    const cards = matchdays.map(([matchday, lineup]) => {
        const players = Array.isArray(lineup.players) ? lineup.players : [];
        const enriched = players.map(player => {
            const playerDbEntry = findPlayerById(player.id);
            const pointEntry = getLineupPointsByPlayer(getPointsEntriesForPlayer(pointsDb, player.id), matchday);
            // Comunio-Spieltagspunkte (points, früher "value"). Nur falls die Points-DB
            // keinen Wert hat, die in der Aufstellung gespeicherten Punkte als Fallback nutzen.
            const pointsValue = toLineupNumber(pointEntry?.points) ?? toLineupNumber(player.points);
            return {
                ...player,
                pointEntry,
                clubId: playerDbEntry?.data?.verein || player.clubId,
                position: playerDbEntry?.data?.position || player.position,
                pointsValue,
                pointsDetail: toLineupNumber(pointEntry?.points),
                minutes: getLineupEinsatzzeit(pointEntry),
                statusText: getLineupStatusText(player, pointEntry)
            };
        });
        const starters = enriched.filter(player => !player.substitute);
        const substitutes = enriched.filter(player => player.substitute);
        const summary = buildLineupSummary(enriched);
        const renderPlayer = (player, index, group = 'player') => {
            const clubName = clubsMap.get(player.clubId) || 'Verein unbekannt';
            const clubLogo = player.clubId ? `<img src="${DATA_URLS.logos}${getLogoFileName(player.clubId)}" class="lineup-club-logo" alt="${escapeHtml(clubName)}" title="${escapeHtml(clubName)}">` : '';
            const positionLogo = `<img src="logos/${getLineupPositionLogo(player.position)}" class="lineup-position-logo" alt="${escapeHtml(player.position || 'Position')}" title="${escapeHtml(player.position || 'Position')}">`;
            const pointsTone = player.pointsValue === null ? '' : (player.pointsValue < 0 ? 'negative' : (player.pointsValue >= 10 ? 'positive' : ''));
            const rating = toLineupNumber(player.pointEntry?.rating);
            const hasRating = rating !== null && rating > 0;
            const ratingTone = hasRating ? (rating >= 7 ? 'positive' : (rating < 5 ? 'negative' : '')) : '';
            const minutesText = player.minutes !== null && player.minutes > 0 ? `${player.minutes} Min.` : '—';
            const detailId = `lineup-detail-${matchday}-${group}-${index}`;
            return `<tr class="lineup-player-row" data-detail-id="${detailId}"><td><span class="lineup-player-name">${clubLogo}<a href="${getPlayerUrlWithParams(player.id)}">${escapeHtml(player.name)}</a></span></td><td>${positionLogo}</td><td class="lineup-status-cell">${escapeHtml(player.statusText)}</td><td class="lineup-points-cell${pointsTone ? ` tone-${pointsTone}` : ''}">${player.pointsValue === null ? '—' : player.pointsValue}</td><td class="lineup-note-col${ratingTone ? ` tone-${ratingTone}` : ''}">${escapeHtml(hasRating ? formatLineupRating(rating) : '—')}</td><td>${escapeHtml(minutesText)}</td></tr><tr id="${detailId}" class="lineup-detail-row"><td colspan="6">${renderLineupDetails(player)}</td></tr>`;
        };
        const summaryParts = [`Startelf: ${summary.starterPoints} Pkt.`];
        if (summary.benchCount) summaryParts.push(`Ersatzbank: ${summary.benchPoints} Pkt.`);
        if (summary.goals) summaryParts.push(summary.goals === 1 ? '1 Tor' : `${summary.goals} Tore`);
        if (summary.assists) summaryParts.push(summary.assists === 1 ? '1 Vorlage' : `${summary.assists} Vorlagen`);
        if (summary.withoutDataCount) summaryParts.push(`${summary.withoutDataCount}× ohne Daten`);
        return `<section class="lineup-card"><div class="lineup-card-header"><div class="lineup-card-title"><h2>Spieltag ${escapeHtml(matchday)}</h2><div class="lineup-summary">${escapeHtml(summaryParts.join(' · '))}</div></div><span class="lineup-tactic">${escapeHtml(lineup.tactic || '—')}</span></div><div class="lineup-table-wrap"><table><thead><tr><th>Spieler</th><th>Pos.</th><th>Status</th><th>Pkt.</th><th class="lineup-note-col">Note</th><th>Spielzeit</th></tr></thead><tbody>${starters.map((player, index) => renderPlayer(player, index, 'starter')).join('')}${substitutes.length ? `<tr class="lineup-substitute-divider"><th colspan="6">Ersatzbank</th></tr>${substitutes.map((player, index) => renderPlayer(player, index, 'substitute')).join('')}` : ''}</tbody></table></div></section>`;
    });
    container.innerHTML = cards.join('');
    container.querySelectorAll('.lineup-player-row').forEach(row => row.addEventListener('click', () => {
        const detail = document.getElementById(row.dataset.detailId);
        const wasOpen = detail.classList.contains('open');
        container.querySelectorAll('.lineup-detail-row.open').forEach(item => item.classList.remove('open'));
        if (!wasOpen) detail.classList.add('open');
    }));
}

function initOverviewTabs() {
    const tabs = document.querySelector('.overview-tabs');
    if (!tabs) return;
    const buttons = tabs.querySelectorAll('.tab-button');
    buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.overview-tab-content').forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab)?.classList.add('active');
    }));
}

// ─── Spieler-Details-Karte (Team-Tab) ────────────────────────────────────────

let selectedDetailPlayerId = null;

// Aktuell angezeigte Spieler (ID -> Spielerobjekt) fuer die automatische Auswahl.
let currentPlayersById = new Map();
// Token gegen veraltete Render-/Sortierlaeufe (z. B. schneller Userwechsel).
let playerTableRenderToken = 0;

/** Alter aus "13.07.1993" -> "33 Jahre" (oder null). */
function calcPlayerAge(birthday) {
    if (!birthday || birthday === 'N/A') return null;
    try {
        const birthDate = new Date(birthday.split('.').reverse().join('-'));
        if (isNaN(birthDate.getTime())) return null;
        const diff = Date.now() - birthDate.getTime();
        const years = Math.abs(new Date(diff).getUTCFullYear() - 1970);
        return years > 0 ? `${years} Jahre` : null;
    } catch (err) {
        return null;
    }
}

/** Marktwert formatiert kompakt ("2,82 Mio. €" / "750 Tsd. €"). */
function fmtEuroShort(value) {
    const amount = toLineupNumber(value);
    if (amount === null) return '—';
    if (amount >= 1000000) return (amount / 1000000).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + ' Mio. €';
    if (amount >= 1000) return Math.round(amount / 1000).toLocaleString('de-DE') + ' Tsd. €';
    return amount.toLocaleString('de-DE') + ' €';
}

/** Kachel für die Kennzahlen-Grids; gibt '' aus, wenn kein Wert vorliegt. */
function pdTile(label, valueHtml, tone) {
    if (valueHtml === null || valueHtml === undefined || valueHtml === '' || valueHtml === '—') return '';
    return `<div class="pd-tile${tone ? ` tone-${tone}` : ''}"><small>${escapeHtml(label)}</small><b>${valueHtml}</b></div>`;
}

/** Gruppe mit Titel und Grid aus Kachel-HTML; '' wenn keine Kacheln vorhanden. */
function pdGroup(title, tilesHtml) {
    if (!tilesHtml) return '';
    return `<div class="pd-group"><div class="pd-group-title">${escapeHtml(title)}</div><div class="pd-grid">${tilesHtml}</div></div>`;
}

/**
 * Saison-Zusammenfassung aus den Spieltagseinträgen der Points-DB.
 * @param {Array<Object>} entries Einträge von getPointsEntriesForPlayer()
 * @returns {Object|null} Summen oder null (keine Daten)
 */
function buildPlayerSeasonSummary(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;
    const sorted = entries.slice().sort((a, b) => (Number(a.key) || 0) - (Number(b.key) || 0));
    const summary = { games: 0, total: 0, minutes: 0, goals: 0, assists: 0, rated: 0, ratedSum: 0, entries: sorted };
    sorted.forEach(entry => {
        const points = toLineupNumber(entry.points);
        if (points !== null) summary.total += points;
        const minutes = getLineupEinsatzzeit(entry);
        if (minutes !== null) summary.minutes += minutes;
        const goals = toLineupNumber(entry.tore);
        if (goals !== null && goals > 0) summary.goals += goals;
        const assists = toLineupNumber(entry.goalAssists);
        if (assists !== null && assists > 0) summary.assists += assists;
        if (entry.status && entry.status !== 'NONE') summary.games += 1;
        const rating = toLineupNumber(entry.rating);
        if (rating !== null && rating > 0) {
            summary.rated += 1;
            summary.ratedSum += rating;
        }
    });
    return summary;
}

/** Status-Details (Grund/Seit) als Hinweis-Box – nur bei Nicht-Aktiv-Status. */
function buildStatusDetailHtml(statusEntry, status) {
    if (!statusEntry || status === 'AKTIV' || status === 'UNBEKANNT') return '';
    const rows = [];
    if (statusEntry.reason) rows.push(['Grund', statusEntry.reason]);
    const since = statusEntry.sinceString || statusEntry.statusChangeString;
    if (since) rows.push(['Seit', since]);
    if (!rows.length) return '';
    return `<div class="pd-notice">${rows.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join('')}</div>`;
}

/**
 * Sammelt alle Daten für die Details-Karte (Status, Verein, Marktwert, Saison).
 * Lädt zusätzlich die (gecachte) Points-DB für die Saison-Kennzahlen.
 * @param {Object} player Spielerobjekt
 * @returns {Promise<Object|null>} Modell fürs Rendering oder null (Klick war veraltet)
 */
async function buildPlayerDetailModel(player) {
    const data = player.data || {};
    const sd = data.spielerDaten || {};
    const stats = data.stats || {};

    // ── Status ──
    const statusEntry = getPlayerStatusEntry(player.id, { unknown: player.unknown === true });
    const status = (statusEntry && statusEntry.status) ? statusEntry.status : 'AKTIV';
    const statusTooltip = (statusEntry && statusEntry.notInLiga)
        ? buildNotInLigaTooltip(statusEntry)
        : buildInjuryStatusTooltip(statusEntry, status);

    // ── Verein & Position ──
    const clubId = data.verein || '0';
    const clubName = player.notInLiga
        ? 'Nicht in Liga'
        : (player.unknown ? 'Unbekannt' : (clubsMap.get(clubId) || 'UNBEKANNT'));
    const clubLogo = `<img class="pd-club-logo" src="logos/${getLogoFileName(clubId)}" alt="${escapeHtml(clubName)}" title="${escapeHtml(clubName)}">`;
    const position = data.position || '';
    const nebenpositionen = Array.isArray(sd.nebenpositionen) ? sd.nebenpositionen : [];
    const positionTooltip = sd.hauptposition
        ? (nebenpositionen.length ? `Hauptposition: ${sd.hauptposition} | Nebenpositionen: ${nebenpositionen.join(', ')}` : sd.hauptposition)
        : position;
    const positionBadge = position
        ? `<span class="pd-position" title="${escapeHtml(positionTooltip)}"><img src="logos/${getLogoPositionFilename(position)}" alt="${escapeHtml(position)}">${escapeHtml(position)}</span>`
        : '';

    // ── Points-DB (gecacht) für Saison-Kennzahlen ──
    let pointsDb = {};
    try {
        pointsDb = await getPointsDb();
    } catch (error) {
        addDebug('Spieltagspunkte konnten nicht geladen werden: ' + (error?.message || error));
    }
    // Klick kam währenddessen auf einen anderen Spieler -> nicht überschreiben
    if (selectedDetailPlayerId !== String(player.id)) return null;

    const seasonEntries = getPointsEntriesForPlayer(pointsDb, player.id);
    const season = buildPlayerSeasonSummary(seasonEntries);
    const avgRating = (season && season.rated)
        ? (season.ratedSum / season.rated).toFixed(1).replace('.', ',')
        : (stats.notenDurchschnitt || null);

    return { player, statusEntry, status, statusTooltip, clubName, clubLogo, positionBadge, seasonEntries, season, avgRating };
}

// Spielerdetails füllen (Kopf sofort, Kennzahlen nach dem Laden der Points-DB)
async function fillPlayerDetails(player) {
    selectedDetailPlayerId = String(player.id);
    await renderPlayerDetailBody(player);
    if (selectedDetailPlayerId === String(player.id)) addDebug(`Details geladen: ${player.name}`);
}

/** Letzte Spieltage als kompakte Chips (Punkte farblich hervorgehoben). */
function buildLastMatchdaysHtml(entries, count = 5) {
    if (!Array.isArray(entries) || !entries.length) return '';
    const chips = entries.slice(-count).reverse().map(entry => {
        const points = toLineupNumber(entry.points);
        const tone = points === null ? '' : (points < 0 ? 'negative' : (points >= 10 ? 'positive' : ''));
        const minutes = getLineupEinsatzzeit(entry);
        const title = `Spieltag ${entry.key}${minutes !== null ? ` | ${minutes} Min.` : ''}`;
        return `<div class="pd-md${tone ? ` tone-${tone}` : ''}" title="${escapeHtml(title)}">ST ${escapeHtml(String(entry.key))}<b>${points === null ? '—' : points}</b></div>`;
    });
    return `<div class="pd-group"><div class="pd-group-title">Letzte Spieltage</div><div class="pd-md-row">${chips.join('')}</div></div>`;
}

/** Saisonverlauf (historicalPoints) als Mini-Balken. */
function buildHistoricalPointsHtml(historicalPoints) {
    if (!Array.isArray(historicalPoints) || historicalPoints.length < 2) return '';
    const rows = [];
    historicalPoints.forEach(item => {
        if (!item || typeof item !== 'object') return;
        Object.entries(item).forEach(([year, rawValue]) => {
            const value = toLineupNumber(rawValue);
            if (value === null) return;
            rows.push({ year, value });
        });
    });
    if (rows.length < 2) return '';
    const maxAbs = Math.max(...rows.map(row => Math.abs(row.value)), 1);
    const bars = rows.map(row => {
        const width = Math.max(4, Math.round(Math.abs(row.value) / maxAbs * 100));
        const negative = row.value < 0 ? ' negative' : '';
        return `<div class="pd-hist-row${negative}"><span>${escapeHtml(row.year)}</span><div class="pd-hist-bar"><i style="width:${width}%"></i></div><b>${row.value}</b></div>`;
    });
    return `<div class="pd-group"><div class="pd-group-title">Vergangene Saisons (Punkte)</div><div class="pd-hist">${bars.join('')}</div></div>`;
}

/** Externe Profile (Ligainsider/Transfermarkt/com-analytics) als Link-Buttons. */
function buildExternalLinksHtml(player) {
    const links = [];
    const ligainsider = player.data?.ligainsider?.playerLink;
    const transfermarkt = player.data?.transfermarktDoDe?.link;
    const comAnalytics = player.data?.comAnalystics?.link;
    if (ligainsider) links.push(['Ligainsider', ligainsider]);
    if (transfermarkt) links.push(['Transfermarkt', transfermarkt]);
    if (comAnalytics) links.push(['com-analytics', comAnalytics]);
    if (!links.length) return '';
    const buttons = links.map(([label, url]) => `<a class="pd-link-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)} ↗</a>`).join('');
    return `<div class="pd-group"><div class="pd-group-title">Externe Profile</div><div class="pd-links">${buttons}</div></div>`;
}

/**
 * Rendert die Details-Karte (Kopf + Kennzahlen-Gruppen) anhand des Modells
 * aus buildPlayerDetailModel().
 * @param {Object} player Spielerobjekt
 */
async function renderPlayerDetailBody(player) {
    const card = document.getElementById('playerDetails');
    if (!card) return;
    const model = await buildPlayerDetailModel(player);
    if (!model) return; // Klick war veraltet (anderer Spieler ausgewählt)
    const { statusEntry, status, statusTooltip, clubName, clubLogo, positionBadge, seasonEntries, season, avgRating } = model;
    const data = player.data || {};
    const sd = data.spielerDaten || {};
    const stats = data.stats || {};
    const statusClass = getStatusClass(status);

    // ── Marktwert inkl. Trend und Delta ──
    const wert = toLineupNumber(data.wert);
    const lastWert = toLineupNumber(data.lastWert);
    const wertDelta = wert !== null && lastWert !== null ? wert - lastWert : null;
    const wertDeltaHtml = wertDelta
        ? ` <span class="pd-delta ${wertDelta > 0 ? 'tone-positive' : 'tone-negative'}">(${wertDelta > 0 ? '+' : '−'}${fmtEuroShort(Math.abs(wertDelta))})</span>`
        : '';

    // ── Hinweise (Nicht-in-Liga / Karriereende / unbekannt) ──
    const hints = [];
    if (player.notInLiga) hints.push('Nicht mehr in der Liga');
    if (player.retired) hints.push('Karriere beendet');
    if (player.unknown) hints.push('Keine Daten in der Datenbank vorhanden');
    const hintsHtml = hints.length ? `<div class="pd-notice">${escapeHtml(hints.join(' · '))}</div>` : '';

    // ── Gruppe: Saison (Points-DB + Fallback Spielerdatenbank) ──
    const seasonTiles = [
        pdTile('Punkte', season ? String(season.total) : (toLineupNumber(data.punkte) !== null ? String(data.punkte) : null), season && season.total > 0 ? 'tone-positive' : ''),
        pdTile('Ø-Punkte', stats.punkteDurchschnitt || (season && season.games ? (season.total / season.games).toFixed(1).replace('.', ',') : null)),
        pdTile('Ø-Note', avgRating),
        pdTile('Spiele', season ? String(season.games) : (toLineupNumber(stats.playedGames) !== null ? String(stats.playedGames) : null)),
        pdTile('Tore', season ? String(season.goals) : (toLineupNumber(stats.tore) !== null ? String(stats.tore) : null)),
        pdTile('Vorlagen', season ? String(season.assists) : null),
        pdTile('Spielzeit', season && season.minutes ? `${season.minutes} Min.` : null),
        pdTile('11 des Tages', toLineupNumber(data.elfDesSpieltages) ? `${data.elfDesSpieltages} ×` : null),
        pdTile('Ligainsider-Rang', toLineupNumber(data.attribute?.ligainsiderRanking?.rang) ? `#${data.attribute.ligainsiderRanking.rang}` : null),
        pdTile('Letzter Spieltag', toLineupNumber(data.lastPoints) !== null ? `${data.lastPoints} Pkt.` : null)
    ].join('');

    // ── Gruppe: Marktwerte ──
    const marketTiles = [
        pdTile('Marktwert', `${fmtEuroShort(wert)} ${unicodeTrend(getPlayerValueTrend(player))}${wertDeltaHtml}`),
        pdTile('Vorheriger Wert', wertDelta !== null ? fmtEuroShort(lastWert) : null),
        pdTile('Realer Wert', toLineupNumber(data.realWert) !== null ? fmtEuroShort(data.realWert) : null),
        pdTile('Transfermarkt', toLineupNumber(data.transfermarktDoDe?.marktwert) !== null ? fmtEuroShort(data.transfermarktDoDe.marktwert) : null)
    ].join('');

    // ── Gruppe: Stammdaten ──
    const hauptposition = sd.hauptposition || data.position || null;
    const nebenpositionen = Array.isArray(sd.nebenpositionen) ? sd.nebenpositionen : [];
    const hauptpositionValue = hauptposition
        ? (nebenpositionen.length ? `${escapeHtml(hauptposition)} (${escapeHtml(nebenpositionen.join(', '))})` : escapeHtml(hauptposition))
        : null;
    const infoTiles = [
        pdTile('Hauptposition', hauptpositionValue),
        pdTile('Nationalität', sd.nationalitaet ? escapeHtml(sd.nationalitaet) : null),
        pdTile('Alter', calcPlayerAge(sd.geburtstag)),
        pdTile('Geburtstag', sd.geburtstag ? escapeHtml(sd.geburtstag) : null),
        pdTile('Größe', sd.groesse ? `${escapeHtml(sd.groesse)} m` : null),
        pdTile('Trikot-Nr.', toLineupNumber(sd.trikotNummer) !== null ? String(sd.trikotNummer) : null),
        pdTile('Fuß', sd.fuss ? escapeHtml(sd.fuss) : null),
        pdTile('Länderspiele', toLineupNumber(sd.laenderspiele) !== null ? String(sd.laenderspiele) : null),
        pdTile('Datenstand', data.lastUpdate ? escapeHtml(data.lastUpdate) : null)
    ].join('');

    card.innerHTML = `
      <div class="pd-header">
        <div class="pd-header-main">
          ${clubLogo}
          <div class="pd-name-block">
            <a class="pd-name" href="${getPlayerUrlWithParams(player.id)}">${escapeHtml(player.name)}</a>
            <div class="pd-sub">${escapeHtml(clubName)} · ID ${escapeHtml(String(player.id))}</div>
          </div>
        </div>
        <div class="pd-badges">
          ${positionBadge}
          <span class="pd-status ${statusClass}" title="${escapeHtml(statusTooltip)}">${getStatusIndicator(status)} ${escapeHtml(getStatusDisplayName(status))}</span>
        </div>
      </div>
      ${hintsHtml}
      ${buildStatusDetailHtml(statusEntry, status)}
      ${pdGroup('Saison', seasonTiles)}
      ${buildLastMatchdaysHtml(seasonEntries)}
      ${pdGroup('Marktwert', marketTiles)}
      ${pdGroup('Stammdaten', infoTiles)}
      ${buildHistoricalPointsHtml(data.historicalPoints)}
      ${buildExternalLinksHtml(player)}
      <div class="pd-footer"><a class="pd-link-btn pd-link-primary" href="${getPlayerUrlWithParams(player.id)}">Alle Details & Statistiken anzeigen →</a></div>`;
}

function clearDetails() {
    const card = document.getElementById('playerDetails');
    if (!card) return;
    selectedDetailPlayerId = null;
    card.innerHTML = '<div class="pd-empty">Klicke auf einen Spieler in der Tabelle, um alle Details und Statistiken zu sehen.</div>';
}

/** Markiert die Tabellenzeile des gegebenen Spielers als ausgewaehlt. */
function selectPlayerRow(player) {
    document.querySelectorAll('#playerTable tr').forEach(r => r.classList.remove('selected'));
    const row = document.querySelector('#playerTable tr[data-player-id="' + String(player.id) + '"]');
    if (row) row.classList.add('selected');
}

// Spieler-Tabelle rendern (aus generatePlayerTable.js)
function renderTable(players) {
    const tableBody = document.querySelector('#playerTable tbody');
    tableBody.innerHTML = '';
    addDebug(`Rendere Tabelle mit ${players.length} Spielern`);
    players.forEach(player => {
        const row = document.createElement('tr');
        row.setAttribute('data-player-id', player.id);
        row.addEventListener('click', () => {
            document.querySelectorAll('#playerTable tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            fillPlayerDetails(player);
        });



        const clubId = player.data?.verein || "0";
        // Nicht-in-Liga-Spieler haben verein "0"; die Vereinsdatenbank liefert dazu
        // "UNBEKANNT", daher hier einen sprechenden Wert anzeigen.
        const clubName = player.notInLiga
            ? 'Nicht in Liga'
            : (player.unknown ? 'Unbekannt' : (clubsMap.get(clubId) || 'UNBEKANNT'));
        const logoFile = getLogoFileName(clubId);
        const logoHtml = `<img src="logos/${logoFile}" class="club-logo" alt="${clubName}" title="${clubName}">`;
        const playerNameHtml = `<a href="${getPlayerUrlWithParams(player.id)}" title="${player.name} (ID: ${player.id})" target="_self">${player.name}</a>`;

        // Position mit Sortier-Index
        const positionOrder = {
            'TORHÜTER': 0,
            'ABWEHR': 1,
            'MITTELFELD': 2,
            'STURM': 3
        };
        const position = player.data?.position || "Unbekannt";
        const positionSortValue = positionOrder[position] ?? 999;
        const hauptposition = player.data?.spielerDaten?.hauptposition || "N/A";
        const nebenpositionen = player.data?.spielerDaten?.nebenpositionen || [];
        const nebenpositionenTooltip = nebenpositionen.length > 0 ? "Hauptposition: " + hauptposition + " | Nebenposition: " + nebenpositionen.join(", ") : "";
        const posLogoFile = getLogoPositionFilename(position);
        const positionHtml = `<img src="logos/${posLogoFile}" class="pos-logo" alt="${position}" title="${nebenpositionenTooltip || position}">`;
        // Status zentral aus utils: NotInLigaDB -> NICHT_IN_LIGA, sonst InjuriesDB
        const statusEntry = getPlayerStatusEntry(player.id, { unknown: player.unknown === true });
        const status = (statusEntry && statusEntry.status) ? statusEntry.status : 'AKTIV';
        const statusClass = getStatusClass(status);
        const statusTooltip = (statusEntry && statusEntry.notInLiga)
            ? buildNotInLigaTooltip(statusEntry)
            : buildInjuryStatusTooltip(statusEntry, status);

        let marketValue = 'Unbekannt';
        let marketValueSort = 0;
        if (player.data?.wert) {
            marketValueSort = player.data.wert;
            marketValue = marketValueSort < 1000000
                ? `${(marketValueSort / 1000).toFixed(0)} Tsd. €`
                : `${(marketValueSort / 1000000).toFixed(2)} Mio. €`;
        }
        marketValue += ` ${unicodeTrend(getPlayerValueTrend(player))}`;
        const points = player.data?.punkte || 0;
        const lastUpdate = player.data?.lastUpdate || 'Unbekannt';

        row.innerHTML = `
        <td data-sort="${clubName}">${logoHtml}</td>
        <td data-sort="${player.name}">${playerNameHtml}</td>
        <td data-sort="${status}" class="${statusClass}">
  <span title="${escapeHtml(statusTooltip)}">${getStatusIndicator(status)}</span>
</td>
        <td data-sort="${String(positionSortValue).padStart(3, '0')}_${position}">${positionHtml}</td>
        <td data-sort="${marketValueSort}">${marketValue}</td>
        <td data-sort="${points}">${points}</td>
      `;
        tableBody.appendChild(row);
    });

    // Initial sort by position (column index 2)
    sortTable(document.getElementById('playerTable'), 3);
}

// Transfers anzeigen (mit Filtern für Käufe/Verkäufe)
function renderTransfers(userId) {
    addDebug("=== renderTransfers START ===");

    const entries = [];
    try {
        newsData.newsDB.forEach(day => {
            day.news.forEach(item => {
                if (item.art === 'TRANSFER') {
                    const t = JSON.parse(item.text);
                    const isMyPurchase = t.buyerId && t.buyerId == userId;
                    const isMySale = t.sellerId && t.sellerId == userId;

                    if (isMyPurchase || isMySale) {
                        const playerObj = findPlayerById(item.playerId);
                        addDebug(`Transfer found: ${playerObj?.name || t.playerName || 'Unknown'} (ID: ${item.playerId})`);
                        entries.push({
                            playerId: item.playerId,
                            playerName: playerObj?.name || t.playerName,
                            date: day.date,
                            type: isMyPurchase ? "Einkauf" : "Verkauf",
                            price: t.price,
                            partner: isMyPurchase ? t.seller : t.buyer
                        });
                    }
                }
            });
        });

        addDebug(`Found ${entries.length} transfers`);

        fillTransferTable("#transferTableAll tbody", entries);
        fillTransferTable("#transferTableBuy tbody", entries.filter(e => e.type === "Einkauf"));
        fillTransferTable("#transferTableSell tbody", entries.filter(e => e.type === "Verkauf"));

        // Initial nach Datum (neueste zuerst) sortieren
        document.querySelectorAll('.rivals-table').forEach(table => {
            sortTable(table, 0); // Erste Spalte (Datum)
            sortTable(table, 0); // Zweimal für absteigende Sortierung
        });

    } catch (error) {
        addDebug("ERROR in renderTransfers: " + error.message);
        console.error(error);
    }

    addDebug("=== renderTransfers END ===");
}

// Hilfsfunktion zum Füllen der Transfers-Tabellen
function fillTransferTable(selector, list) {
    console.group('fillTransferTable');
    addDebug(`Processing ${selector} with ${list.length} entries`);

    try {
        const tbody = document.querySelector(selector);
        if (!tbody) {
            throw new Error(`Table body not found: ${selector}`);
        }

        tbody.innerHTML = "";

        list.forEach((e, index) => {
            const tr = document.createElement('tr');

            // Try to find player in database
            const player = e.playerId ? findPlayerById(e.playerId) : null;
            const displayName = player?.name || e.playerName || 'Unbekannt';

            // Create cell content
            const playerCell = e.playerId ?
                `<a href="${getPlayerUrlWithParams(e.playerId)}" target="_self">${displayName}</a>` :
                displayName;

            // Build row content
            if (selector.includes("All")) {
                tr.innerHTML = `
                        <td data-sort="${formatDateForSort(e.date)}">${e.date}</td>
                        <td>${playerCell}</td>
                        <td data-sort="${e.type}">${e.type}</td>
                        <td data-sort="${e.price}">€${e.price.toLocaleString('de-DE')}</td>
                        <td data-sort="${e.partner?.toLowerCase() || ''}">${e.partner === 'Computer' ? e.partner : `<a href="${getUseruebersichtUrl(e.partner)}" style="color:#00c; text-decoration:underline;">${e.partner}</a>`}</td>
                                            `;
            } else {
                tr.innerHTML = `
                                                <td data-sort="${formatDateForSort(e.date)}">${e.date}</td>
                                                <td>${playerCell}</td>
                                                <td data-sort="${e.price}">€${e.price.toLocaleString('de-DE')}</td>
                                                <td data-sort="${e.partner?.toLowerCase() || ''}">${e.partner === 'Computer' ? e.partner : `<a href="${getUseruebersichtUrl(e.partner)}" style="color:#00c; text-decoration:underline;">${e.partner}</a>`}</td>
                                            `;
            }
            tbody.appendChild(tr);
        });

        addDebug(`Successfully filled table ${selector}`);

    } catch (error) {
        addDebug(`Error in fillTransferTable: ${error.message}`);
        console.error(error);
    }

    console.groupEnd();
}

// User info helpers moved to js/userInfo.js


// Hilfsfunktionen (fetchJSON, addDebug, showLoading, hideLoading, showContent) sollten in deinen utils.js o.ä. liegen

// Nach Laden der Seite starten
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initOverviewTabs();
    initTabs('.transfer-tabs');

    // Spaltensortierung hinzufügen
    const tables = document.querySelectorAll('.rivals-table');
    tables.forEach(table => {
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                sortTable(table, index);
            });
            header.style.cursor = 'pointer';
        });
    });
});

// Hilfsfunktion zum Formatieren des Datums für die Sortierung (z.B. "30.09.2025" -> "20250930")
function formatDateForSort(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return year + (month.padStart(2, '0')) + (day.padStart(2, '0'));
}

function sortTable(table, column) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Prüfe ob die Spalte numerisch sortiert werden soll anhand des ersten data-sort Werts
    let firstCell = rows[0]?.cells[column];
    let sortValue = firstCell?.getAttribute('data-sort') || firstCell?.textContent || '';
    const isNumeric = !isNaN(sortValue);

    rows.sort((a, b) => {
        let aVal = a.cells[column].getAttribute('data-sort') || a.cells[column].textContent;
        let bVal = b.cells[column].getAttribute('data-sort') || b.cells[column].textContent;

        if (isNumeric) {
            // Konvertiere leere Werte zu 0 für numerische Sortierung
            return (parseFloat(aVal) || 0) - (parseFloat(bVal) || 0);
        }
        // Case-insensitive String-Vergleich
        return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    });

    // Toggle Sortierrichtung
    if (table.getAttribute('data-sort-column') === column.toString()) {
        rows.reverse();
        table.removeAttribute('data-sort-column');
    } else {
        table.setAttribute('data-sort-column', column);
    }

    // Neue Sortierung anwenden
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}
