/**
 * Einfache Smoke-Tests für die User-Übersicht.
 * Diese Datei ist bewusst minimal: sie prüft, ob die wichtigsten Daten geladen
 * und die erwarteten DOM-Elemente vorhanden sind. Ergebnisse werden über
 * addDebug() ausgegeben (sofern vorhanden) und zusätzlich in console.log.
 */

export function runSmokeTest({newsData, playersData, usersData, p2uData}) {
  const results = [];
  try {
    results.push({name: 'newsData', ok: Array.isArray(newsData) && newsData.length > 0});
    results.push({name: 'playersData', ok: playersData && playersData.playerDB && playersData.playerDB.length > 0});
    results.push({name: 'usersData', ok: Array.isArray(usersData) && usersData.length > 0});
    results.push({name: 'p2uData', ok: Array.isArray(p2uData) && p2uData.length > 0});
    results.push({name: 'notInLigaMap', ok: window.notInLigaMap instanceof Map && window.notInLigaMap.size > 0});

    // Spieler, die nur noch in der PlayerToUserMap stehen, muessen ueber die
    // NotInLigaDB aufloesbar sein (sonst fehlen sie im Userteam).
    try {
      const dbIds = new Set((playersData?.playerDB || []).map(p => String(p.id)));
      const ownedOnlyIds = Object.keys(Object.assign({}, ...(p2uData || []))).filter(id => !dbIds.has(String(id)));
      const resolvable = ownedOnlyIds.filter(id => typeof getNotInLigaEntry === 'function' && getNotInLigaEntry(id));
      results.push({
        name: 'notInLigaOwnedPlayers',
        ok: ownedOnlyIds.length === 0 || resolvable.length > 0,
        detail: resolvable.length + '/' + ownedOnlyIds.length + ' aufloesbar' 
      });
    } catch (err) {
      results.push({name: 'notInLigaOwnedPlayers', ok: false, message: err.message});
    }

    // DOM checks
    results.push({name: 'playerTable', ok: !!document.querySelector('#playerTable tbody')});
    results.push({name: 'transferTables', ok: !!document.querySelector('#transferTableAll tbody')});

    const failures = results.filter(r => !r.ok).map(r => r.name);
    if (typeof addDebug === 'function') {
      addDebug('SmokeTest: ' + (failures.length === 0 ? 'OK' : 'FAILED: ' + failures.join(', ')));
    }
    console.log('SmokeTest results:', results);
    return results;
  } catch (err) {
    console.error('SmokeTest exception', err);
    if (typeof addDebug === 'function') addDebug('SmokeTest exception: ' + err.message);
    return [{name: 'exception', ok: false, message: err.message}];
  }
}
