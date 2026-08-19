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

function matchesSelectedPosition(rival, player, selected) {
    const selection = normalizePosition(selected || 'comunio');
    const playerPosition = normalizePosition(player.data?.position || '');
    const rivalPosition = normalizePosition(rival.data?.position || '');
    if (selection === 'comunio') return rivalPosition === playerPosition;

    const mainPosition = rival.data?.spielerDaten?.hauptposition || '';
    if (mainPosition && normalizePosition(mainPosition) === selection) return true;
    const secondaryPositions = rival.data?.spielerDaten?.nebenpositionen || [];
    if (Array.isArray(secondaryPositions)) {
        for (const position of secondaryPositions) {
            if (normalizePosition(position) === selection) return true;
        }
    }
    return rivalPosition !== '' && rivalPosition === selection;
}

function displayRivals(player, allPlayers) {
    addDebug('Erstelle Rivalen-Tabelle', 'info');
    const container = document.getElementById('rivalsList');
    const header = document.getElementById('rivalsHeader');
    if (!container) return;

    const playerPositions = player?.data?.spielerDaten || {};
    const mainPosition = playerPositions.hauptposition;
    const secondaryPositions = Array.isArray(playerPositions.nebenpositionen)
        ? playerPositions.nebenpositionen
        : [];
    const hasPlayerPositions = !!(mainPosition || secondaryPositions.length > 0);
    const existingSelect = document.getElementById('rivals-position-select');

    if (!hasPlayerPositions && existingSelect) {
        const wrapper = existingSelect.closest('.rivals-select-wrapper');
        if (wrapper) wrapper.remove();
    }

    const teamPlayers = allPlayers.filter(item => item.data?.verein === player.data?.verein);
    let selectedValue = existingSelect ? existingSelect.value : 'comunio';

    if (!existingSelect && hasPlayerPositions && header) {
        const select = document.createElement('select');
        select.id = 'rivals-position-select';
        select.className = 'rivals-position-select';
        const comunioOption = document.createElement('option');
        comunioOption.value = 'comunio';
        comunioOption.textContent = player.data?.position || 'Comunio';
        select.appendChild(comunioOption);
        if (mainPosition) {
            const option = document.createElement('option');
            option.value = mainPosition;
            option.textContent = mainPosition;
            select.appendChild(option);
        }
        secondaryPositions.forEach(position => {
            const option = document.createElement('option');
            option.value = position;
            option.textContent = position;
            select.appendChild(option);
        });
        select.addEventListener('change', () => displayRivals(player, allPlayers));

        const wrapper = document.createElement('span');
        wrapper.className = 'rivals-select-wrapper';
        const label = document.createElement('label');
        label.htmlFor = 'rivals-position-select';
        label.textContent = 'Position vergleichen:';
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        header.appendChild(wrapper);
        if (mainPosition) select.value = mainPosition;
        selectedValue = select.value;
    }

    const rivals = teamPlayers
        .filter(item => matchesSelectedPosition(item, player, selectedValue))
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
        title.textContent = `${rivals.length} Direkte Konkurrenten im Team`;
        const wrapper = header.querySelector('.rivals-select-wrapper');
        if (wrapper) {
            wrapper.style.display = 'block';
            wrapper.style.marginTop = '8px';
            header.appendChild(wrapper);
        }
    }

    if (!rivals.length) {
        container.innerHTML = '<p>Keine direkten Konkurrenten gefunden</p>';
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
        html += `<tr data-player-id="${rival.id}">
            <td class="player-cell" data-sort="${rival.name}"><div class="player-name-cell"><a href="${getPlayerUrlWithParams(rival.id)}" class="player-link" title="Zum Spieler">${rival.name}</a></div><div class="player-id-cell">(${rival.id})</div></td>
            <td data-sort="${status}"><div class="rival-status" title="${statusParts.join(' | ') || status}"><div>${getStatusIndicator(status)}</div><small>${status}</small></div></td>
            <td class="ligainsider-ranking" data-sort="${ligRank === '-' ? Number.MAX_SAFE_INTEGER : ligRank}">${ligRank}</td>
            <td data-sort="${marketValue}">${formatCurrencyFull(rival.data?.wert || 0)}</td>
            <td data-sort="${rival.data?.realWert || 0}">${formatCurrencyFull(rival.data?.realWert || 0)}</td>
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
