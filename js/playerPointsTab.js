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

function escapePointsHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function createPointsDetailGroups(entry) {
    if (!entry) return [];
    const groups = [];
    const addGroup = (title, items) => {
        if (items.length) groups.push({ title, items });
    };
    const status = entry.status ? String(entry.status).trim().toUpperCase() : '';
    const subIn = pointsPositive(entry.subIn);
    const subOut = pointsPositive(entry.subOut);
    const playtime = pointsPlaytime(entry);

    const appearance = [];
    if (status === 'SUBIN') appearance.push({ label: 'Einsatzstatus', value: `Eingewechselt${subIn !== null ? ` ${subIn}. Min.` : ''}` });
    else if (status === 'SUBOUT') appearance.push({ label: 'Einsatzstatus', value: `Ausgewechselt${subOut !== null ? ` ${subOut}. Min.` : ''}` });
    else if (status === 'FULL') appearance.push({ label: 'Einsatzstatus', value: 'Durchgespielt' });
    else if (status === 'NONE') appearance.push({ label: 'Einsatzstatus', value: 'Nicht im Einsatz' });
    if (playtime !== null) appearance.push({ label: 'Einsatzzeit', value: `${playtime} Min.` });
    addGroup('Einsatz', appearance);

    const performance = [];
    const value = pointsNumber(entry.value);
    const detailPoints = pointsNumber(entry.points);
    if (value !== null) performance.push({ label: 'Spieltagspunkte (Comunio)', value: String(value) });
    if (detailPoints !== null && detailPoints !== value) performance.push({ label: 'Punkte (Spieldetails)', value: String(detailPoints) });
    const rating = pointsRating(entry.rating);
    if (rating !== null) performance.push({ label: 'Note', value: rating });
    addGroup('Leistung', performance);

    const offensive = [];
    const goals = pointsNumber(entry.tore);
    if (goals !== null) offensive.push({ label: 'Tore', value: String(goals), tone: goals > 0 ? 'positive' : '' });
    const assists = pointsNumber(entry.goalAssists);
    if (assists !== null) offensive.push({ label: 'Vorlagen', value: String(assists), tone: assists > 0 ? 'positive' : '' });
    const xgoals = pointsPositive(entry.xgoals);
    if (xgoals !== null) offensive.push({ label: 'xGoals', value: xgoals.toFixed(2).replace('.', ',') });
    addGroup('Offensive', offensive);

    const discipline = [];
    const yellow = pointsPositive(entry.gelbekarten);
    if (yellow !== null) discipline.push({ label: 'Gelbe Karten', value: String(yellow) });
    const yellowRed = pointsPositive(entry.gelbrotekarten);
    if (yellowRed !== null) discipline.push({ label: 'Gelb-Rote Karten', value: String(yellowRed) });
    const red = pointsPositive(entry.rotekarten);
    if (red !== null) discipline.push({ label: 'Rote Karten', value: String(red) });
    const penaltiesScored = pointsPositive(entry.totalPenalties);
    if (penaltiesScored !== null) discipline.push({ label: 'Verwandelte Elfmeter', value: String(penaltiesScored) });
    const ownGoals = pointsPositive(entry.ownGoals);
    if (ownGoals !== null) discipline.push({ label: 'Eigentore', value: String(ownGoals) });
    const motm = pointsPositive(entry.manOfTheMatchAmount);
    if (motm !== null) discipline.push({ label: 'Man of the Match', value: String(motm) });
    addGroup('Karten & Disziplin', discipline);

    const goalkeeper = [];
    if (pointsPositive(entry.cleanSheet) !== null) goalkeeper.push({ label: 'Zu Null', value: 'Ja' });
    const pensSaved = pointsPositive(entry.pensSaved);
    if (pensSaved !== null) goalkeeper.push({ label: 'Elfmeter gehalten', value: String(pensSaved) });
    const pensMissed = pointsPositive(entry.pensMissed);
    if (pensMissed !== null) goalkeeper.push({ label: 'Elfmeter verschossen', value: String(pensMissed) });
    addGroup('Torwart & Elfmeter', goalkeeper);

    const season = [];
    const addSeasonValue = (label, raw, format = value => String(value)) => {
        const amount = pointsPositive(raw);
        if (amount !== null) season.push({ label, value: format(amount) });
    };
    addSeasonValue('Einsätze', entry.appearances);
    addSeasonValue('Einwechslungen', entry.subIns);
    addSeasonValue('Torschüsse', entry.totalShots);
    addSeasonValue('Schüsse aufs Tor', entry.shotsOnTarget);
    addSeasonValue('Abseits', entry.offsides);
    addSeasonValue('Paraden', entry.saves);
    addSeasonValue('Torschüsse gegen', entry.shotsFaced);
    addSeasonValue('Gegentore', entry.goalsConceded);
    addSeasonValue('Fouls verursacht', entry.foulsCommitted);
    addSeasonValue('Fouls erlitten', entry.foulsSuffered);
    addSeasonValue('Notendurchschnitt', entry.notenDurchschnitt, amount => amount.toFixed(1).replace('.', ','));
    addSeasonValue('Punktedurchschnitt', entry.punkteDurchschnitt, amount => String(amount));
    addGroup('Saisonwerte (ESPN)', season);

    if (entry.info) addGroup('Hinweis', [{ label: 'Info', value: String(entry.info) }]);
    return groups;
}

function renderPointsDetailsHtml(entry) {
    const groups = createPointsDetailGroups(entry);
    if (!groups.length) return '<div class="points-detail-empty">Für diesen Spieltag liegen keine Detaildaten vor.</div>';
    return groups.map(group => `<section class="points-detail-group"><h4 class="points-detail-group-title">${escapePointsHtml(group.title)}</h4><div class="points-detail-grid">${group.items.map(item => `<div class="points-detail-item"><small>${escapePointsHtml(item.label)}</small><b${item.tone ? ` class="tone-${escapePointsHtml(item.tone)}"` : ''}>${escapePointsHtml(item.value)}</b></div>`).join('')}</div></section>`).join('');
}

let activePointsButton = null;

function closePointsInfoPopup() {
    const popup = document.getElementById('points-info-popup');
    if (!popup) return;
    popup.classList.remove('open');
    activePointsButton?.setAttribute('aria-expanded', 'false');
    activePointsButton?.focus();
    activePointsButton = null;
}

function showPointsInfoPopup(spieltag, entry, sourceButton) {
    if (!entry) return;
    let popup = document.getElementById('points-info-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'points-info-popup';
        popup.className = 'points-info-popup';
        popup.innerHTML = `<div class="points-info-content" role="dialog" aria-modal="true" aria-labelledby="points-info-title">
            <div class="points-info-header"><h3 id="points-info-title"></h3><button class="points-info-close" id="points-info-close" aria-label="Details schließen">×</button></div>
            <div class="points-info-lines" id="points-info-lines"></div>
        </div>`;
        document.body.appendChild(popup);
        popup.querySelector('#points-info-close')?.addEventListener('click', closePointsInfoPopup);
        popup.addEventListener('click', event => {
            if (event.target === popup) closePointsInfoPopup();
        });
    }

    popup.querySelector('#points-info-title').textContent = `Spieltag ${spieltag}`;
    popup.querySelector('#points-info-lines').innerHTML = renderPointsDetailsHtml(entry);
    activePointsButton = sourceButton;
    activePointsButton?.setAttribute('aria-expanded', 'true');
    popup.classList.add('open');
    popup.querySelector('#points-info-close')?.focus();
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
    html += '<div class="points-matchday-list">';
    const pointsByMatchday = new Map(matchdayPoints
        .filter(entry => entry && entry.key !== null && entry.key !== undefined)
        .map(entry => [String(entry.key), entry]));
    const processedThrough = Math.min(34, Math.max(0, Math.floor(Number(lastProcessedMatchday) || 0)));

    const renderMatchday = matchday => {
        const entry = pointsByMatchday.get(String(matchday));
        // Comunio-Spieltagspunkte (value), sonst Punkte aus den Spieldetails
        const points = entry ? (pointsNumber(entry.value) ?? pointsNumber(entry.points)) : null;
        const playtime = pointsPlaytime(entry);
        const minutes = playtime !== null ? `${playtime} Min.` : '—';
        const goals = pointsNumber(entry?.tore);
        const groups = createPointsDetailGroups(entry);
        const summaryItems = [
            { label: 'Punkte', value: points === null ? '—' : String(points) },
            { label: 'Spielzeit', value: minutes },
            { label: 'Tore', value: goals === null ? '—' : String(goals) },
            { label: 'Note', value: pointsRating(entry?.rating) || '—' }
        ];
        const summaryHtml = summaryItems.map(item => `<span class="points-card-stat"><small>${escapePointsHtml(item.label)}</small><b>${escapePointsHtml(item.value)}</b></span>`).join('');
        const statusHtml = entry
            ? ''
            : `<${isMobile ? 'span' : 'div'} class="points-card-no-data">Für diesen Spieltag liegen keine Spielerdaten vor.</${isMobile ? 'span' : 'div'}>`;

        if (isMobile && entry) {
            return `<button type="button" class="points-matchday-card points-matchday-card-button" data-spieltag="${matchday}" aria-label="Spieltag ${matchday}, Details öffnen" aria-haspopup="dialog" aria-expanded="false"><span class="points-card-number" aria-hidden="true">${matchday}</span><span class="points-card-content"><span class="points-card-heading">Spieltag ${matchday}</span><span class="points-card-summary">${summaryHtml}</span></span></button>`;
        }
        return `<article class="points-matchday-card${entry ? '' : ' no-data'}"><span class="points-card-number" aria-hidden="true">${matchday}</span><div class="points-card-content"><div class="points-card-heading">Spieltag ${matchday}</div><div class="points-card-summary">${summaryHtml}</div>${statusHtml}${groups.length ? `<div class="points-matchday-details">${renderPointsDetailsHtml(entry)}</div>` : ''}</div></article>`;
    };

    for (let matchday = 1; matchday <= processedThrough; matchday++) html += renderMatchday(matchday);
    if (!processedThrough) html += '<p class="points-matchday-empty">Für diese Saison liegen noch keine abgeschlossenen Spieltage vor.</p>';
    html += '</div>';

    if (pointsHistory.length > 0) {
        html += '<h3>Historische Saisons</h3><table class="points-table"><thead><tr><th>Saison</th><th>Punkte</th></tr></thead><tbody>';
        pointsHistory.forEach(season => {
            const [year, points] = Object.entries(season)[0];
            html += `<tr><td>${escapePointsHtml(year)}</td><td>${escapePointsHtml(points)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.points-matchday-card-button').forEach(button => {
        button.addEventListener('click', () => {
            const matchday = button.dataset.spieltag;
            const entry = pointsByMatchday.get(String(matchday));
            showPointsInfoPopup(matchday, entry, button);
        });
    });
    pointsRenderState = { player, lastProcessedMatchday };
}

window.addEventListener('resize', () => {
    if (pointsRenderState) renderPointsTableResponsive(pointsRenderState.player, pointsRenderState.lastProcessedMatchday);
});
