// ----- FILTERMENÜ & LOGIK -----

let activeFilters = {};

document.addEventListener('DOMContentLoaded', () => {
    // ... bestehendes Eventlistener ...
    setupFilterMenu();
});

function setupFilterMenu() {
    const toggleBtn = document.getElementById('toggleFilterMenuBtn');
    const filterForm = document.getElementById('filterForm');
    const resetBtn = document.getElementById('resetFilterBtn');

    let open = !window.matchMedia('(max-width: 767px)').matches;
    filterForm.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));

    toggleBtn.addEventListener('click', () => {
        open = !open;
        filterForm.hidden = !open;
        toggleBtn.setAttribute('aria-expanded', String(open));
    });

    // Checkbox Events
    filterForm.querySelectorAll('input[type="checkbox"]').forEach(box => {
        box.addEventListener('change', () => {
            applyAllFilters();
        });
    });

    resetBtn.addEventListener('click', () => {
        filterForm.reset();
        applyAllFilters();
    });
}

// Kombiniere alle Filter und rendere die gefilterte Tabelle
function applyAllFilters() {
    const isComputerOwner = document.getElementById('filterComputerOwner').checked;
    const isPrice160000 = document.getElementById('filterPrice160000').checked;
    const isNotStatusAktiv = document.getElementById('filterNotStatusAktiv').checked;
    const isPriceBelowValue = document.getElementById('filterPriceBelowValue').checked;

    let filteredData = originalData.filter(item => {
        let show = true;
        
        // 1. Nur Computer-Angebote
        if (isComputerOwner) {
            let owner = (ownersMap.get(item.playerID) || ownersMap.get(Number(item.playerID)) || "Computer").toString().trim();
            show = show && (owner === "Computer");
        }
        
        // 2. Preis = 160000
        if (isPrice160000) {
            show = show && (Number(item.preis) === 160000);
        }
        
        // 3. Status ungleich aktiv (injuriesMap, Key: comunioPlayerId)
        if (isNotStatusAktiv) {
            const injuryStatusData = getInjuryStatusEntry(item.playerID);

            let statusValue = injuryStatusData?.status || item.status || null;
            if (!statusValue || String(statusValue).toLowerCase() === 'unbekannt' || statusValue === '') {
                statusValue = 'AKTIV';
            }
            
            const isAktiv = statusValue.toString().trim().toLowerCase() === 'aktiv';
            show = show && !isAktiv;
        }
        
        // 4. Preis niedriger als Wert
        if (isPriceBelowValue) {
            show = show && (Number(item.preis) < Number(item.wert));
        }
        
        return show;
    });

    renderTable(sortedData(filteredData));
}


// --- Lädt die Transfermarkt-Liste, normalisiert das Datenformat und wendet Filter + Sortierung an
async function loadTransferMarktData() {
    try {
        showLoading();
        addDebug("Lade Transfermarkt-Liste...");
        const response = await fetch(DATA_URLS.transfermarkt);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = normalizeTransfermarktData(await response.json());
        addDebug(`${data.length} Einträge geladen`);
        ownersMap = window.globalOwnersMap || new Map();
        originalData = data;
        applyAllFilters(); // GANZ WICHTIG für initiales Anwenden und Sortieren!
        hideLoading();
        showContent();
        initSortEvents();
    } catch (error) {
        hideLoading();
        throw error;
    }
}
