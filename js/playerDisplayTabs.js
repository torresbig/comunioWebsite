function initTabs() {
    addDebug('Initialisiere Tabs', 'info');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            addDebug(`Tab gewechselt zu: ${tabId}`, 'info');
        });
    });
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));
    const defaultTabBtn = document.querySelector('.tab-button[data-tab="market"]')
        || document.querySelector('.tab-button.active')
        || document.querySelector('.tab-button');

    if (defaultTabBtn) {
        defaultTabBtn.classList.add('active');
        const defaultTabId = defaultTabBtn.getAttribute('data-tab');
        const defaultContent = document.getElementById(defaultTabId);
        if (defaultContent) defaultContent.classList.add('active');
    }

    addDebug('Tabs initialisiert', 'success');
}

function getPlayerUrlWithParams(playerId) {
    let playerUrl = getPlayerUrl(playerId);
    if (urlParams.withMenue === false) {
        playerUrl += '&withMenue=false';
    }
    return playerUrl;
}

// Normalisiert Positions-Labels für robustere Vergleiche
function normalizePosition(label) {
    if (!label && label !== 0) return '';
    try {
        let s = String(label).toLowerCase().trim();
        s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        s = s.replace(/[^a-z0-9]/g, '');
        return s;
    } catch (e) {
        return '';
    }
}

function matchesSelectedPosition(rival, player, selected) {
    const selRaw = selected || 'comunio';
    const sel = normalizePosition(selRaw);
    const playerComunio = normalizePosition(player.data?.position || '');
    const rivalComunio = normalizePosition(rival.data?.position || '');
    if (sel === 'comunio') {
        return rivalComunio === playerComunio;
    }
    // Rival - check spielerDaten.hauptposition
    const rivalHd = rival.data?.spielerDaten?.hauptposition || '';
    if (rivalHd && normalizePosition(rivalHd) === sel) return true;
    // Rival - check spielerDaten.nebenpositionen
    const neben = rival.data?.spielerDaten?.nebenpositionen || [];
    if (Array.isArray(neben)) {
        for (const np of neben) {
            if (normalizePosition(np) === sel) return true;
        }
    }
    // Fallback: compare Comunio position normalized (equality)
    if (rivalComunio && rivalComunio === sel) return true;
    return false;
}

function displayRivals(player, allPlayers) {
    addDebug('Erstelle Rivalen-Tabelle', 'info');
    const container = document.getElementById('rivalsList');
    const header = document.getElementById('rivalsHeader');
    if (!container) return;
    // Ermittle mögliche Vergleichsoptionen aus Spieler-Infos
    const playerPositions = player?.data?.spielerDaten || {};
    const haupt = playerPositions.hauptposition;
    const neben = Array.isArray(playerPositions.nebenpositionen) ? playerPositions.nebenpositionen : [];
    const hasPlayerPositions = !!(haupt || (neben && neben.length > 0));

    // Existierendes Select vor DOM-Änderungen abfragen
    const existingSelect = document.getElementById('rivals-position-select');

    // Wenn keine Spielerpositionen mehr vorhanden sind, entferne ggf. das Select
    if (!hasPlayerPositions && existingSelect) {
        const wrapper = existingSelect.closest('.rivals-select-wrapper');
        if (wrapper) wrapper.remove();
    }

    // Filter zunächst nach Verein, die genaue Positions-Filterung erfolgt weiter unten
    const teamPlayers = allPlayers.filter(p => p.data?.verein === player.data?.verein);

    // Bestimme Auswahl (falls bereits vorhanden im DOM) oder default auf 'comunio'
    let selectedValue = existingSelect ? existingSelect.value : 'comunio';

    // Falls kein Select im DOM, aber der Spieler hat positionsdaten -> erstelle neues Select
    if (!existingSelect && hasPlayerPositions && header) {
        const select = document.createElement('select');
        select.id = 'rivals-position-select';
        select.style.marginLeft = '12px';
        const optComunio = document.createElement('option');
        optComunio.value = 'comunio';
        optComunio.textContent = player.data?.position || 'Comunio';
        select.appendChild(optComunio);
        if (haupt) {
            const opt = document.createElement('option');
            opt.value = haupt;
            opt.textContent = haupt;
            select.appendChild(opt);
        }
        if (neben && neben.length > 0) {
            neben.forEach(np => {
                const opt = document.createElement('option');
                opt.value = np;
                opt.textContent = np;
                select.appendChild(opt);
            });
        }
        select.addEventListener('change', () => {
            displayRivals(player, allPlayers);
        });
        const wrapper = document.createElement('span');
        wrapper.className = 'rivals-select-wrapper';
        const label = document.createElement('label');
        label.htmlFor = 'rivals-position-select';
        label.style.fontSize = '0.9em';
        label.style.marginLeft = '8px';
        label.textContent = 'Position vergleichen:';
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        header.appendChild(wrapper);
        // Wenn Hauptposition vorhanden -> standardmäßig Hauptposition auswählen
        if (haupt) select.value = haupt;
        selectedValue = select.value;
    }

    // Endgültige Rivalen-Liste, abhängig von Auswahl
    const rivals = teamPlayers.filter(p => matchesSelectedPosition(p, player, selectedValue));

    rivals.sort((a, b) => {
        const aRankingObj = getLigainsiderRankingObj(a);
        const bRankingObj = getLigainsiderRankingObj(b);
        const aRank = (aRankingObj && aRankingObj.rang !== undefined && aRankingObj.rang !== null && aRankingObj.rang !== 0 && aRankingObj.rang !== '') ? aRankingObj.rang : Number.MAX_SAFE_INTEGER;
        const bRank = (bRankingObj && bRankingObj.rang !== undefined && bRankingObj.rang !== null && bRankingObj.rang !== 0 && bRankingObj.rang !== '') ? bRankingObj.rang : Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
    });

    addDebug(`${rivals.length} Rivalen gefunden`, 'success');
    if (header) {
        // Ensure single title element; clear original header text only once
        let title = header.querySelector('.rivals-title');
        if (!title) {
            // Entferne nur reine Textknoten (z.B. statischen Header-Text), behalte vorhandene Elemente (z.B. select-wrapper)
            Array.from(header.childNodes).forEach(n => {
                if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) n.remove();
            });
            title = document.createElement('span');
            title.className = 'rivals-title';
            header.insertBefore(title, header.firstChild);
        }
        title.textContent = `${rivals.length} Direkte Konkurrenten im Team`;

        // If a select-wrapper exists, ensure it's placed below the title
        const wrapper = header.querySelector('.rivals-select-wrapper');
        if (wrapper) {
            wrapper.style.display = 'block';
            wrapper.style.marginTop = '8px';
            // move to end so it's after title
            header.appendChild(wrapper);
        }
    }

    if (rivals.length > 0) {
        let html = `
        <table class="table-container rivals-table">
            <thead>
                <tr>
                    <th>Spieler</th>
                    <th>Status</th>
                    <th class="ligainsider-ranking">Ligainsider Ranking</th>
                    <th>Marktwert</th>
                    <th>Realwert</th>
                    <th>Punkte</th>
                    <th>Besitzer</th>
                </tr>
            </thead>
            <tbody>
        `;
        rivals.forEach(rival => {
            const injuryStatusObj = (window.injuriesMap && window.injuriesMap.get(String(rival.id))) || {};
            const statusData = injuryStatusObj;
            const statusParts = [getStatusDisplayName(statusData.status)];
            if (statusData.grund) statusParts.push(statusData.grund);
            if (statusData.seit) statusParts.push('seit ' + statusData.seit);
            if (statusData.bis && statusData.bis !== 'unbekannt' && statusData.bis !== '' && statusData.bis !== null) statusParts.push('bis ' + statusData.bis);
            const statusTooltip = statusParts.join(' | ');
            const ownerName = globalOwnersMap.get(rival.id) || "Computer";
            const playerUrl = getPlayerUrlWithParams(rival.id);
            const rankingObj = getLigainsiderRankingObj(rival);
            const ligRank = (rankingObj && rankingObj.rang !== undefined && rankingObj.rang !== null && rankingObj.rang !== 0 && rankingObj.rang !== '') ? rankingObj.rang : '-';
            const status = statusData.status || 'AKTIV';
            // Marktwert als reine Zahl für Sortierung
            const marktwertNum = typeof rival.data?.wert === 'number' ? rival.data.wert : 0;

            html += `
            <tr data-player-id="${rival.id}">
                <td class="player-cell" data-sort="${rival.name}">
                    <div class="player-name-cell">
                        <a href="${playerUrl}" class="player-link" title="Zum Spieler">${rival.name}</a>
                    </div>
                    <div class="player-id-cell">(${rival.id})</div>
                </td>
                <td data-sort="${status || ''}"> 
<div 
  style="display:flex;flex-direction:column;align-items:center" 
  title="${statusTooltip || status}"
>
  <div>${getStatusIndicator(status)}</div>
  <small style="font-size:0.8em;color:#666">${status}</small>
</div>                </td>
                <td class="ligainsider-ranking" data-sort="${ligRank === '-' ? Number.MAX_SAFE_INTEGER : ligRank}">${ligRank}</td>
                <td data-sort="${marktwertNum}">${formatCurrencyFull(rival.data?.wert || 0)}</td>
                <td data-sort="${rival.data?.realWert || 0}">${formatCurrencyFull(rival.data?.realWert || 0)}</td>
                <td data-sort="${rival.data?.punkte || 0}">${rival.data?.punkte || 0}</td>
                <td data-sort="${ownerName}">${ownerName}</td>
            </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        // Sortiere standardmäßig nach Marktwert (Spalte 3, Index 3), absteigend
        makeTableSortable('.rivals-table', 3, 'desc');
    } else {
        container.innerHTML = '<p>Keine direkten Konkurrenten gefunden</p>';
    }
}

function makeTableSortable(tableSelector, defaultSortCol = 0, defaultSortDir = 'desc') {
    const table = document.querySelector(tableSelector);
    if (!table) {
        addDebug(`Tabelle mit Selektor '${tableSelector}' nicht gefunden`, 'error');
        return;
    }
    const ths = table.querySelectorAll('th');
    let sortCol = defaultSortCol;
    let sortDir = defaultSortDir;

    function sortTable(colIndex, dir) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
            const aCell = a.children[colIndex];
            const bCell = b.children[colIndex];
            let aValue = aCell.getAttribute('data-sort') || aCell.textContent;
            let bValue = bCell.getAttribute('data-sort') || bCell.textContent;
            addDebug(`Vergleiche Werte: aValue='${aValue}', bValue='${bValue}'`, 'info');
            // Ligainsider Ranking (colIndex 2) als Integer sortieren
            if (colIndex === 2) {
                aValue = parseInt(aValue.replace(/[^\d-]/g, '')) || Number.MAX_SAFE_INTEGER;
                bValue = parseInt(bValue.replace(/[^\d-]/g, '')) || Number.MAX_SAFE_INTEGER;
                return dir === 'asc' ? aValue - bValue : bValue - aValue;
            } else if ([3, 4, 5].includes(colIndex)) {
                aValue = parseFloat(aValue.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(bValue.replace(/[^\d.-]/g, '')) || 0;
                return dir === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                aValue = aValue.toString().toLowerCase();
                bValue = bValue.toString().toLowerCase();
                if (aValue < bValue) return dir === 'asc' ? -1 : 1;
                if (aValue > bValue) return dir === 'asc' ? 1 : -1;
                return 0;
            }
        });
        rows.forEach(row => tbody.appendChild(row));
        addDebug(`Tabelle sortiert: Spalte=${colIndex}, Richtung=${dir}`, 'success');
    }

    ths.forEach((th, i) => {
        th.style.cursor = 'pointer';
        let arrowSpan = th.querySelector('.sort-arrow');
        if (!arrowSpan) {
            arrowSpan = document.createElement('span');
            arrowSpan.className = 'sort-arrow';
            th.appendChild(arrowSpan);
        }
        th.addEventListener('click', () => {
            ths.forEach(h => h.querySelector('.sort-arrow').textContent = '');
            if (sortCol === i) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortCol = i;
                sortDir = 'asc';
            }
            arrowSpan.textContent = sortDir === 'asc' ? '▲' : '▼';
            sortTable(sortCol, sortDir);
        });
    });

    sortTable(sortCol, sortDir);
    if (ths[sortCol]) {
        ths[sortCol].querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '▲' : '▼';
    }
}

window.addEventListener('DOMContentLoaded', initTabs);

// --- Hilfsfunktion: Erzeugt schönen Tooltip aus Spieltagsdaten ---
function createPointsTooltip(entry) {
    if (!entry) return '';
    
    const infoLines = [];
    
    // Status mit Symbol
    if (entry.status) {
        const statusSymbol = entry.status === 'SUBIN' ? '🔄 Eingewechselt' : '🔄 Ausgewechselt';
        infoLines.push(statusSymbol);
    }
    
    // Bewertung
    if (entry.rating && entry.rating !== 0) {
        infoLines.push(`⭐ Bewertung: ${entry.rating}`);
    }
    
    // Karten
    if (entry.yellow && entry.yellow > 0) {
        infoLines.push(`🟨 Gelbe: ${entry.yellow}`);
    }
    if (entry.red && entry.red > 0) {
        infoLines.push(`🟥 Rote: ${entry.red}`);
    }
    if (entry.yellowRed && entry.yellowRed > 0) {
        infoLines.push(`🟥 Gelb-Rot: ${entry.yellowRed}`);
    }
    
    // Tore und Assists
    if (entry.assists && entry.assists > 0) {
        infoLines.push(`🎯 Assists: ${entry.assists}`);
    }
    
    // xGoals
    if (entry.xgoals && entry.xgoals !== 0) {
        infoLines.push(`📊 xGoals: ${entry.xgoals.toFixed(2)}`);
    }
    
    // Detaillierte Stats (falls vorhanden)
    if (entry.stats) {
        try {
            const stats = typeof entry.stats === 'string' ? JSON.parse(entry.stats) : entry.stats;
            const statsLines = [];
            
            if (stats.shots && stats.shots > 0) statsLines.push(`Schüsse: ${stats.shots}`);
            if (stats.shotsOnGoal && stats.shotsOnGoal > 0) statsLines.push(`Auf Tor: ${stats.shotsOnGoal}`);
            if (stats.foulsDrawn && stats.foulsDrawn > 0) statsLines.push(`Fouls für: ${stats.foulsDrawn}`);
            if (stats.foulsCommitted && stats.foulsCommitted > 0) statsLines.push(`Fouls gegen: ${stats.foulsCommitted}`);
            if (stats.passingRate && stats.passingRate > 0) statsLines.push(`Passquote: ${stats.passingRate}%`);
            if (stats.duelRate && stats.duelRate > 0) statsLines.push(`Duelquote: ${stats.duelRate}%`);
            
            if (statsLines.length > 0) {
                infoLines.push('');
                infoLines.push('📈 Details:');
                infoLines.push(...statsLines);
            }
        } catch (e) {
            // Stats parsing fehlgeschlagen, ignorieren
        }
    }
    
    // Info-Text (z.B. Interpoliert)
    if (entry.info) {
        infoLines.push('');
        infoLines.push(`ℹ️ ${entry.info}`);
    }
    
    return infoLines;
}

// --- Mobile Popup für Spieltag-Infos ---
function showPointsInfoPopup(spieltag, entry) {
    if (!entry) return;
    
    let popup = document.getElementById('points-info-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'points-info-popup';
        popup.className = 'points-info-popup';
        popup.innerHTML = `
            <div class="points-info-content">
                <div class="points-info-header">
                    <h3>Spieltag ${spieltag}</h3>
                    <button class="points-info-close" id="points-info-close">×</button>
                </div>
                <div class="points-info-lines" id="points-info-lines"></div>
            </div>
        `;
        document.body.appendChild(popup);
        const closeBtn = popup.querySelector('#points-info-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popup.classList.remove('open');
            });
        }
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.classList.remove('open');
            }
        });
    }
    // Aktualisiere die Header-Überschrift bei jedem Aufruf (fix für falsche Spieltag-Anzeige)
    const headerTitle = popup.querySelector('.points-info-header h3');
    if (headerTitle) headerTitle.textContent = `Spieltag ${spieltag}`;

    const infoLines = createPointsTooltip(entry);
    const linesContainer = popup.querySelector('#points-info-lines');
    if (linesContainer) linesContainer.innerHTML = '';
    
    infoLines.forEach(line => {
        const div = document.createElement('div');
        div.className = 'points-info-line';
        if (line === '' || line.includes('Details:')) {
            div.className += ' section-header';
        }
        div.textContent = line;
        if (linesContainer) linesContainer.appendChild(div);
    });
    
    popup.classList.add('open');
}

// --- Hilfsfunktion: Erstellt Zellen mit Mobile-Click-Handler ---
function createPointsCell(value, spieltag, entry, isMobile) {
    if (isMobile && entry && Object.keys(entry).length > 2) {
        // Hat extra Daten -> mit Click-Handler
        return `<span style="cursor: pointer; border-bottom: 1px dotted #3498db;" data-spieltag="${spieltag}" data-entry='${JSON.stringify(entry).replace(/'/g, "&apos;")}'>${value}</span>`;
    }
    return value;
}

// --- Responsive Punkte/Spielzeiten-Tabelle + Historische Saisons ---
async function renderPointsTableResponsive(player, lastPorcessedMatchday) {
    const container = document.getElementById("pointsHistory");
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    // Spieltagspunkte jetzt aus externer Points-DB holen
    const spieltagspunkte = await getPlayerSpieltagspunkte(player && player.id);
    const pointsHistory = player.data?.historicalPoints || [];
    const currentSeason = new Date().getFullYear();
    let html = `<h3>Punkte & Spielzeiten - Aktuelle Saison (${currentSeason})</h3>`;
    html += '<table class="points-table"><thead><tr>';
    html += '<th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th>';
    html += isMobile ? '</tr></thead><tbody>' : '<th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th><th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th></tr></thead><tbody>';

    if (isMobile) {
        for (let i = 1; i <= 34; i++) {
            if (lastPorcessedMatchday && i <= lastPorcessedMatchday) {
                const punktEntry = spieltagspunkte.find(p => p.key === i);
                const punkte = punktEntry ? punktEntry.value : '-';
                const einsatzzeit = punktEntry && punktEntry.einsatzzeit !== undefined ? punktEntry.einsatzzeit + " min" : '-';
                const tore = punktEntry && punktEntry.tore !== undefined ? punktEntry.tore : '-';
                const tooltip = createPointsTooltip(punktEntry);
                const titleAttr = tooltip.length > 0 ? ` title="${tooltip.join('\n').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}"` : '';
                html += `<tr${titleAttr}>
                      <td class="matchday-cell">${i}</td>
                      <td class="points-cell">${punkte}</td>
                      <td class="points-cell">${einsatzzeit}</td>
                      <td class="points-cell">${tore}</td>
                    </tr>`;
            }
        }
    } else {
        for (let i = 1; i <= 34; i += 3) {
            html += '<tr>';
            for (let j = 0; j < 3; j++) {
                const spieltag = i + j;
                if (spieltag > 34) {
                    html += '<td></td><td></td><td></td>';
                } else {
                    if (lastPorcessedMatchday && spieltag <= lastPorcessedMatchday) {
                        const punktEntry = spieltagspunkte.find(p => p.key === spieltag);
                        const punkte = punktEntry ? punktEntry.value : '-';
                        const einsatzzeit = punktEntry && punktEntry.einsatzzeit !== undefined ? punktEntry.einsatzzeit + " min" : '-';
                        const tore = punktEntry && punktEntry.tore !== undefined ? punktEntry.tore : '-';
                        const tooltip = createPointsTooltip(punktEntry);
                        const titleAttr = tooltip.length > 0 ? ` title="${tooltip.join('\n').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}"` : '';
                        html += `<td class="matchday-cell"${titleAttr}>${spieltag}</td>
                             <td class="points-cell"${titleAttr}>${punkte}</td>
                             <td class="points-cell"${titleAttr}>${einsatzzeit}</td>
                             <td class="points-cell"${titleAttr}>${tore}</td>`;
                    }
                }
            }
            html += '</tr>';
        }
    }
    html += '</tbody></table>';

    // Historische Saisons
    if (pointsHistory.length > 0) {
        html += `<h3>Historische Saisons</h3>`;
        html += `<table class="points-table"><thead><tr><th>Saison</th><th>Punkte</th></tr></thead><tbody>`;
        pointsHistory.forEach(season => {
            // Annahme: season wie { "2011": 136 }
            const [year, points] = Object.entries(season)[0];
            html += `<tr><td>${year}</td><td>${points}</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    container.innerHTML = html;
    
    // Mobile Click-Handler für Punkte-Info
    if (isMobile) {
        const pointsCells = container.querySelectorAll('.points-cell, .matchday-cell');
        pointsCells.forEach(cell => {
            const row = cell.closest('tr');
            if (row) {
                row.addEventListener('click', () => {
                    // Spieltag aus erster Zelle der Reihe auslesen
                    const spieltagCell = row.querySelector('.matchday-cell');
                    if (spieltagCell) {
                        const spieltag = parseInt(spieltagCell.textContent);
                        const entry = spieltagspunkte.find(p => p.key === spieltag);
                        if (entry && Object.keys(entry).length > 2) {
                            showPointsInfoPopup(spieltag, entry);
                        }
                    }
                });
                row.style.cursor = 'pointer';
            }
        });
    }
}

// Optional, für dynamische Umschaltung ohne Seitenreload:
window.addEventListener("resize", () => {
    if (document.getElementById("pointsHistory") && typeof player !== "undefined") {
        renderPointsTableResponsive(player);
    }
});

// NEU (ohne Fehler, für jede Seite nutzbar):
const defaultTabBtn = document.querySelector('.tab-button[data-tab="market"]')
    || document.querySelector('.tab-button.active')
    || document.querySelector('.tab-button');
const defaultTabId = defaultTabBtn && defaultTabBtn.getAttribute('data-tab');
if (defaultTabBtn && defaultTabId) {
    defaultTabBtn.classList.add('active');
    const defaultContent = document.getElementById(defaultTabId);
    if (defaultContent) defaultContent.classList.add('active');
}