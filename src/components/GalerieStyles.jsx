/**
 * CURSUS — « 🎨 Styles » : galerie de styles modifiables du projet (28/10/2026)
 * Demande de Joseph : régler une fois la police, la taille, l'interligne… de « Normal », « Titre 1 »,
 * « Citation » (et des titres de partie / chapitre / scène à l'export Word) pour tout le livre, comme les
 * Styles de Word. Voir src/lib/stylesProjet.js : seules les propriétés MODIFIÉES sont enregistrées ; tant
 * que rien n'est modifié, rien ne change. Enregistrement en base, par projet.
 */
import { useMemo, useState } from "react";
import { POLICES } from "../lib/miseEnFormeEditeur.js";
import { stylesProjetAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { ALIGNEMENTS, STYLES_PROJET, nettoyerStyles, valeurStyle } from "../lib/stylesProjet.js";

const EXEMPLES = {
  normal: "Les premières lignes d'un chapitre donnent le ton : la phrase suit son cours, le regard du lecteur aussi. Un second paragraphe montre l'espacement et l'alinéa.",
  quote: "« Nul n'a expliqué ce que le léopard allait chercher à cette altitude. »",
};

const champ = { display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, color: "#666", minWidth: 0 };
const entrée = { fontSize: 13, padding: "5px 7px", border: "0.5px solid #ccc", borderRadius: 6, fontFamily: "inherit", width: "100%", boxSizing: "border-box", background: "#fff", color: "#222" };

export default function GalerieStyles({ projetId, styles, couleur = "#7F77DD", lectureSeule = false, onEnregistre, onFermer }) {
  const départ = useMemo(() => nettoyerStyles(styles), [styles]);
  const [brouillon, setBrouillon] = useState(départ);
  const [choix, setChoix] = useState("normal");
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const def = STYLES_PROJET.find((s) => s.id === choix);
  const val = (c) => valeurStyle(brouillon, choix, c);
  const modifié = JSON.stringify(nettoyerStyles(brouillon)) !== JSON.stringify(départ);

  const changer = (c, v) => {
    setMessage(null);
    setBrouillon((b) => nettoyerStyles({ ...b, [choix]: { ...(b[choix] || {}), [c]: v } }));
  };
  const rétablirCeStyle = () => { setMessage(null); setBrouillon((b) => { const n = { ...b }; delete n[choix]; return n; }); };
  const toutRétablir = () => { setMessage(null); setBrouillon({}); };

  const enregistrer = async () => {
    if (!projetId) return;
    setEnCours(true); setMessage(null);
    const propre = nettoyerStyles(brouillon);
    const { error } = await stylesProjetAPI.enregistrer(projetId, propre);
    setEnCours(false);
    if (error) {
      console.error("[styles_projet] échec de l'enregistrement :", error);
      journaliserErreur("GalerieStyles:enregistrer", `${error.message} (code ${error.code || "?"})`, projetId);
      setMessage({ ok: false, texte: `Rien n'a été enregistré (${error.message}).` });
      return;
    }
    onEnregistre?.(propre);
    setMessage({ ok: true, texte: "Styles enregistrés pour ce projet : ils s'appliquent dans l'éditeur et à l'export Word." });
  };

  // Aperçu : valeurs effectives (modifiées ou par défaut) en CSS en ligne.
  const css = {
    fontFamily: val("police"), fontSize: `${val("taille")}pt`, color: val("couleur"),
    fontWeight: val("gras") ? 700 : 400, fontStyle: val("italique") ? "italic" : "normal",
    lineHeight: val("interligne"), textAlign: val("alignement"),
    marginTop: 0, marginBottom: 0,
    textIndent: choix === "normal" ? `${val("alinea")}cm` : undefined,
  };
  const exemple = EXEMPLES[choix] || (def?.export ? `${def.label} — exemple` : "Titre d'exemple");

  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 820, maxHeight: "94vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>🎨 Styles du projet</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 12px", lineHeight: 1.55 }}>
            Réglez <b>une fois</b> l'aspect de chaque style : il s'applique à tout le livre, dans l'éditeur et dans le fichier Word. Ce que vous ne modifiez pas reste inchangé.
            Une mise en forme posée directement sur un passage (police, taille, interligne) l'emporte sur le style, comme dans Word.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {STYLES_PROJET.map((s) => {
              const actif = s.id === choix;
              const touché = !!brouillon[s.id];
              return (
                <button key={s.id} onClick={() => { setChoix(s.id); setMessage(null); }}
                  style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
                    border: `0.5px solid ${actif ? couleur : "#ccc"}`, background: actif ? `${couleur}18` : "#fff", color: actif ? couleur : "#555", fontWeight: actif ? 600 : 400 }}>
                  {s.label}{touché ? " ●" : ""}{s.export ? " ·W" : ""}
                </button>
              );
            })}
          </div>
          {def?.aide && <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>{def.aide} {def.export && "(·W = effet à l'export Word seulement)"}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
            <label style={{ ...champ, gridColumn: "span 2" }}>Police
              <select value={val("police")} onChange={(e) => changer("police", e.target.value)} style={entrée} disabled={lectureSeule}>
                {POLICES.map((p) => <option key={p.nom} value={p.valeur} style={{ fontFamily: p.valeur }}>{p.nom}</option>)}
              </select>
            </label>
            <label style={champ}>Taille (pt)
              <input type="number" min={6} max={96} step={0.5} value={val("taille")} onChange={(e) => changer("taille", e.target.value)} style={entrée} disabled={lectureSeule} />
            </label>
            <label style={champ}>Couleur
              <input type="color" value={val("couleur")} onChange={(e) => changer("couleur", e.target.value)} style={{ ...entrée, padding: 2, height: 32 }} disabled={lectureSeule} />
            </label>
            <label style={champ}>Interligne
              <input type="number" min={0.8} max={4} step={0.05} value={val("interligne")} onChange={(e) => changer("interligne", e.target.value)} style={entrée} disabled={lectureSeule} />
            </label>
            <label style={champ}>Espace avant (pt)
              <input type="number" min={0} max={120} step={1} value={val("avant")} onChange={(e) => changer("avant", e.target.value)} style={entrée} disabled={lectureSeule} />
            </label>
            <label style={champ}>Espace après (pt)
              <input type="number" min={0} max={120} step={1} value={val("apres")} onChange={(e) => changer("apres", e.target.value)} style={entrée} disabled={lectureSeule} />
            </label>
            {(choix === "normal") && (
              <label style={champ}>Alinéa (cm)
                <input type="number" min={0} max={5} step={0.1} value={val("alinea")} onChange={(e) => changer("alinea", e.target.value)} style={entrée} disabled={lectureSeule} />
              </label>
            )}
            <label style={champ}>Alignement
              <select value={val("alignement")} onChange={(e) => changer("alignement", e.target.value)} style={entrée} disabled={lectureSeule}>
                {ALIGNEMENTS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </label>
            <div style={{ ...champ, justifyContent: "flex-end", flexDirection: "row", alignItems: "center", gap: 12, fontSize: 13, color: "#444" }}>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!val("gras")} onChange={(e) => changer("gras", e.target.checked)} disabled={lectureSeule} /> <b>Gras</b></label>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!val("italique")} onChange={(e) => changer("italique", e.target.checked)} disabled={lectureSeule} /> <i>Italique</i></label>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: "#999", marginBottom: 4 }}>Aperçu</div>
          <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "16px 20px", background: "#fff", overflow: "hidden" }}>
            <div style={{ ...css, paddingTop: `${val("avant")}pt`, paddingBottom: `${val("apres")}pt` }}>{exemple}</div>
            {choix === "normal" && <div style={{ ...css, paddingTop: `${val("avant")}pt` }}>Second paragraphe du même style.</div>}
          </div>

          {message && (
            <div style={{ marginTop: 12, fontSize: 12.5, padding: "8px 10px", borderRadius: 6, color: message.ok ? "#0F6E56" : "#A32D2D", background: message.ok ? "#E1F5EE" : "#FBE9E9" }}>
              {message.ok ? "✓ " : "⚠ "}{message.texte}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "#999", marginTop: 12, lineHeight: 1.5 }}>
            Limites : les polices s'affichent selon ce qui est installé sur l'appareil. Dans le fichier Word, « Titre 1/2/3 » du texte deviennent les styles Titre 4/5/6 de Word ; Titre 4 à 6 et Citation sont appliqués aux paragraphes eux-mêmes.
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button style={bouton(false)} onClick={rétablirCeStyle} disabled={!brouillon[choix] || lectureSeule}>Rétablir ce style</button>
          <button style={bouton(false)} onClick={toutRétablir} disabled={!Object.keys(brouillon).length || lectureSeule}>Tout rétablir</button>
          <button style={bouton(false)} onClick={onFermer}>Fermer</button>
          <button style={{ ...bouton(true), opacity: modifié && !enCours && !lectureSeule ? 1 : 0.5 }} onClick={enregistrer} disabled={!modifié || enCours || lectureSeule}>
            {enCours ? "…" : "Enregistrer pour ce projet"}
          </button>
        </div>
      </div>
    </div>
  );
}
