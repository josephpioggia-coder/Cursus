/**
 * CURSUS — Ruban de CursEdit (28/10/2026), voir src/lib/rubanCatalogue.js.
 * Onglets Accueil · Insertion · Mise en page · Références · Révision · Affichage · Aide.
 * Accueil = mise en forme + « Mes fonctions » (épinglées) ; chaque fonction reste aussi dans son onglet d'origine.
 * Une fonction « à venir » est visible, grisée, avec son niveau d'intérêt, et l'annonce au clic.
 * Épinglage mémorisé sur cet appareil (localStorage). `actions[id]` = { onClick, actif, desactive, libelle, icone }.
 */
import { useState, useEffect } from "react";
import { ONGLETS, FONCTIONS, EPINGLEES_PAR_DEFAUT, LIBELLE_PRIORITE, nettoyerEpinglees } from "../lib/rubanCatalogue.js";

const CLE_EPINGLEES = "cursus-ruban-epinglees-v1";
const CLE_ONGLET = "cursus-ruban-onglet";
const CLE_REDUIT = "cursus-ruban-reduit";
const COULEUR_PRIORITE = { fort: "#D85A30", moyen: "#BA7517", faible: "#999" };

const lire = (cle, defaut) => { try { const v = localStorage.getItem(cle); return v == null ? defaut : v; } catch { return defaut; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, v); } catch { /* sans stockage */ } };

function Bouton({ f, action, couleur, epingle, onBasculerEpingle, onAnnonce, peutEpingler, dansAccueil }) {
  const pret = f.statut === "fait" && action;
  const actif = !!action?.actif;
  const desactive = pret && action.desactive;
  const clic = () => {
    if (!pret) { onAnnonce(`« ${f.label} » arrive bientôt${f.priorite ? ` (${LIBELLE_PRIORITE[f.priorite]})` : ""} — ${f.aide}.`); return; }
    if (!desactive) { const r = action.onClick?.(); if (typeof r === "string") onAnnonce(r); }
  };
  return (
    <div className="ruban-btn" style={{ position: "relative" }}>
      <button type="button" onClick={clic} aria-pressed={actif || undefined}
        title={pret ? f.aide : `À venir${f.priorite ? ` — ${LIBELLE_PRIORITE[f.priorite]}` : ""} : ${f.aide}`}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 78, minHeight: 56, padding: "5px 4px",
          border: "0.5px solid transparent", borderRadius: 6, cursor: pret && !desactive ? "pointer" : "default", fontFamily: "inherit",
          background: actif ? `${couleur}18` : "transparent", color: pret ? (actif ? couleur : "#333") : "#9a9aa6",
          opacity: pret ? (desactive ? 0.6 : 1) : 0.75,
        }}>
        <span style={{ fontSize: 20, lineHeight: "22px" }}>{action?.icone || f.icone}</span>
        <span style={{ fontSize: 10.5, lineHeight: 1.15, textAlign: "center" }}>{action?.libelle || f.label}</span>
      </button>
      {!pret && f.priorite && (
        <span aria-hidden title={LIBELLE_PRIORITE[f.priorite]} style={{ position: "absolute", top: 3, left: 5, width: 7, height: 7, borderRadius: "50%", background: COULEUR_PRIORITE[f.priorite] }} />
      )}
      {peutEpingler && (
        <button type="button" className="ruban-epingle" onClick={onBasculerEpingle}
          title={epingle ? "Retirer de l'Accueil" : "Épingler dans l'Accueil"} aria-pressed={epingle}
          style={{ position: "absolute", top: 1, right: 2, width: 16, height: 16, padding: 0, fontSize: 10, lineHeight: "16px", border: "none", borderRadius: 8, cursor: "pointer",
            background: epingle ? couleur : "#fff", color: epingle ? "#fff" : "#777", opacity: epingle && !dansAccueil ? 1 : 0, boxShadow: "0 0 0 0.5px #ccc" }}>📌</button>
      )}
    </div>
  );
}

export default function RubanEditeur({ couleur = "#7F77DD", actions, controles = {}, accueil = null, lectureSeule = false }) {
  const [onglet, setOnglet] = useState(() => { const v = lire(CLE_ONGLET, "accueil"); return ONGLETS.some((o) => o.id === v) ? v : "accueil"; });
  const [reduit, setReduit] = useState(() => lire(CLE_REDUIT, "0") === "1");
  const [epinglees, setEpinglees] = useState(() => {
    try { const b = JSON.parse(lire(CLE_EPINGLEES, "null")); return b ? nettoyerEpinglees(b) : EPINGLEES_PAR_DEFAUT; } catch { return EPINGLEES_PAR_DEFAUT; }
  });
  const [annonce, setAnnonce] = useState(null);
  useEffect(() => { if (!annonce) return undefined; const t = setTimeout(() => setAnnonce(null), 5000); return () => clearTimeout(t); }, [annonce]);

  const choisir = (id) => { setOnglet(id); ecrire(CLE_ONGLET, id); if (reduit) { setReduit(false); ecrire(CLE_REDUIT, "0"); } };
  const basculerReduit = () => setReduit((r) => { ecrire(CLE_REDUIT, r ? "0" : "1"); return !r; });
  const basculerEpingle = (id) => setEpinglees((liste) => {
    const suite = liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
    ecrire(CLE_EPINGLEES, JSON.stringify(suite));
    return suite;
  });
  // Réorganiser « Mes fonctions » : flèches ◀ ▶ au survol, ou glisser-déposer un bouton sur un autre.
  const deplacerEpingle = (id, delta) => setEpinglees((liste) => {
    const i = liste.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= liste.length) return liste;
    const suite = [...liste]; [suite[i], suite[j]] = [suite[j], suite[i]];
    ecrire(CLE_EPINGLEES, JSON.stringify(suite));
    return suite;
  });
  const deposerEpingle = (idSource, idCible) => setEpinglees((liste) => {
    if (idSource === idCible || !liste.includes(idSource) || !liste.includes(idCible)) return liste;
    const sans = liste.filter((x) => x !== idSource);
    sans.splice(sans.indexOf(idCible) + (liste.indexOf(idSource) < liste.indexOf(idCible) ? 1 : 0), 0, idSource);
    ecrire(CLE_EPINGLEES, JSON.stringify(sans));
    return sans;
  });
  const retablir = () => { setEpinglees(EPINGLEES_PAR_DEFAUT); ecrire(CLE_EPINGLEES, JSON.stringify(EPINGLEES_PAR_DEFAUT)); };

  const rendu = (f, { peutEpingler, dansAccueil = false }) => {
    const ctrl = f.ctrl && controles[f.ctrl];
    if (ctrl) return <div key={f.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 6px", minHeight: 56 }}>{ctrl}</div>;
    return <Bouton key={f.id} f={f} action={actions[f.id]} couleur={couleur} epingle={epinglees.includes(f.id)}
      onBasculerEpingle={() => basculerEpingle(f.id)} onAnnonce={setAnnonce} dansAccueil={dansAccueil} peutEpingler={peutEpingler && !!(actions[f.id] || f.statut === "bientot")} />;
  };

  const groupes = (id) => {
    const liste = FONCTIONS.filter((f) => f.onglet === id);
    const parGroupe = new Map();
    liste.forEach((f) => { if (!parGroupe.has(f.groupe)) parGroupe.set(f.groupe, []); parGroupe.get(f.groupe).push(f); });
    return [...parGroupe.entries()];
  };
  const Groupe = ({ titre, children }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: "2px 8px", borderRight: "0.5px solid #e2e2e8", minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, flex: 1, alignItems: "flex-start" }}>{children}</div>
      <div style={{ fontSize: 9.5, color: "#999", textAlign: "center", paddingTop: 2 }}>{titre}</div>
    </div>
  );

  const epingleesVisibles = epinglees.map((id) => FONCTIONS.find((f) => f.id === id)).filter(Boolean);

  return (
    <div style={{ flexShrink: 0, borderBottom: "0.5px solid #e5e5e5", background: "#fafafa" }}>
      <style>{`.ruban-btn:hover .ruban-epingle{opacity:1 !important}.ruban-btn:hover > button:first-child{background:#f0eff6}.ruban-deplace:hover .ruban-fleches,.ruban-deplace:focus-within .ruban-fleches{opacity:1 !important}.ruban-deplace[draggable=true]{cursor:grab}`}</style>
      <div role="tablist" style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 12px", borderBottom: reduit ? "none" : "0.5px solid #e5e5e5" }}>
        {ONGLETS.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id && !reduit} onClick={() => choisir(o.id)}
            style={{ fontSize: 12.5, padding: "7px 12px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
              color: onglet === o.id && !reduit ? couleur : "#555", fontWeight: onglet === o.id && !reduit ? 600 : 400,
              borderBottom: onglet === o.id && !reduit ? `2px solid ${couleur}` : "2px solid transparent" }}>{o.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {annonce && <span role="status" style={{ fontSize: 11.5, color: "#7a5a00", background: "#FFF6DA", borderRadius: 6, padding: "3px 8px", marginRight: 8, maxWidth: 520 }}>{annonce}</span>}
        <button onClick={basculerReduit} title={reduit ? "Afficher le ruban" : "Réduire le ruban"} aria-label={reduit ? "Afficher le ruban" : "Réduire le ruban"}
          style={{ border: "none", background: "none", cursor: "pointer", color: "#888", fontSize: 12, padding: "4px 6px" }}>{reduit ? "▾" : "▴"}</button>
      </div>

      {!reduit && (
        <div style={{ maxHeight: "38vh", overflowY: "auto" }}>
          {/* Accueil : toujours monté (la barre de mise en forme écoute des événements), masqué hors de l'onglet */}
          <div style={{ display: onglet === "accueil" ? "block" : "none" }}>
            {accueil}
            <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap", padding: "2px 4px 2px", borderTop: accueil ? "0.5px solid #eee" : "none" }}>
              {groupes("accueil").map(([titre, liste]) => <Groupe key={titre} titre={titre}>{liste.map((f) => rendu(f, { peutEpingler: false }))}</Groupe>)}
              <Groupe titre="Mes fonctions">
                {epingleesVisibles.map((f, i) => (
                  <div key={f.id} className="ruban-deplace" style={{ position: "relative" }} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", f.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); deposerEpingle(e.dataTransfer.getData("text/plain"), f.id); }}>
                    {rendu(f, { peutEpingler: true, dansAccueil: true })}
                    <span className="ruban-fleches" style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", opacity: 0, pointerEvents: "none" }}>
                      <button type="button" aria-label={`Déplacer « ${f.label} » vers la gauche`} title="Déplacer à gauche" disabled={i === 0} onClick={() => deplacerEpingle(f.id, -1)}
                        style={{ pointerEvents: "auto", width: 16, height: 16, padding: 0, fontSize: 9, border: "none", borderRadius: 8, background: "#fff", boxShadow: "0 0 0 0.5px #ccc", cursor: "pointer", color: "#555" }}>◀</button>
                      <button type="button" aria-label={`Déplacer « ${f.label} » vers la droite`} title="Déplacer à droite" disabled={i === epingleesVisibles.length - 1} onClick={() => deplacerEpingle(f.id, 1)}
                        style={{ pointerEvents: "auto", width: 16, height: 16, padding: 0, fontSize: 9, border: "none", borderRadius: 8, background: "#fff", boxShadow: "0 0 0 0.5px #ccc", cursor: "pointer", color: "#555" }}>▶</button>
                    </span>
                  </div>
                ))}
                {epingleesVisibles.length === 0 && <span style={{ fontSize: 11, color: "#999", padding: 8 }}>Épinglez ici (📌) les fonctions des autres onglets.</span>}
              </Groupe>
              <div style={{ display: "flex", alignItems: "flex-end", padding: "0 8px 4px" }}>
                <button onClick={retablir} style={{ fontSize: 10.5, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Rétablir l'Accueil</button>
              </div>
            </div>
          </div>
          {onglet !== "accueil" && (
            <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap", padding: "2px 4px" }}>
              {groupes(onglet).map(([titre, liste]) => <Groupe key={titre} titre={titre}>{liste.map((f) => rendu(f, { peutEpingler: true }))}</Groupe>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
