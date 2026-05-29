document.addEventListener('DOMContentLoaded', async () => {
    // Hilfsfunktionen
    function formatCurrency(value) {
        if (value === null || value === undefined || isNaN(Number(value))) return '-';
        return Number(value).toLocaleString('de-DE') + ' €';
    }

    function loadUserData() {
        return new Promise((resolve) => {
            fetchJSON(DATA_URLS.users)
                .then(users => resolve(users))
                .catch(e => {
                    addDebug('Fehler beim Laden der Userdaten: ' + e.message);
                    resolve([]);
                });
        });
    }

    function loadTransferData() {
        return new Promise((resolve) => {
            fetchJSON(DATA_URLS.news)
                .then(newsObj => {
                    const transfers = [];
                    if (newsObj.newsDB && Array.isArray(newsObj.newsDB)) {
                        newsObj.newsDB.forEach(day => {
                            if (day.news && Array.isArray(day.news)) {
                                day.news.forEach(n => {
                                    if (n.art === 'TRANSFER') {
                                        try {
                                            const transfer = JSON.parse(n.text);
                                            transfer.date = n.date;
                                            transfer.id = n.id;
                                            transfers.push(transfer);
                                        } catch (e) {
                                            addDebug('Fehler beim Parsen von Transfer: ' + n.text);
                                        }
                                    }
                                });
                            }
                        });
                    }
                    addDebug('[DEBUG] Transfers geladen: ' + transfers.length);
                    resolve(transfers);
                })
                .catch(e => {
                    addDebug('Fehler beim Laden der Transfers: ' + e.message);
                    resolve([]);
                });
        });
    }

    function loadPointsHistory() {
        return new Promise((resolve) => {
            fetchJSON(DATA_URLS.users)
                .then(users => {
                    const points = [];
                    users.forEach(user => {
                        if (user.punkteHistorie && user.user) {
                            Object.entries(user.punkteHistorie).forEach(([spieltag, punkte]) => {
                                points.push({
                                    userId: user.user.id,
                                    userName: user.user.name,
                                    spieltag,
                                    punkte
                                });
                            });
                        }
                    });
                    resolve(points);
                })
                .catch(e => {
                    addDebug('Fehler beim Laden der Punkte: ' + e.message);
                    resolve([]);
                });
        });
    }

    // Globale Toggle-Funktion für Stats-Karten
    window.toggleStatsCard = function (button) {
        const card = button.closest('.stat-card');
        const isExpanded = !button.classList.contains('expanded');

        // Alle Karten zurücksetzen
        document.querySelectorAll('.toggle-button').forEach(btn => {
            btn.classList.remove('expanded');
            btn.textContent = 'Top 10 anzeigen';
            btn.closest('.stat-card').classList.remove('expanded');
        });

        if (isExpanded) {
            button.classList.add('expanded');
            button.textContent = 'Weniger anzeigen';
            card.classList.add('expanded');
        }
    };

    async function init() {
        const [users, transfers, pointsHistory] = await Promise.all([
            loadUserData(),
            loadTransferData(),
            loadPointsHistory()
        ]);

        addDebug('[DEBUG] Users geladen: ' + users.length);
        addDebug('[DEBUG] PointsHistory geladen: ' + pointsHistory.length);

        const START_GUTHABEN = 20000000;

        // Stats-Objekt initialisieren
        const stats = {};

        // 1. User-Statistiken (ohne Computer in der Tabelle)
        const userStats = {};

        users.forEach(user => {
            if (user.user && user.user.id && user.user.id !== "1") {
                userStats[user.user.id] = {
                    id: user.user.id,
                    name: user.user.name,
                    loginName: user.user.loginName,
                    kontostand: user.guthaben || 0,
                    teamwert: user.teamValue || 0,
                    transfers: 0,
                    punkte: user.punkte || 0,
                    punkteEinnahmen: (user.punkte || 0) * 10000,
                    ausgegeben: 0,
                    eingenommen: 0,
                    letztePunkte: user.lastPoints || '0',
                    expectedKontostand: 0
                };
            }
        });

        const userNameToId = {};
        Object.values(userStats).forEach(user => {
            if (user.name) userNameToId[user.name.toLowerCase()] = user.id;
            if (user.loginName) userNameToId[user.loginName.toLowerCase()] = user.id;
        });

        const transferNameToId = {};
        transfers.forEach(t => {
            if (t.buyerId && typeof t.buyerId === 'string' && /^\d+$/.test(t.buyerId) && t.buyer) {
                transferNameToId[t.buyer.toLowerCase()] = t.buyerId;
            }
            if (t.sellerId && typeof t.sellerId === 'string' && /^\d+$/.test(t.sellerId) && t.seller) {
                transferNameToId[t.seller.toLowerCase()] = t.sellerId;
            }
        });

        function resolveUserId(rawId, displayName) {
            if (rawId && userStats[rawId]) return rawId;
            if (typeof rawId === 'string' && /^\d+$/.test(rawId) && userStats[rawId]) return rawId;
            if (displayName) {
                const normalizedName = displayName.toLowerCase();
                if (userNameToId[normalizedName]) return userNameToId[normalizedName];
                if (transferNameToId[normalizedName]) return transferNameToId[normalizedName];
            }
            return rawId;
        }

        // Transfers verarbeiten (Computer-Transfers zählen mit!)
        transfers.forEach(t => {
            const normalizedBuyerId = resolveUserId(t.buyerId, t.buyer);
            const normalizedSellerId = resolveUserId(t.sellerId, t.seller);

            if (normalizedBuyerId && normalizedBuyerId !== "1" && userStats[normalizedBuyerId]) {
                userStats[normalizedBuyerId].transfers++;
                userStats[normalizedBuyerId].ausgegeben += Number(t.price) || 0;
            }

            if (normalizedSellerId && normalizedSellerId !== "1" && userStats[normalizedSellerId]) {
                userStats[normalizedSellerId].transfers++;
                userStats[normalizedSellerId].eingenommen += Number(t.price) || 0;
            }
        });

        Object.values(userStats).forEach(user => {
            user.gesamtbewegung = user.eingenommen - user.ausgegeben + user.punkteEinnahmen;
            user.expectedKontostand = START_GUTHABEN + user.eingenommen - user.ausgegeben + user.punkteEinnahmen;
        });

        // 2. Tabelle befüllen
        const tableBody = document.getElementById('userTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';

            Object.values(userStats).forEach(user => {
                const tooltip = user.expectedKontostand !== user.kontostand
                    ? `Erwarteter Kontostand: ${formatCurrency(user.expectedKontostand)}`
                    : '';
                const row = document.createElement('tr');
                row.innerHTML = `
                                    <td>${user.name} <small>(${user.loginName || user.id})</small></td>
                                    <td class="currency"${tooltip ? ` title="${tooltip}"` : ''}>${formatCurrency(user.kontostand)}</td>
                                    <td class="currency">${formatCurrency(user.teamwert)}</td>
                                    <td class="text-center">${user.transfers}</td>
                                    <td class="text-center">${user.punkte}</td>
                                    <td class="currency positive">+${formatCurrency(user.punkteEinnahmen)}</td>
                                    <td class="currency negative">-${formatCurrency(user.ausgegeben)}</td>
                                    <td class="currency positive">+${formatCurrency(user.eingenommen)}</td>
                                    <td class="currency ${user.gesamtbewegung >= 0 ? 'positive' : 'negative'} total">
                                        ${user.gesamtbewegung >= 0 ? '+' : ''}${formatCurrency(user.gesamtbewegung)}
                                    </td>
                                `;
                tableBody.appendChild(row);
            });
        }

        // 3. Besondere Statistiken

        // === KORRIGIERT: Getradete Spieler finden ===

        function parseGermanDate(dateString) {
            if (!dateString) return 0;
            const parts = dateString.split('.').map(part => Number(part));
            if (parts.length !== 3 || parts.some(isNaN)) return 0;
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }

        const tradedPlayers = {};
        let buyCount = 0;
        let sellCount = 0;

        transfers.forEach(t => {
            const playerId = t.playerId;
            const rawBuyerId = t.buyerId;
            const rawSellerId = t.sellerId;
            const buyerId = resolveUserId(rawBuyerId, t.buyer);
            const sellerId = resolveUserId(rawSellerId, t.seller);
            const playerName = t.playerName;
            const price = Number(t.price) || 0;
            const transferDate = t.date;

            if (buyerId && buyerId !== "1" && sellerId === "1") {
                const key = `${playerId}_${buyerId}`;
                if (!tradedPlayers[key]) {
                    tradedPlayers[key] = {
                        buys: [],
                        sells: [],
                        playerName,
                        userId: buyerId
                    };
                }
                tradedPlayers[key].buys.push({ ...t, price, date: transferDate });
                buyCount++;
            }

            if (sellerId && sellerId !== "1" && buyerId === "1") {
                const key = `${playerId}_${sellerId}`;
                if (!tradedPlayers[key]) {
                    tradedPlayers[key] = {
                        buys: [],
                        sells: [],
                        playerName,
                        userId: sellerId
                    };
                }
                tradedPlayers[key].sells.push({ ...t, price, date: transferDate });
                sellCount++;
            }
        });

        addDebug(`[DEBUG] Käufe vom Computer: ${buyCount}, Verkäufe an Computer: ${sellCount}`);
        addDebug(`[DEBUG] Potenzielle getradete Spieler: ${Object.keys(tradedPlayers).length}`);

        const transferResults = [];
        let completeCount = 0;

        Object.values(tradedPlayers).forEach(group => {
            const buys = [...group.buys].sort((a, b) => parseGermanDate(a.date) - parseGermanDate(b.date));
            const sells = [...group.sells].sort((a, b) => parseGermanDate(a.date) - parseGermanDate(b.date));
            let buyIndex = 0;
            let sellIndex = 0;

            while (buyIndex < buys.length && sellIndex < sells.length) {
                const buy = buys[buyIndex];
                const sell = sells[sellIndex];
                const buyTime = parseGermanDate(buy.date);
                const sellTime = parseGermanDate(sell.date);

                if (sellTime >= buyTime) {
                    const profit = sell.price - buy.price;
                    transferResults.push({
                        player: group.playerName,
                        user: userStats[group.userId]?.name || buy.buyer,
                        buyPrice: buy.price,
                        sellPrice: sell.price,
                        profit,
                        buyDate: buy.date,
                        sellDate: sell.date
                    });
                    completeCount++;
                    addDebug(`[DEBUG] Kompletter Trade: ${group.playerName} (User ${group.userId}) - Gewinn: ${profit}€`);
                    buyIndex++;
                    sellIndex++;
                } else {
                    addDebug(`[DEBUG] Verkauf vor Kauf ignoriert: ${group.playerName} (User ${group.userId}) - Verkauf ${sell.date} vor Kauf ${buy.date}`);
                    sellIndex++;
                }
            }

            if (buyIndex < buys.length || sellIndex < sells.length) {
                addDebug(`[DEBUG] Unmatched transfers für ${group.playerName} (User ${group.userId}) - buys: ${buys.length}, sells: ${sells.length}`);
            }
        });

        addDebug(`[DEBUG] Komplette Trades mit buy + sell: ${completeCount}`);
        addDebug(`[DEBUG] transferResults Länge: ${transferResults.length}`);

        // Sortiere nach Profit
        const sortedByProfit = [...transferResults].sort((a, b) => b.profit - a.profit);
        stats.bestTransfer = sortedByProfit.slice(0, 10);
        stats.worstTransfer = [...sortedByProfit].sort((a, b) => a.profit - b.profit).slice(0, 10);

        addDebug(`[DEBUG] Beste Transfers: ${stats.bestTransfer.length}`);
        if (stats.bestTransfer.length > 0) {
            addDebug(`[DEBUG] Bester: ${stats.bestTransfer[0].player} +${stats.bestTransfer[0].profit}€`);
        }
        addDebug(`[DEBUG] Schlechteste Transfers: ${stats.worstTransfer.length}`);
        if (stats.worstTransfer.length > 0) {
            addDebug(`[DEBUG] Schlechtester: ${stats.worstTransfer[0].player} ${stats.worstTransfer[0].profit}€`);
        }

        // Teuerste Käufe/Verkäufe
        const sortedBuys = [...transfers]
            .filter(t => t.buyerId && t.buyerId !== "1")
            .sort((a, b) => (b.price || 0) - (a.price || 0))
            .slice(0, 10)
            .map(t => ({
                player: t.playerName,
                user: userStats[t.buyerId]?.name || t.buyer,
                price: t.price,
                value: t.playerValue,
                date: t.date
            }));
        stats.expensiveBuy = sortedBuys;

        const sortedSells = [...transfers]
            .filter(t => t.sellerId && t.sellerId !== "1")
            .sort((a, b) => (b.price || 0) - (a.price || 0))
            .slice(0, 10)
            .map(t => ({
                player: t.playerName,
                user: userStats[t.sellerId]?.name || t.seller,
                price: t.price,
                value: t.playerValue,
                date: t.date
            }));
        stats.expensiveSell = sortedSells;

        // Höchste Punktzahl an einem Spieltag
        const sortedPoints = [...pointsHistory]
            .sort((a, b) => (b.punkte || 0) - (a.punkte || 0))
            .slice(0, 10);
        stats.highestPoints = sortedPoints;

        // Meisten Transfers
        stats.mostTransfers = Object.values(userStats)
            .sort((a, b) => b.transfers - a.transfers)
            .slice(0, 10);

        // Meisten Punkte (Gesamt)
        stats.mostPoints = Object.values(userStats)
            .sort((a, b) => b.punkte - a.punkte)
            .slice(0, 10);

        // Höchster Teamwert
        stats.highestTeamValue = Object.values(userStats)
            .sort((a, b) => b.teamwert - a.teamwert)
            .slice(0, 10);

        // Höchster Kontostand
        stats.highestBalance = Object.values(userStats)
            .sort((a, b) => b.kontostand - a.kontostand)
            .slice(0, 10);

        // 4. Statistik-Karten befüllen
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            // Änderung der renderStatsCard Funktion
            function renderStatsCard(title, icon, entries, valueFormatter, detailFormatter) {
                if (entries.length === 0) {
                    return `
<div class="stat-card">
                <h3><span class="stat-icon">${icon}</span>${title}</h3>
                <div style="color:#999; font-style:italic; padding:8px;">Keine Daten verfügbar</div>
            </div>
        `;
                }

                const shownEntries = entries.slice(0, 3);
                const hiddenEntries = entries.slice(3, 10);

                return `
        <div class="stat-card">
            <div class="stat-card-content">
                <h3><span class="stat-icon">${icon}</span>${title}</h3>
                ${shownEntries.map((entry, i) => `
                    <div class="stat-entry displayed-entry">
                        <div class="stat-entry-main">
                            <span class="stat-entry-rank">${i + 1}.</span>
                            <span>${valueFormatter(entry, i)}</span>
                        </div>
                        <div class="stat-entry-secondary">
                            ${detailFormatter(entry, i)}
                        </div>
                    </div>
                `).join('')}
                ${hiddenEntries.map((entry, i) => `
                    <div class="stat-entry hidden-entry">
                        <div class="stat-entry-main">
                            <span class="stat-entry-rank">${i + 4}.</span>
                            <span>${valueFormatter(entry, i + 3)}</span>
                        </div>
                        <div class="stat-entry-secondary">
                            ${detailFormatter(entry, i + 3)}
                        </div>
                    </div>
                `).join('')}
            </div>
            ${entries.length > 3 ? `
                <div class="stat-card-footer">
                    <button onclick="toggleStatsCard(this)" class="toggle-button">Top 10 anzeigen</button>
                </div>
            ` : ''}
        </div>
    `;
            }

            statsGrid.innerHTML = `
                ${renderStatsCard(
                'Beste Transfers', '📈',
                stats.bestTransfer,
                (t) => `<span class="profit">+${formatCurrency(t.profit)}</span>`,
                (t) => `${t.player} (${t.user})<br>Kauf: ${formatCurrency(t.buyPrice)} am ${t.buyDate}<br>Verkauf: ${formatCurrency(t.sellPrice)} am ${t.sellDate}`
            )}
                ${renderStatsCard(
                'Schlechteste Transfers', '📉',
                stats.worstTransfer,
                (t) => `<span class="loss">${formatCurrency(t.profit)}</span>`,
                (t) => `${t.player} (${t.user})<br>Kauf: ${formatCurrency(t.buyPrice)} am ${t.buyDate}<br>Verkauf: ${formatCurrency(t.sellPrice)} am ${t.sellDate}`
            )}
                ${renderStatsCard(
                'Teuerste Käufe', '💸',
                stats.expensiveBuy,
                (t) => `${formatCurrency(t.price)}`,
                (t) => `${t.player} (${t.user})<br>Marktwert: ${formatCurrency(t.value)}<br>Datum: ${t.date}`
            )}
                ${renderStatsCard(
                'Teuerste Verkäufe', '💰',
                stats.expensiveSell,
                (t) => `${formatCurrency(t.price)}`,
                (t) => `${t.player} (${t.user})<br>Marktwert: ${formatCurrency(t.value)}<br>Datum: ${t.date}`
            )}
                ${renderStatsCard(
                'Höchste Punkte (Spieltag)', '🏆',
                stats.highestPoints,
                (p) => `${p.punkte || '0'} Pkt.`,
                (p) => `${p.userName || 'Unbekannt'} (Spieltag ${p.spieltag || '?'})`
            )}
            ${renderStatsCard(
                'Meisten Transfers', '🔄',
                stats.mostTransfers,
                (u) => `${u.transfers} Transfers`,
                (u) => `${u.name}<br>${formatCurrency(u.ausgegeben)} ausgegeben<br>${formatCurrency(u.eingenommen)} eingenommen`
            )}
            ${renderStatsCard(
                'Meisten Punkte', '⭐',
                stats.mostPoints,
                (u) => `${u.punkte} Pkt.`,
                (u) => `${u.name}<br>${formatCurrency(u.punkteEinnahmen)} aus Punkten`
            )}
            ${renderStatsCard(
                'Höchster Teamwert (aktuell)', '🏅',
                stats.highestTeamValue,
                (u) => `${formatCurrency(u.teamwert)}`,
                (u) => `${u.name}<br>${u.transfers} Transfers`
            )}
            ${renderStatsCard(
                'Höchster Kontostand (aktuell)', '💎',
                stats.highestBalance,
                (u) => `${formatCurrency(u.kontostand)}`,
                (u) => `${u.name}`
            )}
            `;
        }

        // 5. Sortierfunktionen für die Tabelle (korrigierte Indizes)
        const table = document.getElementById('userTable');
        if (table) {
            const headers = table.querySelectorAll('th');
            headers.forEach((header, index) => {
                header.addEventListener('click', () => {
                    const rows = Array.from(table.querySelectorAll('tbody tr'));
                    const isAsc = header.getAttribute('data-sort') === 'asc';

                    if (index === 0) {
                        // Name sortieren
                        rows.sort((a, b) => {
                            const nameA = a.cells[0].textContent.toLowerCase();
                            const nameB = b.cells[0].textContent.toLowerCase();
                            return isAsc ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
                        });


                    } else if ([1, 2, 5, 6, 7, 8].includes(index)) {
                        // Währungen (€) sortieren: Kontostand(1), Teamwert(2), PunkteEinnahmen(5), Ausgaben(6), Einnahmen(7), Gesamt(8)

                        rows.sort((a, b) => {
                            const valA = parseFloat(a.cells[index].textContent.replace(/[^\d-]/g, '') || 0);
                            const valB = parseFloat(b.cells[index].textContent.replace(/[^\d-]/g, '') || 0);
                            return isAsc ? valB - valA : valA - valB;
                        });
                    } else {
                        // Zahlen sortieren (Transfers(3), Punkte(4))
                        rows.sort((a, b) => {
                            const valA = parseFloat(a.cells[index].textContent || 0);
                            const valB = parseFloat(b.cells[index].textContent || 0);
                            return isAsc ? valB - valA : valA - valB;
                        });
                    }

                    // Daten rendern
                    table.querySelector('tbody').innerHTML = '';
                    rows.forEach(row => table.querySelector('tbody').appendChild(row));

                    // Sortierstatus umkehren
                    header.setAttribute('data-sort', isAsc ? 'desc' : 'asc');

                    // Alle anderen Header zurücksetzen
                    headers.forEach(h => {
                        if (h !== header) h.removeAttribute('data-sort');
                    });
                });
            });
        }
    }

    // Initialisierung starten
    init();
});