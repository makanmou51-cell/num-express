// Service worker de num express.
//
// Deux rôles :
//   1. rendre le site INSTALLABLE (PWA) sur Android/iOS ;
//   2. recevoir et afficher les NOTIFICATIONS PUSH, même quand le site est
//      fermé — c'est là tout l'intérêt : le client saisit son numéro dans
//      WhatsApp, quitte le navigateur, et son téléphone sonne quand le code
//      arrive.
//
// Pas de cache agressif : le solde, les codes et les stocks doivent rester
// frais, on laisse donc passer les requêtes réseau.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Un gestionnaire fetch (même passe-plat) est requis pour l'installabilité.
self.addEventListener("fetch", () => {
  // Passe-plat : le navigateur gère la requête normalement.
});

/* ───────────────────────────── Notifications ───────────────────────────── */

self.addEventListener("push", (event) => {
  // Le corps est censé être du JSON envoyé par notre serveur. On se protège
  // quand même : un push malformé ne doit pas empêcher l'affichage.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "num express", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "num express";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/192",
    badge: "/icons/192",
    // `tag` regroupe : une nouvelle notification du même type remplace la
    // précédente au lieu d'empiler dix lignes dans le volet.
    tag: data.tag || "num-express",
    renotify: Boolean(data.renotify),
    // L'URL à ouvrir au clic, transmise au gestionnaire ci-dessous.
    data: { url: data.url || "/" },
    // Vibration courte : c'est une confirmation, pas une alarme.
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Si un onglet du site est déjà ouvert, on le réutilise et on le met au
  // premier plan plutôt que d'ouvrir un doublon.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});

// Le navigateur peut faire tourner les clés d'un abonnement. Sans ce
// gestionnaire, l'abonnement devient silencieusement mort.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        }),
      )
      .catch(() => {
        /* on réessaiera à la prochaine visite */
      }),
  );
});
