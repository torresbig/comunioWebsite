function createPointsTooltip(entry) {
    if (!entry) return '';
    const infoLines = [];
    if (entry.status) infoLines.push(entry.status === 'SUBIN' ? '🔄 Eingewechselt' : '🔄 Ausgewechselt');
    if (entry.rating && entry.rating !== 0) infoLines.push(`⭐ Bewertung: ${entry.rating}`);
    if (entry.yellow > 0) infoLines.push(`🟨 Gelbe: ${entry.yellow}`);
    if (entry.red > 0) infoLines.push(`🟥 Rote: ${entry.red}`);
    if (entry.yellowRed > 0) infoLines.push(`🟥 Gelb-Rot: ${entry.yellowRed}`);
    if (entry.assists > 0) infoLines.push(`🎯 Assists: ${entry.assists}`);
    if (entry.xgoals && entry.xgoals !== 0) infoLines.push(`📊 xGoals: ${entry.xgoals.toFixed(2)}`);

    if (entry.stats) {
        try {
            const stats = typeof entry.stats === 'string' ? JSON.parse(entry.stats) : entry.stats;
            const statsLines = [];
            if (stats.shots > 0) statsLines.push(`Schüsse: ${stats.shots}`);
            if (stats.shotsOnGoal > 0) statsLines.push(`Auf Tor: ${stats.shotsOnGoal}`);
            if (stats.foulsDrawn > 0) statsLines.push(`Fouls für: ${stats.foulsDrawn}`);
            if (stats.foulsCommitted > 0) statsLines.push(`Fouls gegen: ${stats.foulsCommitted}`);
            if (stats.passingRate > 0) statsLines.push(`Passquote: ${stats.passingRate}%`);
            if (stats.duelRate > 0) statsLines.push(`Duelquote: ${stats.duelRate}%`);
            if (statsLines.length) infoLines.push('', '📈 Details:', ...statsLines);
        } catch (error) {
            // Ungültige Detaildaten ändern die übrige Punkteanzeige nicht.
        }
    }
    if (entry.info) infoLines.push('', `ℹ️ ${entry.info}`);
    return infoLines;
}

function showPointsInfoPopup(spieltag, entry) {
    if (!entry) return;
    let popup = document.getElementById('points-info-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'points-info-popup';
        popup.className = 'points-info-popup';
        popup.innerHTML = `<div class="points-info-content">
            <div class="points-info-header"><h3>Spieltag ${spieltag}</h3><button class="points-info-close" id="points-info-close">×</button></div>
            <div class="points-info-lines" id="points-info-lines"></div>
        </div>`;
        document.body.appendChild(popup);
        popup.querySelector('#points-info-close')?.addEventListener('click', () => popup.classList.remove('open'));
        popup.addEventListener('click', event => {
            if (event.target === popup) popup.classList.remove('open');
        });
    }

    popup.querySelector('.points-info-header h3').textContent = `Spieltag ${spieltag}`;
    const linesContainer = popup.querySelector('#points-info-lines');
    linesContainer.innerHTML = '';
    createPointsTooltip(entry).forEach(line => {
        const element = document.createElement('div');
        element.className = `points-info-line${line === '' || line.includes('Details:') ? ' section-header' : ''}`;
        element.textContent = line;
        linesContainer.appendChild(element);
    });
    popup.classList.add('open');
}

function createPointsCell(value, spieltag, entry, isMobile) {
    if (isMobile && entry && Object.keys(entry).length > 2) {
        return `<span style="cursor: pointer; border-bottom: 1px dotted #3498db;" data-spieltag="${spieltag}" data-entry='${JSON.stringify(entry).replace(/'/g, '&apos;')}'>${value}</span>`;
    }
    return value;
}

let pointsRenderState = null;

async function renderPointsTableResponsive(player, lastProcessedMatchday) {
    const container = document.getElementById('pointsHistory');
    if (!container) return;
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const matchdayPoints = await getPlayerSpieltagspunkte(player && player.id);
    const pointsHistory = player.data?.historicalPoints || [];
    const currentSeason = new Date().getFullYear();
    let html = `<h3>Punkte & Spielzeiten - Aktuelle Saison (${currentSeason})</h3>`;
    html += '<table class="points-table"><thead><tr><th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th>';
    html += isMobile ? '</tr></thead><tbody>' : '<th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th><th>Spieltag</th><th>Punkte</th><th>Spielzeit</th><th>Tore</th></tr></thead><tbody>';

    const renderMatchday = matchday => {
        const entry = matchdayPoints.find(item => item.key === matchday);
        const points = entry ? entry.value : '-';
        const minutes = entry?.einsatzzeit !== undefined ? `${entry.einsatzzeit} min` : '-';
        const goals = entry?.tore !== undefined ? entry.tore : '-';
        const tooltip = createPointsTooltip(entry);
        const title = tooltip.length ? ` title="${tooltip.join('\n').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}"` : '';
        return { entry, html: `<td class="matchday-cell"${title}>${matchday}</td><td class="points-cell"${title}>${points}</td><td class="points-cell"${title}>${minutes}</td><td class="points-cell"${title}>${goals}</td>` };
    };

    if (isMobile) {
        for (let matchday = 1; matchday <= 34; matchday++) {
            if (lastProcessedMatchday && matchday <= lastProcessedMatchday) {
                html += `<tr>${renderMatchday(matchday).html}</tr>`;
            }
        }
    } else {
        for (let matchday = 1; matchday <= 34; matchday += 3) {
            html += '<tr>';
            for (let offset = 0; offset < 3; offset++) {
                const currentMatchday = matchday + offset;
                html += currentMatchday > 34 ? '<td></td><td></td><td></td>' : (lastProcessedMatchday && currentMatchday <= lastProcessedMatchday ? renderMatchday(currentMatchday).html : '');
            }
            html += '</tr>';
        }
    }
    html += '</tbody></table>';

    if (pointsHistory.length > 0) {
        html += '<h3>Historische Saisons</h3><table class="points-table"><thead><tr><th>Saison</th><th>Punkte</th></tr></thead><tbody>';
        pointsHistory.forEach(season => {
            const [year, points] = Object.entries(season)[0];
            html += `<tr><td>${year}</td><td>${points}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    container.innerHTML = html;

    if (isMobile) {
        container.querySelectorAll('.points-cell, .matchday-cell').forEach(cell => {
            const row = cell.closest('tr');
            row?.addEventListener('click', () => {
                const matchdayCell = row.querySelector('.matchday-cell');
                const matchday = matchdayCell && parseInt(matchdayCell.textContent, 10);
                const entry = matchdayPoints.find(item => item.key === matchday);
                if (entry && Object.keys(entry).length > 2) showPointsInfoPopup(matchday, entry);
            });
            if (row) row.style.cursor = 'pointer';
        });
    }
    pointsRenderState = { player, lastProcessedMatchday };
}

window.addEventListener('resize', () => {
    if (pointsRenderState) renderPointsTableResponsive(pointsRenderState.player, pointsRenderState.lastProcessedMatchday);
});
