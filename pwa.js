(() => {
  'use strict';
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  let deferredPrompt = null, installed = false, prompting = false;
  let registration = null, offline = 'preparing', installMessage = '';
  let openDialog, notify;
  const isInstalled = () => installed || standalone.matches || navigator.standalone === true;

  function statusText() {
    if (offline === 'ready') return 'Prêt hors connexion : fiches, recherche, favoris et collections.';
    if (offline === 'unsupported') return 'Le mode hors connexion n’est pas disponible dans ce navigateur. Ouvrez le site dans Safari ou Chrome.';
    if (offline === 'failed') return 'Le téléchargement hors connexion n’a pas abouti. Reconnectez-vous puis réessayez.';
    return 'Préparation de l’accès hors connexion… Gardez cette page ouverte quelques instants.';
  }

  function refresh() {
    document.querySelectorAll('[data-install-label]').forEach(el => { el.textContent = isInstalled() ? 'Kiné est installé' : 'Installer Kiné'; });
    const panel = document.querySelector('[data-install-panel]');
    if (!panel) return;
    panel.querySelector('[data-install-status]').textContent = statusText();
    panel.querySelector('[data-install-result]').textContent = installMessage;
    panel.querySelector('[data-installed-note]').hidden = !isInstalled();
    panel.querySelector('[data-install-help]').hidden = isInstalled();
    const button = panel.querySelector('[data-pwa-install]');
    button.hidden = !deferredPrompt || isInstalled();
    button.disabled = prompting;
    panel.querySelector('[data-pwa-retry]').hidden = offline !== 'failed';
    panel.querySelector('[data-pwa-update]').hidden = !registration?.waiting;
  }

  function instructions() {
    if (isIOS) return `<ol class="install-steps"><li>Ouvrez cette page dans <strong>Safari</strong>.</li><li>Touchez <strong>Partager</strong> (le carré avec une flèche vers le haut ; parfois dans le menu <strong>…</strong>).</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>. Si proposé, activez <strong>Ouvrir comme app web</strong>.</li></ol>`;
    if (isAndroid) return `<ol class="install-steps"><li>Touchez <strong>Installer Kiné</strong> si le bouton apparaît ci-dessus.</li><li>Sinon, ouvrez le menu <strong>⋮</strong> de Chrome, puis <strong>Ajouter à l’écran d’accueil</strong> ou <strong>Installer l’application</strong>.</li><li>Confirmez l’installation : l’icône <strong>Kiné</strong> apparaît sur votre téléphone.</li></ol>`;
    return `<p>Sur cet appareil, utilisez <strong>Installer Kiné</strong> si le bouton apparaît, ou l’option d’installation du navigateur.</p><details class="install-other"><summary>Comment faire sur mon téléphone ?</summary><p><strong>iPhone / iPad :</strong> ouvrez cette adresse dans Safari, puis Partager → Sur l’écran d’accueil → Ajouter.</p><p><strong>Android :</strong> ouvrez cette adresse dans Chrome, puis ⋮ → Ajouter à l’écran d’accueil ou Installer l’application.</p></details>`;
  }

  function open() {
    openDialog(`<div class="install-panel" data-install-panel>
      <div class="install-brand"><img src="assets/icon-192.png" alt="" width="64" height="64"><div><strong>Votre raccourci vers le mouvement</strong><p>Une icône sur l’écran d’accueil, une ouverture en plein écran.</p></div></div>
      <p class="install-success" data-installed-note hidden>Kiné est installé. Retrouvez votre bibliothèque depuis son icône sur l’écran d’accueil.</p>
      <div data-install-help><button type="button" class="button primary install-primary" data-pwa-install hidden>Installer Kiné</button>${instructions()}<p class="install-hint">Si l’option manque, ouvrez cette adresse directement dans Safari sur iPhone ou Chrome sur Android.</p></div>
      <p class="install-result" data-install-result role="status"></p>
      <div class="install-offline"><strong>À utiliser aussi sans réseau</strong><p data-install-status role="status"></p><button type="button" class="button" data-pwa-retry hidden>Réessayer le téléchargement</button><p class="install-hint">Les illustrations et photos importées restent disponibles. Les images et vidéos liées à un site externe nécessitent une connexion.</p></div>
      <p class="install-hint" data-pwa-update hidden>Une mise à jour est prête. Elle s’appliquera après fermeture de toutes les fenêtres de Kiné, à la prochaine ouverture.</p>
      <p class="install-hint">Vos données restent sur cet appareil. Si l’application installée ouvre une bibliothèque vierge, utilisez Sauvegarde & données pour exporter depuis le navigateur puis importer dans l’application.</p>
    </div>`);
    refresh();
  }

  async function promptInstall() {
    if (!deferredPrompt || prompting) return;
    const prompt = deferredPrompt;
    prompting = true;
    try {
      await prompt.prompt(); // Keep this directly in the user's click handler.
      const choice = await prompt.userChoice;
      installMessage = choice.outcome === 'accepted' ? 'Installation demandée. Validez les étapes affichées par votre téléphone.' : 'Installation annulée. Vous pouvez continuer à utiliser Kiné ici.';
    } catch {
      installMessage = 'L’installation n’a pas pu être lancée. Utilisez le menu de votre navigateur indiqué ci-dessus.';
    } finally {
      deferredPrompt = null;
      prompting = false;
      refresh();
    }
  }

  function watchRegistration(reg) {
    registration = reg;
    if (reg.active?.state === 'activated') offline = 'ready';
    const watchWorker = worker => {
      if (!worker) return;
      const update = () => {
        if (worker.state === 'activated') offline = 'ready';
        if (worker.state === 'redundant' && !reg.active) offline = 'failed';
        refresh();
      };
      worker.addEventListener('statechange', update);
      update();
    };
    watchWorker(reg.installing);
    reg.addEventListener('updatefound', () => watchWorker(reg.installing));
    refresh();
  }

  async function register() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      offline = 'unsupported'; refresh(); return;
    }
    offline = 'preparing'; refresh();
    try {
      const reg = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './', updateViaCache: 'none' });
      watchRegistration(reg);
      // Explicit retry also handles a previously failed precache installation.
      if (!reg.active && !reg.installing && !reg.waiting) await reg.update();
    } catch {
      offline = registration?.active ? 'ready' : 'failed'; refresh();
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event; installMessage = ''; refresh();
  });
  window.addEventListener('appinstalled', () => {
    installed = true; deferredPrompt = null; installMessage = '';
    refresh(); notify?.('Kiné a été installé sur votre appareil.');
  });
  standalone.addEventListener('change', refresh);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-pwa-install]')) promptInstall();
    if (event.target.closest('[data-pwa-retry]')) register();
  });
  window.addEventListener('online', () => {
    if (offline !== 'ready') register();
    else registration?.update().catch(() => {});
  });
  window.KinePWA = { open, init(callbacks) {
    ({ openDialog, notify } = callbacks);
    refresh(); register();
  } };
})();
