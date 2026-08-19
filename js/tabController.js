function initTabs(containerSelector) {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector || document;
    if (!container) return;

    addDebug('Initialisiere Tabs', 'info');
    const tabScope = container.parentElement || document;
    const tabButtons = container.querySelectorAll('.tab-button');
    const tabContents = tabScope.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            const tabContent = tabScope.querySelector(`#${tabId}`) || document.getElementById(tabId);
            if (tabContent) tabContent.classList.add('active');
            addDebug(`Tab gewechselt zu: ${tabId}`, 'info');
        });
    });

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));
    const defaultTabBtn = container.querySelector('.tab-button[data-tab="market"]')
        || container.querySelector('.tab-button.active')
        || container.querySelector('.tab-button');

    if (defaultTabBtn) {
        defaultTabBtn.classList.add('active');
        const defaultTabId = defaultTabBtn.getAttribute('data-tab');
        const defaultContent = tabScope.querySelector(`#${defaultTabId}`)
            || document.getElementById(defaultTabId);
        if (defaultContent) defaultContent.classList.add('active');
    }

    addDebug('Tabs initialisiert', 'success');
}
