// Helfer und Render-Bausteine für die Spieltagspunkte in der Aufstellungsansicht.
//
// Datenquelle: PointsDB.json (DATA_URLS.points), Aufbau je Spieltagseintrag (alles flach,
// kein "stats"-Unterobjekt mehr):
//   key, value (Comunio-Spieltagspunkte), points (Punkte aus den Spieldetails), status
//   (FULL|SUBOUT|SUBIN|NONE), active, einsatzzeit, subIn, subOut, rating, xgoals, tore,
//   goalAssists, gelbekarten, gelbrotekarten, rotekarten, totalPenalties, pensMissed,
//   pensSaved, cleanSheet, ownGoals, manOfTheMatchAmount, notenDurchschnitt,
//   punkteDurchschnitt sowie ESPN-Werte (Saison!): appearances, subIns, totalShots,
//   shotsOnTarget, offsides, saves, shotsFaced, goalsConceded, foulsCommitted, foulsSuffered
//
// Wichtig: Alle Felder können fehlen oder null sein. Bei value/points ist 0 (auch negativ)
// ein gültiger Wert, bei Zähl-Statistiken bedeutet 0 dagegen "kein Wert".
// Achtung: subIn/subOut sind Minuten, subIns ist dagegen ein ESPN-Saisonwert.

/** Positionsnamen der Aufstellung → Comunio-Positionsbezeichnungen. */
const LINEUP_POSITION_NAMES = {
  keeper: 'TORHÜTER',
  defender: 'ABWEHR',
  midfielder: 'MITTELFELD',
  striker: 'STURM'
};

/**
 * Normalisiert eine Positionsangabe (Aufstellung: keeper/defender/..., DB: TORHÜTER/...).
 * @param {string} position
 * @returns {string} TORHÜTER | ABWEHR | MITTELFELD | STURM | '' (unbekannt)
 */
function normalizeLineupPosition(position) {
  if (!position) return '';
  const value = String(position).trim();
  if (!value) return '';
  return LINEUP_POSITION_NAMES[value.toLowerCase()] || value.toUpperCase();
}

/**
 * Prüft, ob ein Wert als Zahl vorliegt (0 und negative Werte sind gültig, null/'' nicht).
 * @param {*} value
 * @returns {boolean}
 */
function hasLineupValue(value) {
  return value !== null && value !== undefined && value !== '' && !isNaN(Number(value));
}

/**
 * Liefert den Zahlenwert oder null (robust gegenüber null/''/Text).
 * @param {*} value
 * @returns {number|null}
 */
function toLineupNumber(value) {
  return hasLineupValue(value) ? Number(value) : null;
}

/**
 * Formatiert einen Statistik-Wert für die Anzeige ("—" wenn kein Wert vorliegt).
 * @param {*} value
 * @param {string} suffix z.B. ' Min.' oder '%'
 * @returns {string}
 */
function formatLineupStat(value, suffix = '') {
  return hasLineupValue(value) ? `${value}${suffix}` : '—';
}

/**
 * Formatiert eine Note (7 → "7,0").
 * @param {*} value
 * @returns {string}
 */
function formatLineupRating(value) {
  const rating = toLineupNumber(value);
  return rating === null || rating <= 0 ? '—' : rating.toFixed(1).replace('.', ',');
}

/**
 * Formatiert einen Marktwert in Euro.
 * @param {*} value
 * @returns {string}
 */
function formatLineupCurrency(value) {
  const amount = toLineupNumber(value);
  return amount === null ? '—' : '€' + amount.toLocaleString('de-DE');
}

/**
 * Einsatzzeit eines Spieltags ermitteln. Nutzt einsatzzeit, sonst die Wechselminute,
 * sonst – wenn active === 1 – die volle Spielzeit (active 1 = hat gespielt).
 * @param {Object} entry Spieltagseintrag aus der Points-DB
 * @returns {number|null} Minuten oder null (unbekannt/kein Einsatz)
 */
function getLineupEinsatzzeit(entry) {
  if (!entry) return null;
  const einsatzzeit = toLineupNumber(entry.einsatzzeit);
  if (einsatzzeit !== null && einsatzzeit > 0) return einsatzzeit;
  const subIn = toLineupNumber(entry.subIn);
  if (subIn !== null && subIn > 0) return Math.max(0, 90 - subIn);
  const subOut = toLineupNumber(entry.subOut);
  if (subOut !== null && subOut > 0) return subOut;
  if (toLineupNumber(entry.active) === 1) return 90;
  return null;
}

/**
 * Kurzer Status-Text für die Zeile (inkl. Wechselminute).
 * @param {Object} player Spieler der Aufstellung (nutzt substitute)
 * @param {Object|null} entry Spieltagseintrag aus der Points-DB
 * @returns {string}
 */
function getLineupStatusText(player, entry) {
  const isSubstitute = Boolean(player?.substitute);
  const rawStatus = entry?.status ? String(entry.status).trim().toUpperCase() : '';
  const subIn = toLineupNumber(entry?.subIn);
  const subOut = toLineupNumber(entry?.subOut);
  const subInMinute = subIn !== null && subIn > 0 ? subIn : null;
  const subOutMinute = subOut !== null && subOut > 0 ? subOut : null;
  const minutes = getLineupEinsatzzeit(entry);
  const minuteSuffix = minutes !== null && minutes > 0 ? ` (${minutes} Min.)` : '';

  switch (rawStatus) {
    case 'SUBIN':
      return subInMinute !== null ? `Eingewechselt ${subInMinute}. Min.${minuteSuffix}` : `Eingewechselt${minuteSuffix}`;
    case 'SUBOUT':
      return subOutMinute !== null ? `Startelf, raus ${subOutMinute}. Min.` : 'Startelf, ausgewechselt';
    case 'FULL':
      return isSubstitute ? 'Eingewechselt, durchgespielt' : 'Durchgespielt';
    case 'NONE':
      return isSubstitute ? 'Ersatzbank, nicht eingesetzt' : 'Nicht im Einsatz';
    default:
      break;
  }

  // Kein (vollständiger) Eintrag: aus active/value/einsatzzeit ableiten
  const active = toLineupNumber(entry?.active) === 1;
  const value = toLineupNumber(entry?.value);
  const played = active || (value !== null && value !== 0) || (minutes !== null && minutes > 0);
  if (isSubstitute) return played ? 'Ersatzbank, gespielt' : 'Ersatzbank';
  return played ? 'Gespielt (ohne Details)' : 'Keine Daten';
}

/**
 * Findet den Points-DB-Eintrag eines Spieltags.
 * @param {any[]} entries Einträge eines Spielers (getPointsEntriesForPlayer)
 * @param {string|number} matchday
 * @returns {Object|null}
 */
function getLineupPointsByPlayer(entries, matchday) {
  if (!Array.isArray(entries)) return null;
  return entries.find(item => item && String(item.key) === String(matchday)) || null;
}

/**
 * Baut die Detailgruppen eines Spielers (positionsabhängig) aus dem flachen Spieltagseintrag.
 * @param {Object} player Aufbereiteter Aufstellungsspieler (pointEntry, position, quotedprice)
 * @returns {Array<{title: string, items: Array<{label: string, value: string, tone?: string}>}>}
 */
function buildLineupDetailGroups(player) {
  const entry = player?.pointEntry || null;
  const position = normalizeLineupPosition(player?.position);
  const isKeeper = position === 'TORHÜTER';
  const groups = [];

  // ===== Leistung =====
  const performance = [];
  const value = toLineupNumber(entry?.value);
  const detailPoints = toLineupNumber(entry?.points);
  if (value !== null) performance.push({ label: 'Punkte (Comunio)', value: String(value) });
  if (detailPoints !== null && (value === null || detailPoints !== value)) {
    performance.push({ label: 'Punkte (Spieldetails)', value: String(detailPoints) });
  }
  const rating = toLineupNumber(entry?.rating);
  if (rating !== null && rating > 0) {
    performance.push({ label: 'Note', value: formatLineupRating(rating), tone: rating >= 7 ? 'positive' : (rating < 5 ? 'negative' : '') });
  }
  const minutes = getLineupEinsatzzeit(entry);
  if (minutes !== null && minutes > 0) performance.push({ label: 'Einsatzzeit', value: `${minutes} Min.` });
  const subIn = toLineupNumber(entry?.subIn);
  if (subIn !== null && subIn > 0) performance.push({ label: 'Eingewechselt', value: `${subIn}. Min.` });
  const subOut = toLineupNumber(entry?.subOut);
  if (subOut !== null && subOut > 0) performance.push({ label: 'Ausgewechselt', value: `${subOut}. Min.` });
  if (hasLineupValue(player?.quotedprice)) performance.push({ label: 'Marktwert', value: formatLineupCurrency(player.quotedprice) });
  if (performance.length) groups.push({ title: 'Leistung', items: performance });

  // ===== Offensive =====
  const offensive = [];
  const goals = toLineupNumber(entry?.tore);
  const assists = toLineupNumber(entry?.goalAssists);
  const xgoals = toLineupNumber(entry?.xgoals);
  const showGoals = Boolean(entry) && !isKeeper;
  if (showGoals || (goals !== null && goals > 0)) offensive.push({ label: 'Tore', value: String(goals ?? 0), tone: goals > 0 ? 'positive' : '' });
  if (showGoals || (assists !== null && assists > 0)) offensive.push({ label: 'Vorlagen', value: String(assists ?? 0), tone: assists > 0 ? 'positive' : '' });
  if (xgoals !== null && xgoals > 0) offensive.push({ label: 'xGoals', value: xgoals.toFixed(2).replace('.', ',') });
  if (offensive.length) groups.push({ title: 'Offensive', items: offensive });

  // ===== Karten & Disziplin (nur gefüllte Werte) =====
  const discipline = [];
  const pushPositive = (label, raw) => {
    const amount = toLineupNumber(raw);
    if (amount !== null && amount > 0) discipline.push({ label, value: String(amount) });
  };
  pushPositive('Gelbe Karten', entry?.gelbekarten);
  pushPositive('Gelb-Rote Karten', entry?.gelbrotekarten);
  pushPositive('Rote Karten', entry?.rotekarten);
  pushPositive('Verwandelte Elfmeter', entry?.totalPenalties);
  pushPositive('Verschossene Elfmeter', entry?.pensMissed);
  pushPositive('Eigentore', entry?.ownGoals);
  pushPositive('Fouls verursacht', entry?.foulsCommitted);
  pushPositive('Fouls erlitten', entry?.foulsSuffered);
  pushPositive('Man of the Match', entry?.manOfTheMatchAmount);
  if (discipline.length) groups.push({ title: 'Karten & Disziplin', items: discipline });

  // ===== Torwart (positionsabhängig) =====
  if (isKeeper) {
    const keeper = [];
    const cleanSheet = toLineupNumber(entry?.cleanSheet);
    const played = minutes !== null && minutes > 0;
    if (entry) {
      keeper.push({
        label: 'Zu Null',
        value: cleanSheet === null || !played ? '—' : (cleanSheet > 0 ? 'Ja' : 'Nein'),
        tone: cleanSheet !== null && cleanSheet > 0 ? 'positive' : ''
      });
    }
    const pensSaved = toLineupNumber(entry?.pensSaved);
    if (pensSaved !== null && pensSaved > 0) keeper.push({ label: 'Elfmeter gehalten', value: String(pensSaved), tone: 'positive' });
    if (keeper.length) groups.push({ title: 'Torwart', items: keeper });
  }

  // ===== Saison-Snapshot (ESPN) – nur wenn tatsächlich Werte vorliegen =====
  const season = [];
  const pushSeason = (label, raw) => {
    const amount = toLineupNumber(raw);
    if (amount !== null && amount > 0) season.push({ label, value: String(amount) });
  };
  pushSeason('Einsätze (Saison)', entry?.appearances);
  pushSeason('Einwechslungen (Saison)', entry?.subIns);
  pushSeason('Torschüsse (Saison)', entry?.totalShots);
  pushSeason('Schüsse aufs Tor (Saison)', entry?.shotsOnTarget);
  pushSeason('Abseits (Saison)', entry?.offsides);
  pushSeason('Paraden (Saison)', entry?.saves);
  pushSeason('Torschüsse gegen (Saison)', entry?.shotsFaced);
  pushSeason('Gegentore (Saison)', entry?.goalsConceded);
  if (season.length) groups.push({ title: 'Saison (ESPN)', items: season });

  return groups;
}

/**
 * Summiert die Spieltagspunkte der Startelf (Comunio-Wert) und sammelt Kennzahlen für den Kopf.
 * @param {Array<Object>} players Aufbereitete Aufstellungsspieler (pointsValue, substitute, pointEntry)
 * @returns {{starterPoints: number, benchPoints: number, starterCount: number, benchCount: number,
 *   playedCount: number, withoutDataCount: number, goals: number, assists: number}}
 */
function buildLineupSummary(players) {
  const summary = {
    starterPoints: 0,
    benchPoints: 0,
    starterCount: 0,
    benchCount: 0,
    playedCount: 0,
    withoutDataCount: 0,
    goals: 0,
    assists: 0
  };
  (players || []).forEach(player => {
    const points = toLineupNumber(player?.pointsValue);
    const substitute = Boolean(player?.substitute);
    if (substitute) summary.benchCount += 1;
    else summary.starterCount += 1;
    if (points !== null) {
      if (substitute) summary.benchPoints += points;
      else summary.starterPoints += points;
    }
    if (player?.pointEntry && player.pointEntry.status) summary.playedCount += 1;
    else if (points === null) summary.withoutDataCount += 1;
    const goals = toLineupNumber(player?.pointEntry?.tore);
    const assists = toLineupNumber(player?.pointEntry?.goalAssists);
    if (goals !== null && goals > 0) summary.goals += goals;
    if (assists !== null && assists > 0) summary.assists += assists;
  });
  return summary;
}

// Für Node-basierte Tests (im Browser wirkungslos).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeLineupPosition,
    hasLineupValue,
    toLineupNumber,
    formatLineupStat,
    formatLineupRating,
    formatLineupCurrency,
    getLineupEinsatzzeit,
    getLineupStatusText,
    getLineupPointsByPlayer,
    buildLineupDetailGroups,
    buildLineupSummary
  };
}
