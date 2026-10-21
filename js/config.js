/**
 * Konfigurationsdatei mit Nutzer- und Repo-Daten sowie URL-Definitionen
 */

const GITHUB_USER = "torresbig";
const GITHUB_REPO_Data = "comunioFanApp";
const GITHUB_REPO_WEB = "comunioWebsite";

const DATA_URLS = {
  clubs: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/VereinsdatenbankJson.txt`,
  players: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/SpielerdatenbankNeutralJson.txt`,
  users: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/UserdatenbankJson_884691.txt`,
  playerToUser: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/PlayerToUserMap_884691.txt`,
  marktwerte: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/MarktwerteJson.txt`,
  transfermarkt: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/TransfermarktListe.json`,
  news: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/News.json`,
  logos: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_WEB}/main/logos/`,
  injuries: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/InjuriesDB.json`,
  lineups: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/UserLineups.json`,
    possibleLineups: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/PossibleFormatin.json`,
  // Club-Mapping (comunioId -> Vereinsname) als Fallback zur Vereinsdatenbank
  clubMapping: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/EspnClubMapping.json`,

  // Points-DB liegt im Data-Repository (comunioFanApp) — vermeidet 404 auf comunioWebsite
  points: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/PointsDB.json`,
  // Spieler, die nicht (mehr) in der Liga-/Spielerdatenbank stehen, aber weiterhin
  // Usern zugeordnet sein koennen (NotInLigaDB.json; enthaelt u.a. data.retired).
  notInLiga: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO_Data}/main/data/NotInLigaDB.json`
};

const WEBSITE_URLS = {
  playerUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/player.html?id=`,
  playerDbUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/playerDb.html`,
  statistikUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/statistik.html`,
  kontostaendeUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/kontostaende.html`,
  useruebersichtUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/useruebersicht.html`,
  aufstellungUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/voraussichtlicheAufstellung.html`,
  transfersUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/transfers.html`,
  transferMarktUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/transfermarktComunio.html`,
  indexUrl: `https://${GITHUB_USER}.github.io/${GITHUB_REPO_WEB}/index.html`
};

// Zentrale Menü-Konfiguration für alle Hamburger-Menüs (alle Seiten).
// Änderungen hier wirken sich auf alle Seiten aus, in denen das
// Hamburger-Menü geladen wird (js/hamburgerMenu.js).
const HAMBURGER_MENU_CONFIG = {
  items: [
    { id: 'linkIndex',        label: '📰 News',                href: WEBSITE_URLS.indexUrl,              target: '',                activePage: 'index.html' },
    { id: 'linkPlayerDb',     label: '📋 Spielerdatenbank',    href: WEBSITE_URLS.playerDbUrl,             target: '',                activePage: 'playerDb.html' },
    { id: 'linkStatistik',    label: '📊 Statistik',            href: WEBSITE_URLS.statistikUrl,            target: '',                activePage: 'statistik.html' },
    { id: 'linkAufstellung',  label: '⚽ voraussichtliche Aufstellungen',       href: WEBSITE_URLS.aufstellungUrl,          target: '',                activePage: 'voraussichtlicheAufstellung.html' },
    { id: 'linkTransfermarktComunio', label: '📑 Transfermarkt (Comunio)', href: WEBSITE_URLS.transferMarktUrl, target: '', activePage: 'transfermarktComunio.html' },
    { id: 'linkTransferuebersicht', label: '🔄 Transferübersicht', href: WEBSITE_URLS.transfersUrl,         target: '',                activePage: 'transfers.html' },
    { id: 'linkUseruebersicht', label: '👤 Userübersicht',     href: WEBSITE_URLS.useruebersichtUrl,       target: '',                activePage: 'useruebersicht.html' },
    { id: 'linkInstagram',    label: '📸 Instagram: ComunioFanApp', href: 'https://www.instagram.com/comuniofanapp/', target: '_blank' }
  ],

  // versteckter Link („Tarn"-Link), der nach 5 Klicks aktiv wird.
  // Ziel ist in beiden Umgebungen die Statistik-Seite mit showStats=true
  // (nur dieser Parameter blendet dort die „User Übersicht"-Tabelle ein).
  tarnItem: {
    id: 'menuTarnItem',
    label: 'erstellt von comunioFanApp',
    href: `${WEBSITE_URLS.statistikUrl}?showStats=true`,
    localPath: 'statistik.html?showStats=true',
    clicksToActivate: 5,
    timeoutMs: 3000
  }
};
