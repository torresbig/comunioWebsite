let ownersMap = new Map();
let originalData = [];
let sortColumnIndex = 7; // Standard: Restzeit-Spalte
let sortDirection = 1;   // 1 = aufsteigend, -1 = absteigend

document.addEventListener('DOMContentLoaded', async () => {
    try {
        addDebug("Seite geladen, lade Besitzerdaten...");
        await loadOwnersData();  // Besitzer laden, füllt globalOwnersMap

        addDebug("Besitzerdaten geladen, lade InjuriesMap...");
        await loadInjuriesMap();
        addDebug(`InjuriesMap geladen: ${window.injuriesMap?.size || 0} Einträge`);

        addDebug("Besitzerdaten geladen, lade Transfermarkt-Daten...");
        await loadTransferMarktData();
    } catch (error) {
        showError("Fehler beim Laden: " + error.message);
        addDebug("Fehler beim Laden: " + error.message);
    }
});

async function loadTransferMarktData() {
    try {
        showLoading();
        addDebug("Lade Transfermarkt-Liste...");
        const response = await fetch(DATA_URLS.transfermarkt);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
                addDebug(`${data.length} Einträge geladen`);

                ownersMap = window.globalOwnersMap || new Map();
                originalData = data; // Rohdaten merken
                renderTable(sortedData());

                hideLoading();
                showContent();

        // Sortier-Events nur einmal nach dem Laden setzen!
        initSortEvents();
    } catch (error) {
        hideLoading();
        throw error;
    }
}

/**
 * Initialisiert Click-Events für alle th-Header,
 * damit alle Spalten mit Typ sortiert werden können.
*/
function initSortEvents() {
    document.querySelectorAll('#transferTable th').forEach((th, idx) => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            if (sortColumnIndex === idx) {
                sortDirection *= -1; // Richtung wechseln
            } else {
                sortColumnIndex = idx;
                sortDirection = 1; // Default: aufsteigend
            }
            renderTable(sortedData());
        });
    });
}

/**
 * Erstellt die HTML-Tabelle mit Spielerinformationen.
 */
function renderTable(data) {
    const tbody = document.querySelector('#transferTable tbody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');

        // Verein (rechtsbündig)
        const clubCell = document.createElement('td');
        clubCell.className = 'club';
        const clubLogo = document.createElement('img');
        clubLogo.src = DATA_URLS.logos + getLogoFileName(item.verein);
        clubLogo.alt = `Club ${item.verein}`;
        clubLogo.width = 30;
        clubLogo.height = 30;
        clubCell.appendChild(clubLogo);

        // Spieler
        const playerCell = document.createElement('td');
        playerCell.className = 'player';
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';
        const nameLink = document.createElement('a');
        nameLink.href = getPlayerUrl(item.playerID);
        nameLink.className = 'player-name';
        nameLink.textContent = item.playerName;
        const playerId = document.createElement('div');
        playerId.className = 'player-id';
        playerId.textContent = `ID: ${item.playerID}`;
        playerInfo.appendChild(nameLink);
        playerInfo.appendChild(playerId);
        playerCell.appendChild(playerInfo);

        // Status (aus injuriesMap oder item.status)
        const statusCell = document.createElement('td');
        statusCell.className = 'status-logo';
        const statusWrapper = document.createElement('div');
        statusWrapper.style.display = 'flex';
        statusWrapper.style.flexDirection = 'column';
        statusWrapper.style.alignItems = 'center';

        const injuryStatusData = window.injuriesMap?.get(String(item.playerID)) 
                              || window.injuriesMap?.get(Number(item.playerID)) || {};
        let statusValue = injuryStatusData?.status || item.status || null;
        if (!statusValue || statusValue.toLowerCase() === 'unbekannt' || statusValue === '' || statusValue === null || statusValue === undefined) {
            statusValue = 'AKTIV';
        }

        const statusIcon = document.createElement('div');
        statusIcon.textContent = getStatusIndicator(statusValue) || '❓';
        const statusText = document.createElement('small');
        statusText.textContent = getStatusDisplayName(statusValue) || 'Aktiv';
        statusWrapper.appendChild(statusIcon);
        statusWrapper.appendChild(statusText);
        statusCell.appendChild(statusWrapper);

        // Position
        const positionCell = document.createElement('td');
        positionCell.className = 'position';
        const posLogoFile = getLogoPositionFilename(item.position);
        const img = document.createElement('img');
        img.src = `logos/${posLogoFile}`;
        img.className = 'club-logo';
        img.alt = item.position;
        img.title = item.position;
        img.width = 30;
        img.height = 30;
        positionCell.appendChild(img);

        // Punkte (zentriert)
        const pointsCell = document.createElement('td');
        pointsCell.className = 'points';
        pointsCell.style.textAlign = 'center';
        pointsCell.textContent = item.punkte || 0;

        // Preis & Marktwert kombiniert (Zwei Zeilen)
        const priceCell = document.createElement('td');
        priceCell.className = 'price';
        priceCell.style.textAlign = 'right';

        const priceSpan = document.createElement('div');
        priceSpan.textContent = formatCurrency(item.preis);
        if (item.wert > item.preis) {
            priceSpan.style.fontWeight = 'bold';
            priceSpan.style.color = 'green';
        }
        priceCell.appendChild(priceSpan);

        const valueSpan = document.createElement('div');
        valueSpan.style.fontSize = '0.85em';
        valueSpan.style.opacity = '0.8';
        valueSpan.textContent = `(${formatCurrency(item.wert)})`;
        priceCell.appendChild(valueSpan);

        // Besitzer (zentriert)
        const ownerCell = document.createElement('td');
        ownerCell.className = 'owner';
        ownerCell.style.textAlign = 'center';
        const ownerName = ownersMap.get(item.playerID) || ownersMap.get(Number(item.playerID)) || "Computer";
        if (ownerName === 'Computer') {
            ownerCell.textContent = ownerName;
        } else {
            const ownerLink = document.createElement('a');
            ownerLink.href = getUseruebersichtUrl(ownerName);
            ownerLink.className = 'owner-name';
            ownerLink.textContent = ownerName;
            ownerCell.appendChild(ownerLink);
        }

        // Restzeit (rechtsbündig)
        const timeCell = document.createElement('td');
        timeCell.className = 'time';
        timeCell.style.textAlign = 'right';
        const remainingTime = calculateRemainingTime(item.remainingDate);
        timeCell.textContent = remainingTime;
        if (remainingTime === 'Abgelaufen') {
            row.classList.add('expired');
            timeCell.className = 'expired';
        } else {
            const match = remainingTime.match(/(\d+)h/);
            const hoursLeft = match ? parseInt(match[1]) : 72;
            if (hoursLeft > 24) {
                timeCell.classList.add('time-high');
            } else if (hoursLeft > 5) {
                timeCell.classList.add('time-medium');
            } else {
                timeCell.classList.add('time-low');
            }
        }

        row.appendChild(clubCell);
        row.appendChild(playerCell);
        row.appendChild(statusCell);
        row.appendChild(positionCell);
        row.appendChild(pointsCell);
        row.appendChild(priceCell);
        row.appendChild(ownerCell);
        row.appendChild(timeCell);
        tbody.appendChild(row);
    });
}

/**
 * Sortiert die Daten nach Spalte und Typ.
 */
function sortedData(arr = null) {
    const data = (arr || originalData).slice();
    return data.sort((a, b) => {
        switch (sortColumnIndex) {
            case 0: return cmpStr(a.verein, b.verein);
            case 1: return cmpStr(a.playerName, b.playerName);
            
            case 2: { // Status: Ausfälle/Verletzte zusammenfassen, Aktive ans Ende
                const injuryA = window.injuriesMap?.get(String(a.playerID)) || window.injuriesMap?.get(Number(a.playerID));
                const injuryB = window.injuriesMap?.get(String(b.playerID)) || window.injuriesMap?.get(Number(b.playerID));
                
                const statusA = (injuryA?.status || a.status || 'AKTIV').trim().toUpperCase();
                const statusB = (injuryB?.status || b.status || 'AKTIV').trim().toUpperCase();

                if (statusA === statusB) return 0;
                if (statusA === 'AKTIV') return 1 * sortDirection;
                if (statusB === 'AKTIV') return -1 * sortDirection;

                return sortDirection * statusA.localeCompare(statusB);
            }
            
            case 3: return cmpStr(a.position, b.position);
            case 4: return cmpNum(a.punkte, b.punkte);
            case 5: return cmpNum(a.preis, b.preis); // Preis (enthält auch Marktwert)
            case 6: { // Besitzer
                const ownerA = ownersMap.get(a.playerID) || ownersMap.get(Number(a.playerID)) || "Computer";
                const ownerB = ownersMap.get(b.playerID) || ownersMap.get(Number(b.playerID)) || "Computer";
                return cmpStr(ownerA, ownerB);
            }
            case 7: // Restzeit
                return sortDirection * (getTimeLeftForSort(a.setOnMarket) - getTimeLeftForSort(b.setOnMarket));
            default: return 0;
        }
    });
}


function cmpStr(a, b) {
    return sortDirection * String(a).localeCompare(String(b));
}
function cmpNum(a, b) {
    return sortDirection * (Number(a) - Number(b));
}


/**
 * Formatiert einen numerischen Wert als EUR-Währung ohne Nachkommastellen.
 * @param {number} value Numerischer Wert
 * @returns {string} formatierter String
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(value);
}

function getDeadlineDate(dateString) {
    // Korrigiere Zeitzonen-Format wie bisher
    const normalized = dateString.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const deadline = new Date(normalized);
    return deadline;
}

function calculateRemainingTime(dateString) {
    const deadline = getDeadlineDate(dateString);
    const now = new Date();

    if (deadline <= now) return 'Abgelaufen';

    const diffMS = deadline - now;
    const hours = Math.floor(diffMS / (1000 * 60 * 60));
    const minutes = Math.floor((diffMS % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

function getTimeLeftForSort(dateString) {
    const deadline = getDeadlineDate(dateString);
    const now = new Date();
    return deadline - now;
}

/**
 * Zeigt einen Lade-Spinner und versteckt den Inhaltsbereich.
 */
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

/**
 * Versteckt den Lade-Spinner.
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

/**
 * Zeigt den Hauptinhalt.
 */
function showContent() {
    document.getElementById('content').style.display = 'block';
}

/**
 * Zeigt eine Fehlermeldung auf der Seite an.
 * @param {string} message Fehlermeldungstext
 */
function showError(message) {
    document.getElementById('error').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}
