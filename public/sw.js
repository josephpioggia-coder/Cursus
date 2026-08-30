// Service worker minimal — condition technique pour que Cursus soit
// reconnu comme PWA installable (critère requis pour l'emballage TWA /
// Google Play). Pas de cache applicatif volontairement : Cursus dépend de
// données Supabase toujours à jour (audits, éditeur, mémoire narrative) —
// mettre en cache risquerait de servir du contenu périmé. Cette base
// pourra évoluer vers un vrai mode hors-ligne plus tard si besoin réel.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (événement) => {
  événement.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Laisse passer toutes les requêtes au réseau normalement.
});
