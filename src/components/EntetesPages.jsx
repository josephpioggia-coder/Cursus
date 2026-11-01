/**
 * CURSUS — « 🔢 En-têtes et numéros de page » (31/10/2026) : réglages par projet, appliqués à l'export Word.
 * Voir src/lib/entetesPages.js. Enregistré dans la ligne `styles_projet` du projet (clé `entetes`), comme la galerie Styles.
 */
import { useMemo, useState } from "react";
import { stylesProjetAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { nettoyerStyles } from "../lib/stylesProjet.js";
import { FORMATS_NUMERO, POSITIONS_NUMERO, VARIABLES, ZONES, composerZones, nettoyerEntetes } from "../lib/entetesPages.js";

const champ = { display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, color: "#666", minWidth: 0 };
const entrée = { fontSize: 13, padding: "5px 7px", border: "0.5px solid #ccc", borderRadius: 6, fontFamily: "inherit", width: "100%", boxSizing: "border-box", background: "#fff", color: "#222" };
const ZONE_LIBELLE = { gauche: "À gauche", centre: "Au centre", droite: "À droite" };

function texteApercu(morceaux, titre) {
  return morceaux.map((m) => (m.t !== undefined ? m.t : m.v === "titre" ? titre : m.v === "page" ? "12" : "240")).join("");
}

export default function EntetesPages({ projetId, titre, styles, couleur = "#7F77DD", lectureSeule = false, onEnregistre, onFermer }) {
  const départ = useMemo(() => nettoyerEntetes(styles?.entetes), [styles]);
  const [brouillon, setBrouillon] = useState(départ);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const propre = nettoyerEntetes(brouillon);
  const modifié = JSON.stringify(propre) !== JSON.stringify(départ);
  const maj = (f) => { setMessage(null); setBrouillon((b) => f({ ...b, entete: { ...(b.entete || {}) }, pied: { ...(b.pied || {}) } })); };
  const compo = composerZones(propre);

  const enregistrer = async () => {
    if (!projetId) return;
    setEnCours(true); setMessage(null);
    const suivant = { ...(styles || {}) };
    delete suivant.entetes;
    if (Object.keys(propre).length) suivant.entetes = propre;
    const final = nettoyerStyles(suivant);
    const { error } = await stylesProjetAPI.enregistrer(projetId, final);
    setEnCours(false);
    if (error) {
      journaliserErreur("EntetesPages:enregistrer", `${error.message} (code ${error.code || "?"})`, projetId);
      setMessage({ ok: false, texte: `Rien n'a été enregistré (${error.message}).` });
      return;
    }
    onEnregistre?.(final);
    setMessage({ ok: true, texte: "Enregistré pour ce projet : ces réglages s'appliquent à l'export Word." });
  };

  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });
  const ligne = (zones, actif) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: actif ? "#555" : "#bbb", padding: "4px 8px", borderBottom: "0.5px dashed #ddd", minHeight: 18 }}>
      {ZONES.map((z) => <span key={z} style={{ flex: 1, textAlign: z === "gauche" ? "left" : z === "centre" ? "center" : "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{texteApercu(zones[z], titre || "Titre du livre")}</span>)}
    </div>
  );

  return (
    <div role="dialog" aria-label="En-têtes et numéros de page" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", color: "#222", borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "94vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>🔢 En-têtes et numéros de page</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer" aria-label="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 12px", lineHeight: 1.55 }}>
            Réglages <b>à l'export Word</b> (l'éditeur n'a pas de pagination). La page de titre et le sommaire n'ont ni en-tête ni numéro ; le livre commence à la page 1.
            Tant que rien n'est réglé, l'export reste inchangé.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
            <label style={champ}>Numéro de page
              <select value={brouillon.position || "aucun"} onChange={(e) => maj((b) => ({ ...b, position: e.target.value }))} style={entrée} disabled={lectureSeule}>
                {POSITIONS_NUMERO.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </label>
            <label style={champ}>Présentation
              <select value={brouillon.format || "n"} onChange={(e) => maj((b) => ({ ...b, format: e.target.value }))} style={entrée} disabled={lectureSeule || (brouillon.position || "aucun") === "aucun"}>
                {FORMATS_NUMERO.map((f) => <option key={f.v} value={f.v}>{f.label}  (ex. {f.exemple})</option>)}
              </select>
            </label>
          </div>

          {[["entete", "En-tête (haut de page)"], ["pied", "Pied de page (bas de page)"]].map(([bloc, titreBloc]) => (
            <div key={bloc} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>{titreBloc}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {ZONES.map((z) => (
                  <label key={z} style={champ}>{ZONE_LIBELLE[z]}
                    <input type="text" maxLength={120} value={brouillon[bloc]?.[z] || ""} placeholder={bloc === "entete" && z === "centre" ? "ex. {titre}" : ""} disabled={lectureSeule}
                      onChange={(e) => maj((b) => ({ ...b, [bloc]: { ...b[bloc], [z]: e.target.value } }))} style={entrée} />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <p style={{ fontSize: 11.5, color: "#777", margin: "0 0 12px", lineHeight: 1.5 }}>
            Dans un texte, vous pouvez écrire : {VARIABLES.map((v, i) => <span key={v.v}>{i ? " · " : ""}<code>{v.v}</code> ({v.aide})</span>)}.
          </p>

          <div style={{ fontSize: 11.5, color: "#666", marginBottom: 4 }}>Aperçu d'une page du livre</div>
          <div style={{ border: "0.5px solid #ddd", borderRadius: 6, background: "#fafafa" }}>
            {ligne(compo.zones.entete, compo.entete)}
            <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 11 }}>texte de la page</div>
            {ligne(compo.zones.pied, compo.pied)}
          </div>
          {message && <div role="status" style={{ marginTop: 10, fontSize: 12.5, color: message.ok ? "#1D6F4F" : "#b3261e" }}>{message.texte}</div>}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button style={bouton(false)} onClick={() => { setMessage(null); setBrouillon({}); }} disabled={!Object.keys(brouillon).length || lectureSeule}>Tout retirer</button>
          <button style={bouton(false)} onClick={onFermer}>Fermer</button>
          <button style={{ ...bouton(true), opacity: modifié && !enCours && !lectureSeule ? 1 : 0.5 }} onClick={enregistrer} disabled={!modifié || enCours || lectureSeule}>
            {enCours ? "…" : "Enregistrer pour ce projet"}
          </button>
        </div>
      </div>
    </div>
  );
}
