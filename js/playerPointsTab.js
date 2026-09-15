// Hilfsfunktionen für die flachen Spieltagsdaten der PointsDB
// (0 und negative Werte sind gültige Punkte, null/'' dagegen "kein Wert").
function pointsNumber(value) {
    return value === null || value === undefined || value === '' || isNaN(Number(value)) ? null : Number(value);
}

function pointsPositive(value) {
    const amount = pointsNumber(value);
    return amount !== null && amount > 0 ? amount : null;
}

// Einsatzzeit: einsatzzeit, sonst Wechselminute, sonst – bei active 1 – volle Spielzeit.
function pointsPlaytime(entry) {
    if (!entry) return null;
    const einsatzzeit = pointsPositive(entry.einsatzzeit);
    if (einsatzzeit !== null) return einsatzzeit;
    const subIn = pointsPositive(entry.subIn);
    if (subIn !== null) return Math.max(0, 90 - subIn);
    const subOut = pointsPositive(entry.subOut);
    if (subOut !== null) return subOut;
    return pointsNumber(entry.active) === 1 ? 90 : null;
}

function pointsRating(value) {
    const rating = pointsNumber(value);
    return rating === null || rating <= 0 ? null : rating.toFixed(1).replace('.', ',');
}

function createPointsTooltip(entry) {
    if (!entry) return [];
    const infoLines = [];
    const status = entry.status ? String(entry.status).trim().toUpperCase() : '';
    const subIn = pointsPositive(entry.subIn);
    const subOut = pointsPositive(entry.subOut);
    const playtime = pointsPlaytime(entry);

    if (status === 'SUBIN') infoLines.push(`🔄 Eingewechselt${subIn !== null ? ` ${subIn}. Min.` : ''}`);
    else if (status === 'SUBOUT') infoLines.push(`🔄 Ausgewechselt${subOut !== null ? ` ${subOut}. Min.` : ''}`);
    else if (status === 'FULL') infoLines.push('🔄 Durchgespielt');
    else if (status === 'NONE') infoLines.push('🚫 Nicht im Einsatz');
    if (playtime !== null) infoLines.push(`⏱️ Einsatzzeit: ${playtime} Min.`);

    const rating = pointsRating(entry.rating);
    if (rating !== null) infoLines.push(`⭐ Note: ${rating}`);

    const value = pointsNumber(entry.value);
    const detailPoints = pointsNumber(entry.points);
    if (value !== null) infoLines.push(`🏅 Spieltagspunkte: ${value}`);
    if (detailPoints !== null && detailPoints !== value) infoLines.push(`📋 Punkte (Spieldetails): ${detailPoints}`);

    const goals = pointsPositive(entry.tore);
    if (goals !== null) infoLines.push(`⚽ Tore: ${goals}`);
    const assists = pointsPositive(entry.goalAssists);
    if (assists !== null) infoLines.push(`🎯 Vorlagen: ${assists}`);
    const xgoals = pointsPositive(entry.xgoals);
    if (xgoals !== null) infoLines.push(`📊 xGoals: ${xgoals.toFixed(2)}`);

    const yellow = pointsPositive(entry.gelbekarten);
    if (yellow !== null) infoLines.push(`🟨 Gelbe: ${yellow}`);
    const yellowRed = pointsPositive(entry.gelbrotekarten);
    if (yellowRed !== null) infoLines.push(`🟨🟥 Gelb-Rot: ${yellowRed}`);
    const red = pointsPositive(entry.rotekarten);
    if (red !== null) infoLines.push(`🟥 Rote: ${red}`);

    if (pointsPositive(entry.cleanSheet) !== null) infoLines.push('🧤 Zu Null gespielt');
    const pensSaved = pointsPositive(entry.pensSaved);
    if (pensSaved !== null) infoLines.push(`🧤 Elfmeter gehalten: ${pensSaved}`);
    const pensMissed = pointsPositive(entry.pensMissed);
    if (pensMissed !== null) infoLines.push(`❌ Elfmeter verschossen: ${pensMissed}`);
    const ownGoals = pointsPositive(entry.ownGoals);
    if (ownGoals !== null) infoLines.push(`🙈 Eigentore: ${ownGoals}`);
    const motm = pointsPositive(entry.manOfTheMatchAmount);
    if (motm !== null) infoLines.push(`🌟 Man of the Match: ${motm}`);

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
    if (isMobile && entry && createPointsTooltip(entry).length) {
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
        const entry = matchdayPoints.find(item => String(item.key) === String(matchday));
        // Comunio-Spieltagspunkte (value), sonst Punkte aus den Spieldetails
        const points = entry ? (pointsNumber(entry.value) ?? pointsNumber(entry.points) ?? '-') : '-';
        const playtime = pointsPlaytime(entry);
        const minutes = playtime !== null ? `${playtime} min` : '-';
        const goals = entry?.tore !== undefined && entry.tore !== null ? entry.tore : '-';
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
                const entry = matchdayPoints.find(item => String(item.key) === String(matchday));
                if (entry && createPointsTooltip(entry).length) showPointsInfoPopup(matchday, entry);
            });
            if (row) row.style.cursor = 'pointer';
        });
    }
    pointsRenderState = { player, lastProcessedMatchday };
}

window.addEventListener('resize', () => {
    if (pointsRenderState) renderPointsTableResponsive(pointsRenderState.player, pointsRenderState.lastProcessedMatchday);
});
