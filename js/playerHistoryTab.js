document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get("id");

    if (!playerId) return;

    const HISTORY_SECTIONS = ["transfersSection", "injuryHistorySection", "historicalSeasonsSection"];
    const historyRendered = { transfers: false, injuries: false, points: false };

    window.addEventListener("playerHistoricalPointsReady", event => {
        renderHistoricalSeasons(event.detail?.pointsHistory);
    });

    Promise.allSettled([
        fetchJSON(DATA_URLS.news),
        fetchJSON(DATA_URLS.injuries)
    ]).then(([newsResult, injuriesResult]) => {
        if (newsResult.status === "fulfilled") {
            renderTransfersTable(getPlayerTransfers(newsResult.value, playerId));
        } else {
            console.error("Fehler beim Laden der News:", newsResult.reason);
            renderTransfersError();
        }

        if (injuriesResult.status === "fulfilled") {
            renderInjuryHistory(
                getPlayerInjuryHistory(injuriesResult.value, playerId),
                getCurrentInjury(injuriesResult.value, playerId)
            );
        } else {
            console.error("Fehler beim Laden der InjuriesDB:", injuriesResult.reason);
            renderInjuryHistoryError();
        }
    });

    function markSectionRendered(key, sectionId, visible) {
        const section = document.getElementById(sectionId);
        if (section) section.style.display = visible ? "block" : "none";
        historyRendered[key] = true;
        updateHistoryFallback();
    }

    function updateHistoryFallback(force = false) {
        const fallback = document.getElementById("historyEmpty");
        if (!fallback) return;

        const allRendered = Object.values(historyRendered).every(Boolean);
        if (!allRendered && !force) return;

        const anyVisible = HISTORY_SECTIONS.some(id => {
            const section = document.getElementById(id);
            return Boolean(section) && section.style.display !== "none";
        });
        fallback.style.display = anyVisible ? "none" : "block";
    }

    // Safety-Net: Falls das Punkte-Event nie ankommt, Fallback trotzdem bewerten.
    setTimeout(() => updateHistoryFallback(true), 3000);

    function renderHistoricalSeasons(pointsHistory) {
        const tbody = document.querySelector("#historicalSeasonsTable tbody");
        tbody.innerHTML = "";

        const seasons = Array.isArray(pointsHistory) ? pointsHistory : [];
        seasons.forEach(season => {
            if (!season || typeof season !== "object" || Array.isArray(season)) return;
            Object.entries(season).forEach(([year, points]) => {
                const row = document.createElement("tr");
                [year, points].forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value ?? "";
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
        });

        markSectionRendered("points", "historicalSeasonsSection", tbody.children.length > 0);
    }

    function getPlayerTransfers(newsData, id) {
        const transfers = [];
        const newsDays = Array.isArray(newsData?.newsDB) ? newsData.newsDB : [];

        newsDays.forEach(day => {
            if (!Array.isArray(day.news)) return;
            day.news.forEach(entry => {
                if (entry.art !== "TRANSFER" || String(entry.playerId) !== id) return;
                try {
                    const transfer = JSON.parse(entry.text);
                    transfers.push({
                        date: entry.date || "",
                        seller: transfer.seller,
                        buyer: transfer.buyer,
                        price: transfer.price,
                        value: transfer.playerValue
                    });
                } catch (err) {
                    console.error("Fehler beim Parsen eines Transfers:", err);
                }
            });
        });

        return transfers;
    }

    function getPlayerInjuryHistory(injuriesData, id) {
        const history = injuriesData?.history;
        if (!history || typeof history !== "object" || Array.isArray(history)) return [];

        const playerHistory = Object.entries(history)
            .find(([playerId]) => String(playerId) === id)?.[1];
        return Array.isArray(playerHistory) ? playerHistory : [];
    }

    function getCurrentInjury(injuriesData, id) {
        const current = injuriesData?.injuriedAndBannedPlayer
            || injuriesData?.injuredAndBannedPlayer
            || injuriesData?.injuredAndBannedPlayers
            || injuriesData?.injuries;
        if (!current || typeof current !== "object" || Array.isArray(current)) return null;
        return Object.entries(current).find(([playerId]) => String(playerId) === id)?.[1] || null;
    }

    function renderTransfersTable(transfers) {
        const tbody = document.querySelector("#transfersTable tbody");
        const errorMessage = document.getElementById("transfersError");
        tbody.innerHTML = "";
        if (errorMessage) errorMessage.style.display = "none";

        const transfersList = Array.isArray(transfers) ? transfers : [];
        if (transfersList.length === 0) {
            markSectionRendered("transfers", "transfersSection", false);
            return;
        }

        transfersList.sort((a, b) => parseDate(b.date) - parseDate(a.date));

        transfersList.forEach(transfer => {
            const row = document.createElement("tr");
            [
                transfer.date,
                transfer.seller,
                transfer.buyer,
                formatAmount(transfer.price),
                formatAmount(transfer.value)
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "";
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        markSectionRendered("transfers", "transfersSection", true);
    }

    function renderInjuryHistory(history, currentInjury) {
        const container = document.getElementById("injuryHistoryList");
        const errorMessage = document.getElementById("injuryHistoryError");
        const sourceEntries = Array.isArray(history) ? history : [];
        const entries = sourceEntries
            .filter(entry => entry && typeof entry === "object" && !Array.isArray(entry))
            .sort((a, b) => getInjuryTimestamp(a) - getInjuryTimestamp(b));
        const uniqueEntries = [];

        entries.forEach(entry => {
            const existing = uniqueEntries.find(group => areSameInjuryEpisode(group.entry, entry));
            if (existing) {
                existing.lastUpdate = getLaterUpdateEntry(existing.lastUpdate, entry);
            } else {
                uniqueEntries.push({ entry, lastUpdate: entry });
            }
        });

        container.replaceChildren();
        if (errorMessage) errorMessage.style.display = "none";
        if (uniqueEntries.length === 0) {
            markSectionRendered("injuries", "injuryHistorySection", false);
            return;
        }

        const previousStatusByEntry = new Map();
        let previousStatus = "";
        uniqueEntries.forEach(group => {
            const entry = group.entry;
            const status = normalizeStatus(entry.status);
            previousStatusByEntry.set(entry, previousStatus && previousStatus !== status ? previousStatus : "");
            if (status) previousStatus = status;
        });

        uniqueEntries.reverse().forEach(group => {
            const { entry, lastUpdate } = group;
            const stillCurrent = isCurrentInjury(entry, currentInjury);
            const card = document.createElement("article");
            card.className = "injury-history-card";

            const heading = document.createElement("div");
            heading.className = "injury-history-heading";
            const status = document.createElement("strong");
            status.textContent = entry.status || "Verletzung";
            heading.appendChild(status);
            const date = document.createElement("span");
            date.textContent = formatDate(getInjuryUpdateTimestamp(lastUpdate));
            heading.appendChild(date);
            card.appendChild(heading);

            const details = document.createElement("div");
            details.className = "injury-history-details";
            appendInjuryDetail(details, "Beginn", formatDate(entry.sinceTimestamp));
            appendInjuryDetail(details, "Dauer", formatInjuryDuration(entry, stillCurrent, lastUpdate));
            const previousEntryStatus = previousStatusByEntry.get(entry);
            if (previousEntryStatus) {
                appendInjuryDetail(details, "Statuswechsel", `${previousEntryStatus} → ${entry.status}`);
            }

            const message = entry.reason || entry.lastNewsText || "";
            if (message && isHttpsUrl(entry.lastNewsLink)) {
                const link = document.createElement("a");
                link.className = "injury-history-link";
                link.href = entry.lastNewsLink;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = message;
                details.appendChild(link);
            } else {
                appendInjuryDetail(details, "Meldung", message);
            }

            card.appendChild(details);
            container.appendChild(card);
        });

        markSectionRendered("injuries", "injuryHistorySection", true);
    }

    function areSameInjuryEpisode(first, second) {
        const firstStart = getInjuryEpisodeTimestamp(first);
        const secondStart = getInjuryEpisodeTimestamp(second);
        return Boolean(firstStart && secondStart)
            && normalizeStatus(first.status) === normalizeStatus(second.status)
            && Math.abs(firstStart - secondStart) < 86400000;
    }

    function normalizeStatus(status) {
        return String(status || "").trim().toLocaleUpperCase("de-DE");
    }

    function getInjuryTimestamp(entry) {
        return parseDate(entry.statusChangeTimestamp || entry.statusChangeString || entry.sinceTimestamp);
    }

    function getInjuryEpisodeTimestamp(entry) {
        return parseDate(entry.sinceTimestamp) || getInjuryTimestamp(entry);
    }

    function getInjuryUpdateTimestamp(entry) {
        return [
            entry.statusChangeString,
            entry.statusChangeTimestamp,
            entry.abfrageTimestamp,
            entry.sinceTimestamp
        ].map(parseDate).filter(Boolean).sort((a, b) => b - a)[0] || 0;
    }

    function getLaterUpdateEntry(first, second) {
        return getInjuryUpdateTimestamp(second) > getInjuryUpdateTimestamp(first)
            ? second
            : first;
    }

    function isCurrentInjury(entry, currentInjury) {
        if (!currentInjury || normalizeStatus(entry.status) !== normalizeStatus(currentInjury.status)) return false;
        const historyStart = getInjuryEpisodeTimestamp(entry);
        const currentStart = getInjuryEpisodeTimestamp(currentInjury);
        return !historyStart || !currentStart || Math.abs(historyStart - currentStart) < 86400000;
    }

    function appendInjuryDetail(container, label, value) {
        if (!value) return;
        const detail = document.createElement("p");
        detail.className = "injury-history-detail";
        const name = document.createElement("strong");
        name.textContent = `${label}: `;
        detail.appendChild(name);
        detail.appendChild(document.createTextNode(value));
        container.appendChild(detail);
    }

    function formatInjuryDuration(entry, stillCurrent, lastUpdate) {
        const since = parseDate(entry.sinceTimestamp);
        const observed = stillCurrent
            ? Date.now()
            : parseDate(getInjuryUpdateTimestamp(lastUpdate));
        if (since && observed >= since) {
            const days = Math.max(1, Math.floor((dateOnly(observed) - dateOnly(since)) / 86400000));
            return days === 1 ? "1 Tag" : `${days} Tage`;
        }
        return entry.sinceString || "";
    }

    function dateOnly(timestamp) {
        const date = new Date(timestamp);
        return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function parseDate(value) {
        if (!value) return 0;
        const date = /^\d{2}\.\d{2}\.\d{4}$/.test(value)
            ? new Date(value.split(".").reverse().join("-"))
            : new Date(value);
        const timestamp = date.getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function formatDate(value) {
        const timestamp = parseDate(value);
        return timestamp ? new Date(timestamp).toLocaleDateString("de-DE") : "";
    }

    function formatAmount(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toLocaleString("de-DE") : "";
    }

    function isHttpsUrl(value) {
        try {
            return new URL(value).protocol === "https:";
        } catch {
            return false;
        }
    }

    function renderTransfersError() {
        const errorMessage = document.getElementById("transfersError");
        if (errorMessage) errorMessage.style.display = "block";
        markSectionRendered("transfers", "transfersSection", true);
    }

    function renderInjuryHistoryError() {
        const errorMessage = document.getElementById("injuryHistoryError");
        if (errorMessage) errorMessage.style.display = "block";
        markSectionRendered("injuries", "injuryHistorySection", true);
    }
});
