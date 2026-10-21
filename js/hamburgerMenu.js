document.addEventListener('DOMContentLoaded', function () {
  const hamburgerButton = document.getElementById('hamburgerButton');
  const hamburgerDropdown = document.getElementById('hamburgerDropdown');

  hamburgerButton.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    hamburgerDropdown.classList.toggle('show');
  });

  // Zentrale Konfiguration aus js/config.js
  // Hinweis: `const` in einem klassischen Script erzeugt eine globale
  // lexikalische Bindung – sie ist NICHT als window.-Eigenschaft verfügbar.
  // Deshalb wird zuerst der direkte Bezeichner geprüft, danach window.
  const menuConfig = (typeof HAMBURGER_MENU_CONFIG !== 'undefined')
    ? HAMBURGER_MENU_CONFIG
    : (window.HAMBURGER_MENU_CONFIG || {});
  const menuItems = menuConfig.items || [];
  const tarnItemConfig = menuConfig.tarnItem || {};

  // ---- Menü-HTML vollständig aus der Konfiguration generieren ----
  // Damit müssen die Links nicht in jeder HTML-Datei gehardcoded sein.
  let menuHTML = '';

  menuItems.forEach(function (item) {
    var href = item.href || '#';
    if (item.activePage) {
      // Interne Seite: zur Laufzeit lokal oder GitHub-Pages-URL auflösen
      href = getLokalOderGitURL(item.href, item.activePage);
    }
    var targetAttr = item.target ? ' target="' + item.target + '"' : '';
    var idAttr = item.id ? ' id="' + item.id + '"' : '';
    menuHTML += '<a href="' + href + '" class="menu-item"' + idAttr + targetAttr + '>' + item.label + '</a>\n';
  });

  // Versteckten "Tarn"-Link hinzufügen
  var tarnId = tarnItemConfig.id || 'menuTarnItem';
  var tarnLabel = tarnItemConfig.label || 'erstellt von comunioFanApp';
  menuHTML += '<div class="menu-item menu-tarn" id="' + tarnId + '" style="font-size:0.95em; color:#888; cursor:pointer;">\n    ' + tarnLabel + '</div>';

  hamburgerDropdown.innerHTML = menuHTML;

  // Event-Listener für aktive Seite und Tarn-Link müssen nach dem DOM-Inject gesetzt werden
  var menuTarnItem = document.getElementById(tarnId);

  // ---- Aktive Seite markieren ----
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  menuItems.forEach(function (item) {
    if (item.activePage && item.activePage === currentPage) {
      var link = document.getElementById(item.id);
      if (link) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    }
  });

  // ---- Versteckter "Tarn"-Link: nach X Klicks springt er zur Ziele-URL ----
  var tarnClick = 0;
  var tarnTimeout = null;
  if (menuTarnItem) {
    var tarnHref = getLokalOderGitURL(tarnItemConfig.href, tarnItemConfig.localPath);
    var tarnClicks = tarnItemConfig.clicksToActivate || 5;
    var tarnTimeoutMs = tarnItemConfig.timeoutMs || 3000;

    menuTarnItem.addEventListener('click', function (e) {
      tarnClick++;
      if (tarnTimeout) clearTimeout(tarnTimeout);
      tarnTimeout = setTimeout(function () { tarnClick = 0; }, tarnTimeoutMs);

      if (tarnClick === tarnClicks) {
        window.location.href = tarnHref;
      }
    });
  }

  // Dropdown schließen, wenn außerhalb geklickt wird
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.hamburger-menu')) {
      hamburgerButton.classList.remove('active');
      hamburgerDropdown.classList.remove('show');
    }
  });

  // Dropdown auch per Escape schließen
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hamburgerButton.classList.remove('active');
      hamburgerDropdown.classList.remove('show');
    }
  });  // ← schließt addEventListener(keydown)

});

