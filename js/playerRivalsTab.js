function getPlayerUrlWithParams(playerId) {
    let playerUrl = getPlayerUrl(playerId);
    if (urlParams.withMenue === false) playerUrl += '&withMenue=false';
    return playerUrl;
}

function normalizePosition(label) {
    if (!label && label !== 0) return '';
    try {
        let value = String(label).toLowerCase().trim();
        value = value.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        return value.replace(/[^a-z0-9]/g, '');
    } catch (error) {
        return '';
    }
}

function matchesSelectedPosition(rival, player, selected, mainOnly = false) {
    const selection = normalizePosition(selected || 'comunio');
    const playerPosition = normalizePosition(player.data?.position || '');
    const rivalPosition = normalizePosition(rival.data?.position || '');
    if (selection === 'comunio') return rivalPosition === playerPosition;

    const mainPosition = rival.data?.spielerDaten?.hauptposition || '';
    if (mainPosition && normalizePosition(mainPosition) === selection) return true;
    if (mainOnly) return false;
    const secondaryPositions = rival.data?.spielerDaten?.nebenpositionen || [];
    return Array.isArray(secondaryPositions)
        && secondaryPositions.some(position => normalizePosition(position) === selection);
}

function formatCompactCurrency(value) {
    const amount = Number(value) || 0;
    if (!amount) return '-';
    return amount < 1000000
        ? `${(amount / 1000).toFixed(0)} Tsd. €`
        : `${(amount / 1000000).toFixed(2)} Mio. €`;
}

function getClubName(clubId) {
    const clubMap = window.clubsMap;
    return clubMap?.get(String(clubId)) || clubMap?.get(clubId) || `Verein (ID: ${clubId})`;
}

function createRivalsControls(player, header, onChange) {
    const controls = document.createElement('div');
    controls.className = 'rivals-controls';

    const positionWrapper = document.createElement('span');
    positionWrapper.className = 'rivals-select-wrapper';
    const label = document.createElement('label');
    label.htmlFor = 'rivals-position-select';
    label.textContent = 'Position vergleichen:';
    const select = document.createElement('select');
    select.id = 'rivals-position-select';
    select.className = 'rivals-position-select';

    const positions = [
        { value: 'comunio', text: player.data?.position || 'Comunio' },
        { value: player.data?.spielerDaten?.hauptposition, text: player.data?.spielerDaten?.hauptposition },
        ...(Array.isArray(player.data?.spielerDaten?.nebenpositionen)
            ? player.data.spielerDaten.nebenpositionen.map(position => ({ value: position, text: position }))
            : [])
    ];
    const seenPositions = new Set();
    positions.forEach(position => {
        const normalized = normalizePosition(position.value);
        if (!position.value || seenPositions.has(normalized)) return;
        seenPositions.add(normalized);
        const option = document.createElement('option');
        option.value = position.value;
        option.textContent = position.text;
        select.appendChild(option);
    });
    const defaultPosition = player.data?.spielerDaten?.hauptposition || 'comunio';
    select.value = defaultPosition;
    select.addEventListener('change', onChange);
    positionWrapper.append(label, select);

    const mainOnlyLabel = document.createElement('label');
    mainOnlyLabel.className = 'rivals-checkbox-label';
    const mainOnlyCheckbox = document.createElement('input');
    mainOnlyCheckbox.type = 'checkbox';
    mainOnlyCheckbox.id = 'rivals-main-position-only-checkbox';
    mainOnlyCheckbox.addEventListener('change', onChange);
    mainOnlyLabel.append(mainOnlyCheckbox, document.createTextNode('Nur Hauptposition berücksichtigen'));

    const allClubsLabel = document.createElement('label');
    allClubsLabel.className = 'rivals-checkbox-label';
    const allClubsCheckbox = document.createElement('input');
    allClubsCheckbox.type = 'checkbox';
    allClubsCheckbox.id = 'rivals-all-clubs-checkbox';
    allClubsCheckbox.addEventListener('change', onChange);
    allClubsLabel.append(allClubsCheckbox, document.createTextNode('Vergleich über alle Vereine'));

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.id = 'rivals-reset-button';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        select.value = defaultPosition;
        mainOnlyCheckbox.checked = false;
        allClubsCheckbox.checked = false;
        onChange();
    });

    controls.append(positionWrapper, mainOnlyLabel, allClubsLabel, resetButton);
    header.appendChild(controls);
    return { select, mainOnlyCheckbox, allClubsCheckbox };
}

function displayRivals(player, allPlayers) {
    addDebug('Erstelle Rivalen-Tabelle', 'info');
    const container = document.getElementById('rivalsList');
    const header = document.getElementById('rivalsHeader');
    if (!container) return;

    const existingControls = document.querySelector('.rivals-controls');
    const controls = existingControls
        ? {
            select: document.getElementById('rivals-position-select'),
            mainOnlyCheckbox: document.getElementById('rivals-main-position-only-checkbox'),
            allClubsCheckbox: document.getElementById('rivals-all-clubs-checkbox')
        }
        : header ? createRivalsControls(player, header, () => displayRivals(player, allPlayers)) : null;
    if (!controls) return;

    const selectedValue = controls.select.value;
    const compareMainOnly = controls.mainOnlyCheckbox.checked;
    const compareAllClubs = controls.allClubsCheckbox.checked;
    const candidates = compareAllClubs
        ? allPlayers
        : allPlayers.filter(item => item.data?.verein === player.data?.verein);

    const rivals = candidates
        .filter(item => matchesSelectedPosition(item, player, selectedValue, compareMainOnly))
        .sort((first, second) => {
            const firstRanking = getLigainsiderRankingObj(first);
            const secondRanking = getLigainsiderRankingObj(second);
            const firstRank = firstRanking?.rang || Number.MAX_SAFE_INTEGER;
            const secondRank = secondRanking?.rang || Number.MAX_SAFE_INTEGER;
            return firstRank - secondRank;
        });

    addDebug(`${rivals.length} Rivalen gefunden`, 'success');
    if (header) {
        let title = header.querySelector('.rivals-title');
        if (!title) {
            Array.from(header.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
            });
            title = document.createElement('span');
            title.className = 'rivals-title';
            header.insertBefore(title, header.firstChild);
        }
        title.textContent = compareAllClubs
            ? `${rivals.length} Konkurrenten über alle Vereine`
            : `${rivals.length} Direkte Konkurrenten im Team`;
    }

    if (!rivals.length) {
        container.innerHTML = `<p>${compareAllClubs ? 'Keine Konkurrenten gefunden' : 'Keine direkten Konkurrenten gefunden'}</p>`;
        return;
    }

    let html = `<table class="table-container rivals-table"><thead><tr>
        <th>Spieler</th><th>Status</th><th class="ligainsider-ranking">Ligainsider Ranking</th>
        <th>Marktwert</th><th>Realwert</th><th>Punkte</th><th>Besitzer</th>
    </tr></thead><tbody>`;
    rivals.forEach(rival => {
        const statusData = (window.injuriesMap && window.injuriesMap.get(String(rival.id))) || {};
        const statusParts = [getStatusDisplayName(statusData.status)];
        if (statusData.grund) statusParts.push(statusData.grund);
        if (statusData.seit) statusParts.push('seit ' + statusData.seit);
        if (statusData.bis && statusData.bis !== 'unbekannt' && statusData.bis !== '') statusParts.push('bis ' + statusData.bis);
        const status = statusData.status || 'AKTIV';
        const ownerName = globalOwnersMap.get(rival.id) || 'Computer';
        const ranking = getLigainsiderRankingObj(rival);
        const ligRank = ranking?.rang || '-';
        const marketValue = typeof rival.data?.wert === 'number' ? rival.data.wert : 0;
        const realValue = typeof rival.data?.realWert === 'number' ? rival.data.realWert : 0;
        const clubId = rival.data?.verein || '0';
        const clubName = getClubName(clubId);
        const clubLogo = compareAllClubs
            ? `<img src="${DATA_URLS.logos}${getLogoFileName(clubId)}" class="rival-club-logo" alt="${clubName}" title="${clubName}">`
            : '';
        html += `<tr data-player-id="${rival.id}">
            <td class="player-cell" data-sort="${rival.name}"><div class="player-name-cell">${clubLogo}<a href="${getPlayerUrlWithParams(rival.id)}" class="player-link" title="Zum Spieler">${rival.name}</a></div><div class="player-id-cell">(${rival.id})</div></td>
            <td data-sort="${status}"><div class="rival-status" title="${statusParts.join(' | ') || status}"><div>${getStatusIndicator(status)}</div><small>${status}</small></div></td>
            <td class="ligainsider-ranking" data-sort="${ligRank === '-' ? Number.MAX_SAFE_INTEGER : ligRank}">${ligRank}</td>
            <td data-sort="${marketValue}">${formatCompactCurrency(marketValue)} ${unicodeTrend(getPlayerValueTrend(rival))}</td>
            <td data-sort="${realValue}">${formatCompactCurrency(realValue)}</td>
            <td data-sort="${rival.data?.punkte || 0}">${rival.data?.punkte || 0}</td>
            <td data-sort="${ownerName}">${ownerName}</td>
        </tr>`;
    });
    container.innerHTML = html + '</tbody></table>';
    makeTableSortable('.rivals-table', 3, 'desc');
}

function makeTableSortable(tableSelector, defaultSortCol = 0, defaultSortDir = 'desc') {
    const table = document.querySelector(tableSelector);
    if (!table) {
        addDebug(`Tabelle mit Selektor '${tableSelector}' nicht gefunden`, 'error');
        return;
    }
    const headers = table.querySelectorAll('th');
    let sortCol = defaultSortCol;
    let sortDir = defaultSortDir;

    function sortTable(column, direction) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((first, second) => {
            const firstCell = first.children[column];
            const secondCell = second.children[column];
            let firstValue = firstCell.getAttribute('data-sort') || firstCell.textContent;
            let secondValue = secondCell.getAttribute('data-sort') || secondCell.textContent;
            if (column === 2) {
                firstValue = parseInt(firstValue.replace(/[^\d-]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
                secondValue = parseInt(secondValue.replace(/[^\d-]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
                return direction === 'asc' ? firstValue - secondValue : secondValue - firstValue;
            }
            if ([3, 4, 5].includes(column)) {
                firstValue = parseFloat(firstValue.replace(/[^\d.-]/g, '')) || 0;
                secondValue = parseFloat(secondValue.replace(/[^\d.-]/g, '')) || 0;
                return direction === 'asc' ? firstValue - secondValue : secondValue - firstValue;
            }
            firstValue = firstValue.toString().toLowerCase();
            secondValue = secondValue.toString().toLowerCase();
            if (firstValue < secondValue) return direction === 'asc' ? -1 : 1;
            if (firstValue > secondValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        rows.forEach(row => tbody.appendChild(row));
    }

    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        let arrow = header.querySelector('.sort-arrow');
        if (!arrow) {
            arrow = document.createElement('span');
            arrow.className = 'sort-arrow';
            header.appendChild(arrow);
        }
        header.addEventListener('click', () => {
            headers.forEach(item => item.querySelector('.sort-arrow').textContent = '');
            if (sortCol === index) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortCol = index; sortDir = 'asc'; }
            arrow.textContent = sortDir === 'asc' ? '▲' : '▼';
            sortTable(sortCol, sortDir);
        });
    });
    sortTable(sortCol, sortDir);
    if (headers[sortCol]) headers[sortCol].querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '▲' : '▼';
}
