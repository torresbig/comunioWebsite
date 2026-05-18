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

    async function init() {
        const [users, transfers, pointsHistory] = await Promise.all([
            loadUserData(),
            loadTransferData(),
            loadPointsHistory()
        ]);

        addDebug('[DEBUG] Users geladen: ' + users.length);
        addDebug('[DEBUG] PointsHistory geladen: ' + pointsHistory.length);

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
                    punkte: user.punkte || 0,
                    punkteEinnahmen: (user.punkte || 0) * 10000,
                    transfers: 0,
                    ausgegeben: 0,
                    eingenommen: 0,
                    letztePunkte: user.lastPoints || '0'
                };
            }
        });

        // Transfers verarbeiten (Computer-Transfers zählen mit!)
        transfers.forEach(t => {
            if (t.buyerId && t.buyerId !== "1" && userStats[t.buyerId]) {
                userStats[t.buyerId].transfers++;
                userStats[t.buyerId].ausgegeben += Number(t.price) || 0;
            }
            
            if (t.sellerId && t.sellerId !== "1" && userStats[t.sellerId]) {
                userStats[t.sellerId].transfers++;
                userStats[t.sellerId].eingenommen += Number(t.price) || 0;
            }
        });

        Object.values(userStats).forEach(user => {
            user.gesamtbewegung = user.eingenommen - user.ausgegeben + user.punkteEinnahmen;
        });

        // 2. Tabelle befüllen
        const tableBody = document.getElementById('userTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            
            Object.values(userStats).forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.name} <small>(${user.loginName || user.id})</small></td>
                    <td class="currency">${formatCurrency(user.kontostand)}</td>
                    <td class="currency">${formatCurrency(user.teamwert)}</td>
                    <td>${user.punkte}</td>
                    <td class="currency positive">+${formatCurrency(user.punkteEinnahmen)}</td>
                    <td>${user.transfers}</td>
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
        const stats = {
            bestTransfer: [],
            worstTransfer: [],
            expensiveBuy: [],
            expensiveSell: [],
            highestPoints: []
        };

        // === KORRIGIERT: Getradete Spieler finden ===
        const tradedPlayers = {};
        addDebug('[DEBUG] Suche getradete Spieler...');
        let buyCount = 0, sellCount = 0;

        transfers.forEach(t => {
            const playerId = t.playerId;
            const playerName = t.playerName;
            const buyerId = t.buyerId;
            const sellerId = t.sellerId;
            const price = Number(t.price) || 0;

            // Fall 1: User kauft vom Computer (sellerId === "1", buyerId !== "1")
            if (buyerId && buyerId !== "1" && sellerId === "1") {
                if (!tradedPlayers[playerId]) {
                    tradedPlayers[playerId] = {
                        buy: null,
                        sell: null,
                        playerName: playerName
                    };
                }
                tradedPlayers[playerId].buy = t;
                buyCount++;
                addDebug(`[DEBUG] Kauf gefunden: ${playerName} (${playerId}) von Computer an ${buyerId} für ${price}€`);
            }

            // Fall 2: User verkauft an Computer (buyerId === "1", sellerId !== "1")
            if (sellerId && sellerId !== "1" && buyerId === "1") {
                if (!tradedPlayers[playerId]) {
                    tradedPlayers[playerId] = {
                        buy: null,
                        sell: null,
                        playerName: playerName
                    };
                }
                tradedPlayers[playerId].sell = t;
                sellCount++;
                addDebug(`[DEBUG] Verkauf gefunden: ${playerName} (${playerId}) von ${sellerId} an Computer für ${price}€`);
            }
        });

        addDebug(`[DEBUG] Käufe vom Computer: ${buyCount}, Verkäufe an Computer: ${sellCount}`);
        addDebug(`[DEBUG] Potenzielle getradete Spieler: ${Object.keys(tradedPlayers).length}`);

        // Berechne Profit/Loss für getradete Spieler (NUR gleicher User)
        const transferResults = [];
        let completeCount = 0;
        
        Object.values(tradedPlayers).forEach(t => {
            if (t.buy && t.sell && t.buy.buyerId === t.sell.sellerId) {
                const profit = Number(t.sell.price) - Number(t.buy.price);
                transferResults.push({
                    player: t.playerName,
                    user: userStats[t.buy.buyerId]?.name || t.buy.buyer,
                    buyPrice: Number(t.buy.price),
                    sellPrice: Number(t.sell.price),
                    profit: profit,
                    buyDate: t.buy.date,
                    sellDate: t.sell.date
                });
                completeCount++;
                addDebug(`[DEBUG] Kompletter Trade: ${t.playerName} (User ${t.buy.buyerId}) - Gewinn: ${profit}€`);
            } else if (t.buy && t.sell && t.buy.buyerId !== t.sell.sellerId) {
                addDebug(`[DEBUG] Trade ignoriert (unterschiedliche User): ${t.playerName} - Kauf durch ${t.buy.buyerId} / Verkauf durch ${t.sell.sellerId}`);
            }
        });

        addDebug(`[DEBUG] Komplette Trades mit buy + sell: ${completeCount}`);
        addDebug(`[DEBUG] transferResults Länge: ${transferResults.length}`);

        // Sortiere nach Profit
        const sortedByProfit = [...transferResults].sort((a, b) => b.profit - a.profit);
        stats.bestTransfer = sortedByProfit.slice(0, 3);
        stats.worstTransfer = [...sortedByProfit].sort((a, b) => a.profit - b.profit).slice(0, 3);

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
            .slice(0, 3)
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
            .slice(0, 3)
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
            .slice(0, 3);
        stats.highestPoints = sortedPoints;

        // 4. Statistik-Karten befüllen
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            function renderStatsCard(title, icon, entries, valueFormatter, detailFormatter) {
                if (entries.length === 0) {
                    return `
                        <div class="stat-card">
                            <h3><span class="stat-icon">${icon}</span>${title}</h3>
                            <div style="color:#999; font-style:italic; padding:8px;">Keine Daten verfügbar</div>
                        </div>
                    `;
                }
                return `
                    <div class="stat-card">
                        <h3><span class="stat-icon">${icon}</span>${title}</h3>
                        ${entries.map((entry, i) => `
                            <div class="stat-entry">
                                <div class="stat-entry-main">
                                    <span class="stat-entry-rank">${i+1}.</span>
                                    <span>${valueFormatter(entry, i)}</span>
                                </div>
                                <div class="stat-entry-secondary">
                                    ${detailFormatter(entry, i)}
                                </div>
                            </div>
                        `).join('')}
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
                    } else if ([1, 2, 4, 6, 7, 8].includes(index)) {
                        // Währungen (€) sortieren: Kontostand(1), Teamwert(2), PunkteEinnahmen(4), Ausgaben(6), Einnahmen(7), Gesamt(8)
                        rows.sort((a, b) => {
                            const valA = parseFloat(a.cells[index].textContent.replace(/[^\d-]/g, '') || 0);
                            const valB = parseFloat(b.cells[index].textContent.replace(/[^\d-]/g, '') || 0);
                            return isAsc ? valB - valA : valA - valB;
                        });
                    } else {
                        // Zahlen sortieren (Punkte(3), Transfers(5))
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