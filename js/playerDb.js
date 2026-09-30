let allPlayers = [];
let clubsMap = new Map();
let ownersMap = new Map();
let filteredPlayers = [];
let lastUpdateTime = null;
// Globale Map für Spieler-Status aus injuriesDB
window.injuriesMap = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    try {
          addDebug("Seite geladen, starte Besitzerdaten-Ladevorgang...");
        await loadOwnersData();           // zuerst Besitzer laden
        
        addDebug("Besitzerdaten geladen, starte restliche Daten...");
        await loadData();                 // dann weitere Daten laden und verarbeiten
        
        setupSorting();
    } catch (error) {
        showError("Laden fehlgeschlagen: " + error.message);
        addDebug("Fehler beim Laden: " + error.message);
    }
    
    // Option "Nicht-in-Liga-Spieler anzeigen" (NotInLigaDB) - funktioniert auch
    // mit dem alten HTML-Stand (#hideNonLeague = ausblenden)
    const showNonLeagueToggle = getShowNonLeagueToggle();
    if (showNonLeagueToggle) showNonLeagueToggle.addEventListener('change', applyFilters);



    // Toggle-Menü-Logik
    // Filter startet immer zugeklappt (mobil und Desktop)
    function setupToggle(labelId, contentId) {
        const label = document.getElementById(labelId);
        const content = document.getElementById(contentId);
        if (!label || !content) return;
        let open = false;
        function update() {
            if (open) {
                content.style.maxHeight = content.scrollHeight + 'px';
                content.style.overflowY = 'hidden';
                label.classList.add('open');
            } else {
                content.style.maxHeight = '0';
                content.style.overflowY = 'hidden';
                label.classList.remove('open');
            }
        }
        label.addEventListener('click', () => {
            open = !open;
            update();
        });
        window.addEventListener('resize', () => { if (open) update(); });
        update();
    }
    setupToggle('filterLabel', 'filterContentWrapper');
});

async function loadData() {
    try {
        showLoading();
        addDebug("Starte Ladevorgang...");
        addDebug(`Lade URLs:
                    Clubs: ${DATA_URLS.clubs}
                    Players: ${DATA_URLS.players}
                    Users: ${DATA_URLS.users}
                    PlayerToUser: ${DATA_URLS.playerToUser}
                    Injuries: ${DATA_URLS.injuries}`);
        const [clubsData, playersData, usersData, playerToUserMap, injuriesData] = await Promise.all([
            fetchJSON(DATA_URLS.clubs),
            fetchJSON(DATA_URLS.players),
            fetchJSON(DATA_URLS.users),
            fetchJSON(DATA_URLS.playerToUser),
            fetchJSON(DATA_URLS.injuries),
            // NotInLigaDB: Spieler ohne aktuellen Spielerdatenbank-Eintrag
            loadNotInLigaMap()
            
        ]);

        addDebug("Daten erfolgreich geladen, verarbeite...");
        addDebug(`Daten empfangen:
                    Clubs: ${clubsData.length}
                    Players: ${playersData.length}
                    Users: ${usersData.length}
                                        PlayerToUser: ${playerToUserMap.length}
                    Injuries: ${buildInjuriesMap(injuriesData).size}`);
        processData(clubsData, playersData, usersData, playerToUserMap, injuriesData);
        // newsList.lastUpdate beispiel: "31.10.2025 16:34"
        hideLoading();
        showContent();
        setupEventListeners();
        applyFilters();
        addDebug("Datenverarbeitung abgeschlossen.");
    } catch (error) {
        hideLoading();
        addDebug("Fehler beim Laden: " + error.message);
        throw error;
    }
}



function processData(clubsData, playersData, usersData, playerToUserMap, injuriesData) {
    addDebug("Starte Datenverarbeitung...");
    clubsMap = new Map();
    clubsData.forEach(club => {
        clubsMap.set(club.id, club.name);
    });
    addDebug(`Vereine verarbeitet: ${clubsMap.size}`);

    // Basis-Pool: Liga-Spieler + NotInLigaDB (Spieler ohne aktuellen
    // Spielerdatenbank-Eintrag, aber weiterhin Usern zugeordnet)
    allPlayers = getMergedPlayerPool(playersData.playerDB).map(player => ({
        ...player,
        position: player.data?.position || "Unbekannt"
    }));
    const notInLigaPlayers = allPlayers.filter(player => player.notInLiga);
    const notInLigaCountLabel = document.getElementById('showNonLeagueCount');
    if (notInLigaCountLabel) notInLigaCountLabel.textContent = notInLigaPlayers.length ? `(${notInLigaPlayers.length})` : '';
    addDebug(`Spieler verarbeitet: ${allPlayers.length} (davon ${notInLigaPlayers.length} nicht in Liga)`);

    ownersMap = window.globalOwnersMap || new Map();

    addDebug(`Besitzerzuordnungen: ${ownersMap.size}`);

        // InjuriesDB in Map umwandeln (comunioPlayerId -> Status-Objekt)
        // Aktuelles Format: { lastUpdate, injuriedAndBannedPlayer: {...}, history: {...} }
        // Es wird nur "injuriedAndBannedPlayer" verwendet (history folgt später).
        // (Helper aus js/utils.js, das in playerDb.html vorher geladen wird)
        window.injuriesMap = buildInjuriesMap(injuriesData);
        if (window.injuriesMap.size > 0) {
            addDebug(`InjuriesDB verarbeitet: ${window.injuriesMap.size} Einträge`);
        } else {
            addDebug("InjuriesData ist kein Objekt oder leer!", "warn");
        }

        initClubFilter();
    initOwnerFilter();
    addDebug("Datenverarbeitung abgeschlossen.");
}

function initClubFilter() {
    const clubFilter = document.getElementById('club');
    clubFilter.innerHTML = '<option value="">Alle Vereine</option>';
    const uniqueClubs = [...new Set(clubsMap.values())].sort();
    uniqueClubs.forEach(club => {
        const option = document.createElement('option');
        option.value = club;
        option.textContent = club;
        clubFilter.appendChild(option);
    });
    // Zusatzoption fuer Spieler ohne Verein (NotInLigaDB), damit der
    // Vereinsfilter zum Anzeigenamen der Club-Spalte passt
    if (allPlayers.some(player => player.notInLiga)) {
        const option = document.createElement('option');
        option.value = 'Nicht in Liga';
        option.textContent = 'Nicht in Liga';
        clubFilter.appendChild(option);
    }
}

function initOwnerFilter() {
    const ownerFilter = document.getElementById('owner');
    ownerFilter.innerHTML = '<option value="">Alle Besitzer</option>';
    const ownerSet = new Set(ownersMap.values());
    ownerSet.forEach(owner => {
        if (owner !== "Kein Besitzer") {
            const option = document.createElement('option');
            option.value = owner;
            option.textContent = owner;
            ownerFilter.appendChild(option);
        }
    });
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showContent() {
    document.getElementById('content').style.display = 'block';
}

function showError(message) {
    hideLoading();
    const errorDiv = document.getElementById('error');
    document.getElementById('errorMessage').textContent = message;
    errorDiv.style.display = 'block';
}



/**
 * Liefert das Steuerelement fuer die Anzeige der Nicht-in-Liga-Spieler.
 * Unterstuetzt #showNonLeague (anzeigen) und den alten Stand #hideNonLeague.
 * @returns {HTMLInputElement|null}
 */
function getShowNonLeagueToggle() {
    return document.getElementById('showNonLeague') || document.getElementById('hideNonLeague');
}

/**
 * Sollen Spieler aus der NotInLigaDB mit angezeigt werden?
 * Ohne Steuerelement oder bei inaktivem Haekchen: nur Liga-Spieler.
 * @returns {boolean}
 */
function isShowNonLeagueEnabled() {
    const toggle = document.getElementById('showNonLeague');
    if (toggle) return !!toggle.checked;
    const legacyToggle = document.getElementById('hideNonLeague');
    if (legacyToggle) return !legacyToggle.checked;
    return false;
}

/**
 * Aktualisiert die kompakten Kennzahlen ueber dem Filter.
 * Alle Werte beziehen sich auf die aktuell angezeigten Zeilen; die Spielerzahl
 * zeigt bei aktivem Filter zusaetzlich den Gesamtbestand (angezeigt / gesamt).
 */
function updateDbStats() {
    const players = Array.isArray(filteredPlayers) ? filteredPlayers : [];
    const total = allPlayers.length;
    let totalValue = 0;
    let totalPoints = 0;
    let notActive = 0;
    players.forEach(player => {
        totalValue += Number(player.data?.wert) || 0;
        totalPoints += Number(player.data?.punkte) || 0;
        if (getPlayerStatus(player.id) !== 'AKTIV') notActive++;
    });
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('dbStatPlayers', players.length === total ? String(total) : players.length + ' / ' + total);
    setText('dbStatValue', formatCompactValue(totalValue));
    setText('dbStatNotActive', String(notActive));
    setText('dbStatPoints', totalPoints.toLocaleString('de-DE'));
}

/**
 * Kompakte Betragsausgabe fuer die Kennzahlen (Tsd./Mio./Mrd.).
 * @param {number} value Betrag in Euro
 * @returns {string}
 */
function formatCompactValue(value) {
    const amount = Number(value) || 0;
    if (amount >= 1000000000) return (amount / 1000000000).toFixed(2).replace('.', ',') + ' Mrd. €';
    if (amount >= 1000000) return (amount / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
    if (amount >= 1000) return Math.round(amount / 1000).toLocaleString('de-DE') + ' Tsd. €';
    return amount.toLocaleString('de-DE') + ' €';
}

function applyFilters() {
    addDebug("Filter werden angewendet...");
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const clubFilter = document.getElementById('club').value;
    const positionFilter = document.getElementById('position').value;
    const statusFilter = document.getElementById('status').value;
    // Explizite Statusauswahl "Nicht in Liga" schlaegt die Anzeige-Option
    const statusWantsNotInLiga = String(statusFilter || '').toUpperCase().includes('NICHT_IN_LIGA');
    const ownerFilter = document.getElementById('owner').value;
    const showNonLeague = isShowNonLeagueEnabled();
    filteredPlayers = allPlayers.filter(player => {
        if (searchTerm &&
            !player.name.toLowerCase().includes(searchTerm) &&
            !String(player.id).toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (clubFilter) {
            // Anzeigename wie in der Club-Spalte (NotInLiga-Spieler ohne Verein)
            const clubName = player.notInLiga ? 'Nicht in Liga' : (clubsMap.get(player.data?.verein) || '');
            if (clubName !== clubFilter) return false;
        }
        if (positionFilter && player.position !== positionFilter) return false;
        // Status aus injuriesMap (Key: comunioPlayerId) statt aus player.data
        // Kein Eintrag in der InjuriesDB = aktiv (wie in der Status-Spalte)
        // Status zentral aus utils (NotInLigaDB vor InjuriesDB)
        const statusValue = getPlayerStatus(player.id, { unknown: player.unknown === true });
        if (statusFilter && !statusValue.includes(statusFilter)) return false;
        const owner = ownersMap.get(player.id) || 'Kein Besitzer';
        if (ownerFilter === "Kein Besitzer" && owner !== 'Kein Besitzer') return false;
        if (ownerFilter && ownerFilter !== "Kein Besitzer" && owner !== ownerFilter) return false;
        // NotInLiga-Spieler nur einblenden, wenn die Option aktiv ist.
        // Wird im Statusfilter gezielt "Nicht in Liga" gewaehlt, gewinnt diese Auswahl.
        if (!showNonLeague && !statusWantsNotInLiga && player.notInLiga) {
            return false;
        }
        return true;
    });
    renderTable(filteredPlayers);
    updateDbStats();
    addDebug("Filter angewendet.");
}

function resetFilters() {
    document.getElementById('search').value = '';
    document.getElementById('position').value = '';
    document.getElementById('status').value = '';
    document.getElementById('club').value = '';
    document.getElementById('owner').value = '';
    const showNonLeagueReset = document.getElementById('showNonLeague');
    if (showNonLeagueReset) showNonLeagueReset.checked = false;
    const legacyHideReset = document.getElementById('hideNonLeague');
    if (legacyHideReset) legacyHideReset.checked = true;
    applyFilters();
    addDebug("Filter zurückgesetzt.");
}

function setupEventListeners() {
    document.getElementById('search').addEventListener('input', applyFilters);
    document.getElementById('position').addEventListener('change', applyFilters);
    document.getElementById('status').addEventListener('change', applyFilters);
    document.getElementById('club').addEventListener('change', applyFilters);
    document.getElementById('owner').addEventListener('change', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

