function toggleNewsList() {
    const list = document.getElementById('news-list');
    const icon = document.getElementById('news-toggle-icon');
    if (list.style.display === 'none') {
        list.style.display = '';
        icon.style.transform = 'rotate(0deg)';
    } else {
        list.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
    }
}

// Toggle-Funktion für Rubriken (z.B. Vereinswechsel, Transfers, etc.)
function toggleArtSection(headerEl) {
    const collapsible = headerEl.closest('.news-art-collapsible');
    if (!collapsible) return;
    const content = collapsible.querySelector('.news-art-content');
    if (!content) return;
    collapsible.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
}

// Globale clubsMap für andere Skripte
let clubsMap = new Map();

// Lädt Vereinsdaten asynchron
async function loadClubsData() {
    try {
        addDebug('[loadClubsData] Starte Laden der Vereinsdaten...');
        const response = await fetch(DATA_URLS.clubs);
        if (!response.ok) throw new Error(`HTTP-Fehler: ${response.status}`);
        const clubsData = await response.json();
        clubsMap = new Map(clubsData.map(club => [club.id.toString(), club.name]));
        window.clubsMap = clubsMap; // Für andere Skripte verfügbar machen
        addDebug(`[loadClubsData] Vereinsdaten geladen: ${clubsMap.size} Einträge`);
    } catch (error) {
        addDebug('[loadClubsData] Fehler: ' + error.message);
        throw error;
    }
}

// Hilfsfunktion für Vereinsnamen
function getClubName(clubId) {
    if (!clubId) return 'N/A';
    return clubsMap.get(clubId.toString()) || `Verein (ID: ${clubId})`;
}


async function renderNews(newsList) {
    try {
        // Lade Vereinsdaten, falls noch nicht geschehen
        if (clubsMap.size === 0) {
            await loadClubsData();
        }


        addDebug('[renderNews] Start mit ' + newsList.length + ' Tagen');

        // Nach Datum absteigend sortieren
        newsList.sort((a, b) => {
            const da = a.date.split('.').reverse().join('-');
            const db = b.date.split('.').reverse().join('-');
            return new Date(db) - new Date(da);
        });

        let html = '';
        let errorCount = 0;
        let elfContainersToUpdate = [];

        for (const day of newsList) {
            const newsForDisplay = day.news.filter(n => n.art !== 'OWNERCHANGE' && n.art !== 'UNBESTIMMT');

            const grouped = {};
            for (const news of newsForDisplay) {
                if (!grouped[news.art]) {
                    grouped[news.art] = [];
                }
                const isDuplicate = grouped[news.art].some(existingNews =>
                    existingNews.text === news.text &&
                    existingNews.date === news.date
                );
                if (!isDuplicate) {
                    grouped[news.art].push(news);
                }
            }

            html += `<div class="news-day"><div class="news-date">${day.date}</div>`;

            for (const art of Object.keys(grouped).sort()) {
                const defaultCollapsed = !(art === 'TRANSFER' || art === 'POSITIONSWECHSEL' || art === 'SPIELERSTATUS' || art === 'VEREINSWECHSEL');
                const collapsedClass = defaultCollapsed ? ' collapsed' : '';
                html += `<div class="news-art-collapsible${collapsedClass}">
                    <div class="news-art-header" onclick="toggleArtSection(this)">
                                                <span class="toggle-icon">▼</span>
                        <span class="news-art-title">${art}</span>
                    </div>
                    <div class="news-art-content${collapsedClass}">
                        <ul class="news-list-ul">`;

                for (const news of grouped[art]) {
                    let text = '';
                    try {
                        if (art === 'TRANSFER') {
                            try {
                                const obj = JSON.parse(news.text);
                                const pid = obj.playerId || news.playerId || null;
                                const sellerLink = obj.seller === 'Computer' ? obj.seller : `<a href="${getUseruebersichtUrl(obj.seller)}" style="color:#00f; text-decoration:underline;">${obj.seller}</a>`;
                                const buyerLink = obj.buyer === 'Computer' ? obj.buyer : `<a href="${getUseruebersichtUrl(obj.buyer)}" style="color:#00f; text-decoration:underline;">${obj.buyer}</a>`;
                                text = `${linkPlayer(pid, obj.playerName)} von <b style="color:#00f;">${sellerLink}</b> zu <b style="color:#00f;">${buyerLink}</b> für <b>${obj.price.toLocaleString('de-DE')} €</b> (Marktwert: ${obj.playerValue.toLocaleString('de-DE')} €)`;
                            } catch (e) {
                                addDebug('[renderNews] TRANSFER Parse-Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'USERPOINTS') {
                            try {
                                const obj = JSON.parse(news.text);
                                const userLink = obj.userName === 'Computer' ? obj.userName : `<a href="${getUseruebersichtUrl(obj.userName)}" style="color:#00f; text-decoration:underline;">${obj.userName}</a>`;
                                text = `<div class="player-entry"><b style="color:#00f;">${userLink}</b> - <span class="points">${obj.gamedayPoints} Pkt.</span> (Gesamt: ${obj.totalPoints} Pkt.)</div>`;
                            } catch (e) {
                                addDebug('[renderNews] USERPOINTS Parse-Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'SPIELERSTATUS') {
                            try {
                                const regex = /Statuswechsel:\s(.+?)\s\(\d+\)\sist\s(wieder|jetzt)\s([A-Z_]+)(?:\s\((.+)\))?/i;
                                const match = regex.exec(news.text);
                                if (match) {
                                    const playerName = match[1];
                                    const status = match[3];
                                    const statusDetail = match[4] || '';
                                    let statusDisplay = `<b>${status.replace(/_/g, ' ')}</b>`;
                                    if (statusDetail) statusDisplay += ` (${statusDetail})`;

                                    if (news.text.includes('AKTIV')) {
                                        text = `🟢 ${linkPlayer(news.playerId, playerName)} ist ${match[2]} ${statusDisplay}`;
                                    } else if (news.text.includes('NICHT_IN_LIGA')) {
                                        text = `❌ ${linkPlayer(news.playerId, playerName)} ist ${match[2]} ${statusDisplay}`;
                                    } else {
                                        text = `🔴 ${linkPlayer(news.playerId, playerName)} ist ${match[2]} ${statusDisplay}`;
                                    }
                                } else {
                                    addDebug('[renderNews] SPIELERSTATUS Regex match failed');
                                    text = news.text;
                                }
                            } catch (e) {
                                addDebug('[renderNews] SPIELERSTATUS Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'VEREINSWECHSEL') {
                            try {
                                try {
                                    const obj = JSON.parse(news.text);
                                    // Skip if oldClub or newClub is UNBEKANNT/UNKNOWN
                                    const oldClub = (obj.oldClub || '').toString().toUpperCase();
                                    const newClub = (obj.newClub || '').toString().toUpperCase();
                                    if (oldClub === 'UNBEKANNT' || oldClub === 'UNKNOWN' ||
                                        newClub === 'UNBEKANNT' || newClub === 'UNKNOWN') {
                                        addDebug('[renderNews] VEREINSWECHSEL übersprungen (UNBEKANNT): ' + news.text);
                                        continue;
                                    }
                                    const pid = obj.playerId || news.playerId || null;
                                    if ((oldClub === "0" && newClub === "0") || (oldClub === 'UNBEKANNT' && newClub === 'UNBEKANNT')) {
                                        text = `${linkPlayer(pid, obj.playerName)} wechselt außerhalb der Bundesliga`;
                                    } else if (oldClub === "0" || oldClub === 'UNBEKANNT') {
                                        text = `${linkPlayer(pid, obj.playerName)} wechselt zu <b>${getClubName(obj.newClub)}</b>`;
                                    } else if (newClub === "0" || newClub === 'UNBEKANNT') {
                                        text = `${linkPlayer(pid, obj.playerName)} wechselt von <b>${getClubName(obj.oldClub)}</b> zu einem Nicht-Bundesligisten`;
                                    } else {
                                        text = `${linkPlayer(pid, obj.playerName)} wechselt von <b>${getClubName(obj.oldClub)}</b> zu <b>${getClubName(obj.newClub)}</b>`;
                                    }

                                    
                                } catch (jsonErr) {
                                    const regex = /^Vereinswechsel:\s(.+?)\s\(/;
                                    const match = regex.exec(news.text);
                                    if (match) {

                                        text = `Vereinswechsel: ${linkPlayer(news.playerId, match[1])}`;

                                    } else {
                                        text = news.text;
                                    }
                                }
                            } catch (e) {
                                addDebug('[renderNews] VEREINSWECHSEL Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'POSITIONSWECHSEL') {
                            try {
                                try {
                                    const obj = JSON.parse(news.text);
                                    // Skip if oldPos or newPos is UNBEKANNT/UNKNOWN
                                    const oldPos = (obj.oldPos || '').toString().toUpperCase();
                                    const newPos = (obj.newPos || '').toString().toUpperCase();
                                    if (oldPos === 'UNBEKANNT' || oldPos === 'UNKNOWN' ||
                                        newPos === 'UNBEKANNT' || newPos === 'UNKNOWN') {
                                        addDebug('[renderNews] POSITIONSWECHSEL übersprungen (UNBEKANNT): ' + news.text);
                                        continue;
                                    }
                                    const pid = obj.playerId || news.playerId || null;
                                    text = `${linkPlayer(pid, obj.playerName)} wechselt von <b>${obj.oldPos}</b> zu <b>${obj.newPos}</b>`;
                                } catch (e) {
                                    // Fallback: skip if text contains UNBEKANNT/UNKNOWN
                                    if (/UNBEKANNT|UNKNOWN/i.test(news.text)) {
                                        addDebug('[renderNews] POSITIONSWECHSEL übersprungen (UNBEKANNT im Text): ' + news.text);
                                        continue;
                                    }
                                    text = news.text;
                                }
                            } catch (e) {
                                addDebug('[renderNews] POSITIONSWECHSEL Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'NEW_PLAYER') {
                            try {
                                const regex = /^Neuer Spieler:\s(.+?)\s\(ID: (\d+)\)$/;
                                const match = regex.exec(news.text);
                                if (match) {
                                    text = `Neuer Spieler: ${linkPlayer(news.playerId, match[1])} (ID: ${match[2]})`;
                                } else {
                                    addDebug('[renderNews] NEW_PLAYER Regex match failed');
                                    text = news.text;
                                }
                            } catch (e) {
                                addDebug('[renderNews] NEW_PLAYER Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else if (art === 'ELFDESTAGES') {
                            try {
                                const players = JSON.parse(news.text);

                                const positionOrder = {
                                    'keeper': 1,
                                    'defender': 2,
                                    'midfielder': 3,
                                    'striker': 4
                                };

                                players.sort((a, b) => positionOrder[a.position] - positionOrder[b.position]);

                                const containerId = `elf-${day.date}-${Math.random().toString(36).substr(2, 9)}`;

                                text = `<div class="top11-container" id="${containerId}" style="text-align: left; padding: 10px;">
                                    <h3 style="margin-bottom: 10px;">🏆 Elf des Tages</h3>`;

                                let currentPosition = '';
                                players.forEach((player) => {
                                    if (currentPosition !== player.position) {
                                        if (currentPosition !== '') text += '</div>';
                                        currentPosition = player.position;
                                        const positionIcons = {
                                            'keeper': '🧤',
                                            'defender': '🛡️',
                                            'midfielder': '⚡',
                                            'striker': '⚽'
                                        };
                                        const positionNames = {
                                            'keeper': 'Torwart',
                                            'defender': 'Abwehr',
                                            'midfielder': 'Mittelfeld',
                                            'striker': 'Sturm'
                                        };
                                        text += `<div class="position-group" style="margin-bottom: 10px;">
                                            <h4 style="margin: 8px 0 6px 0;">${positionIcons[player.position]} ${positionNames[player.position]}</h4>`;
                                    }

                                    text += `<div class="elf-player-entry" style="margin-bottom: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                                        ${linkPlayer(player.playerId, player.playerName)} - 
                                        <span class="points">${player.punkte} Pkt.</span> 
                                        (<span class="owner-name" data-owner-id="${player.owner}">Laden...</span>)
                                    </div>`;
                                });
                                text += '</div></div>';

                                elfContainersToUpdate.push({
                                    containerId: containerId,
                                    players: players
                                });

                            } catch (e) {
                                addDebug('[renderNews] ELFDESTAGES Fehler: ' + e.message);
                                text = news.text;
                                errorCount++;
                            }
                        }
                        else {
                            text = news.text;
                        }

                    } catch (e) {
                        addDebug('[renderNews] Unerwarteter Fehler bei News: ' + e.message);
                        text = news.text;
                        errorCount++;
                    }

                    html += `<li class="news-list-li">${text}</li>`;
                }
                html += `</ul></div></div>`;
            }
            html += `</div>`;
        }

        const newsListDiv = document.getElementById('news-list');
        if (newsListDiv) {
            newsListDiv.innerHTML = html || '<div style="padding:16px; color:#888;">Keine News vorhanden.</div>';
            newsListDiv.style.display = '';
            addDebug('[renderNews] Erfolgreich gerendert mit ' + errorCount + ' Fehlern');

            requestAnimationFrame(() => {
                elfContainersToUpdate.forEach(async (item) => {
                    const container = document.getElementById(item.containerId);
                    if (container) {
                        const ownerSpans = container.querySelectorAll('.owner-name');
                        for (let i = 0; i < item.players.length; i++) {
                            const ownerId = item.players[i].owner;
                            try {
                                // Besitzer-Name als Link zur Userübersicht rendern
                                const linkHtml = await getUserLink(ownerId);
                                if (ownerSpans[i]) {
                                    ownerSpans[i].outerHTML = linkHtml;
                                }
                            } catch (e) {
                                addDebug('[renderNews] Fehler beim Laden von Owner ' + ownerId + ': ' + e);
                                if (ownerSpans[i]) {
                                    ownerSpans[i].textContent = 'Unbekannt';
                                }
                            }
                        }
                    }
                });
            });
        } else {
            addDebug('[renderNews] FEHLER: news-list nicht gefunden!');
        }

    } catch (error) {
        addDebug('[renderNews] Kritischer Fehler: ' + error.message);
        const newsListDiv = document.getElementById('news-list');
        if (newsListDiv) {
            newsListDiv.innerHTML = '<div style="padding:16px; color:#e53935;">Fehler: ' + error.message + '</div>';
        }
    }
}