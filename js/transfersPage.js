// transferTable.js

document.addEventListener("DOMContentLoaded", async () => {
    // --- Datenquellen wie config.js


    // Elemente in HTML
    const userFilter = document.getElementById("userFilter"); // <select> für Nutzer
    const tableBody = document.querySelector("#transfersTable tbody"); // Tabelle

    // --- Spielerdatenbank laden
    const playerDbResp = await fetch(DATA_URLS.players);
    const playerDbJson = await playerDbResp.json();
    const playerDb = {};
    (playerDbJson.playerDB || []).forEach(p => {
        // ID und aktuellen Wert mit Referenzwert merken
        playerDb[String(p.id)] = {
            value: p.data?.wert || 0,
            lastValue: p.data?.lastWert
        };
    });

    // --- Transfernews laden
    const newsResp = await fetch(DATA_URLS.news);
    const newsJson = await newsResp.json();

    // Alle Transfers extrahieren (flach als Array)
    const transfers = [];
    newsJson.newsDB.forEach(day => {
        (day.news || []).forEach(entry => {
            if (entry.art === "TRANSFER") {
                try {
                    const tData = JSON.parse(entry.text);
                    transfers.push({
                        date: entry.date,
                        playerId: String(entry.playerId),
                        playerName: tData.playerName,
                        seller: tData.seller,
                        buyer: tData.buyer,
                        price: tData.price,
                        value: tData.playerValue
                    });
                } catch (err) {
                    // Fehler ignorieren
                }
            }
        });
    });

    function parseTransferDate(dateString) {
        if (!dateString) return 0;

        const germanDate = String(dateString).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (germanDate) {
            const [, day, month, year, hours = "0", minutes = "0"] = germanDate;
            return new Date(year, month - 1, day, hours, minutes).getTime();
        }

        const timestamp = Date.parse(dateString);
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    transfers.sort((a, b) => parseTransferDate(b.date) - parseTransferDate(a.date));

    // --- User-Liste sammeln
    const allUsersSet = new Set();
    transfers.forEach(t => {
        if (t.buyer) allUsersSet.add(t.buyer);
        if (t.seller) allUsersSet.add(t.seller);
    });
    const allUsers = Array.from(allUsersSet).sort();
    const defaultUser = allUsers.includes("Computer") ? "Computer" : "";

    // --- Filter-Dropdown erstellen
    allUsers.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = u;
        userFilter.appendChild(opt);
    });
    userFilter.value = defaultUser;

    // --- Tabelle rendern
    function renderTable(filterUser) {
        tableBody.innerHTML = "";
        const filtered = filterUser ? transfers.filter(t => t.buyer === filterUser || t.seller === filterUser) : transfers;

        let totalPurchases = 0, totalSales = 0, profitLoss = 0; // Summen init

    filtered.forEach(t => {
            const transferValue = Number(t.value) || 0;
            const currentPlayer = playerDb[t.playerId] || {};
            const currentRawValue = Number(currentPlayer.value);
            const currentValue = Number.isFinite(currentRawValue) ? currentRawValue : transferValue;
            let dealHtml = "";
            let diff = 0;
            let tooltip = "";
            const price = Number(t.price) || 0;

            if (filterUser) {
                if (t.buyer === filterUser) { // Kauf
                    diff = currentValue - price;
                    totalPurchases += price;
                    tooltip = `Aktueller Wert minus Kaufpreis: ${formatCurrency(diff)}`;
                } else if (t.seller === filterUser) { // Verkauf
                    diff = price - transferValue;
                    totalSales += price;
                    profitLoss += diff;
                    tooltip = `Verkaufspreis minus Marktwert bei Transfer: ${formatCurrency(diff)}`;
                }
            } else {
                diff = transferValue - price;
                tooltip = `Marktwert bei Transfer minus Preis: ${formatCurrency(diff)}`;
            }

            if (diff > 0) dealHtml = `<span style="color:#27ae60;font-weight:bold;" title="${tooltip}">&#9650;</span>`;
            else if (diff < 0) dealHtml = `<span style="color:#e74c3c;font-weight:bold;" title="${tooltip}">&#9660;</span>`;
            else if (transferValue || filterUser) dealHtml = `<span style="color:#888;font-weight:bold;" title="Keine Änderung">&#9654;</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td data-label="Datum">${t.date}</td>
                <td data-label="Spieler"><a class="player-link" href="player.html?id=${t.playerId}" target="_blank">${t.playerName}</a></td>
                <td data-label="Verkäufer">${t.seller}</td>
                <td data-label="Käufer">${t.buyer}</td>
                <td data-label="Preis">${formatCurrency(price)}</td>
                <td data-label="Marktwert (Transfer)">${formatCurrency(transferValue)}</td>
                <td data-label="Aktueller Wert"><span class="transfer-value">${formatCurrency(currentValue)}</span>${unicodeTrend(getValueTrend(currentValue, currentPlayer.lastValue))}</td>
                <td data-label="Deal" style="text-align:center">${dealHtml}</td>
            `;
            tableBody.appendChild(tr);
        });

        const labelTotalPurchases = document.getElementById("labelTotalPurchases");
        const labelTotalSales = document.getElementById("labelTotalSales");
        const labelBalance = document.getElementById("labelBalance");
        const labelProfitLoss = document.getElementById("labelProfitLoss");

        if (filterUser) {
            labelTotalPurchases.textContent = "Gesamtausgaben:";
            labelTotalSales.textContent = "Gesamteinnahmen:";
            labelBalance.textContent = "Transferbilanz:";
            labelProfitLoss.textContent = "Gewinn/Verlust bei Verkäufen:";
            document.getElementById("totalPurchases").textContent = formatCurrency(totalPurchases);
            document.getElementById("totalSales").textContent = formatCurrency(totalSales);
            document.getElementById("balance").textContent = formatCurrency(totalSales - totalPurchases);
            document.getElementById("profitLoss").textContent = formatCurrency(profitLoss) + " " + (profitLoss >= 0 ? "📈" : "📉");
        } else {
            const totalVolume = transfers.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
            const transferCount = filtered.length;
            labelTotalPurchases.textContent = "Gesamtvolumen:";
            labelTotalSales.textContent = "Anzahl Transfers:";
            labelBalance.textContent = "Aktueller Filter:";
            labelProfitLoss.textContent = "Hinweis:";
            document.getElementById("totalPurchases").textContent = formatCurrency(totalVolume);
            document.getElementById("totalSales").textContent = transferCount;
            document.getElementById("balance").textContent = filterUser ? filterUser : "Alle Benutzer";
            document.getElementById("profitLoss").textContent = "Wähle einen Benutzer für detaillierte Auswertung.";
        }
    }

    // Währungsformat (mit Komma und €)
    function formatCurrency(v) {
        if (v == null || isNaN(Number(v))) return "-";
        return Number(v).toLocaleString("de-DE") + " €";
    }

    // --- Initial-Tabelle mit aktuellem Filterwert
    renderTable(userFilter.value);

    // --- Filter-Event
    userFilter.addEventListener("change", () => {
        renderTable(userFilter.value);
    });
});
