/**
 * CURSUS — « 📷 Lire une photo » (24/10/2026) — voir src/lib/lecturePhoto.js.
 * Photo(s) de page(s) → texte recopié FIDÈLEMENT (fautes comprises) → relu à côté de
 * la photo, modifiable → inséré dans le chapitre. La photo n'est pas conservée.
 */
import { useRef, useState } from "react";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { MAX_PHOTOS, preparerPhoto, lirePhoto, versNoeuds } from "../lib/lecturePhoto.js";

export default function LirePhoto({ editor, onUsage, couleur = "#7F77DD", onFermer }) {
  const [pages, setPages] = useState([]); // { id, photo, texte, incertains, erreur, tronque, etat }
  const [étape, setÉtape] = useState("choix"); // choix | encours | revue | fini
  const [progrès, setProgrès] = useState({ faits: 0, total: 0 });
  const [erreur, setErreur] = useState(null);
  const [position, setPosition] = useState("fin");
  const [agrandie, setAgrandie] = useState(null);
  const [inséré, setInséré] = useState(0);
  const contrôleur = useRef(null);
  const compteur = useRef(0);

  const ajouter = async (fichiers) => {
    setErreur(null);
    const liste = [...(fichiers || [])].slice(0, Math.max(0, MAX_PHOTOS - pages.length));
    if (fichiers?.length > liste.length) setErreur(`${MAX_PHOTOS} photos au maximum à la fois.`);
    const nouvelles = [];
    for (const f of liste) {
      try {
        const photo = await preparerPhoto(f);
        nouvelles.push({ id: ++compteur.current, photo, texte: "", incertains: 0, erreur: null, tronque: false, etat: "attente" });
      } catch (e) { setErreur(e.message || "Photo illisible."); }
    }
    setPages((p) => [...p, ...nouvelles]);
  };

  const lirePage = async (page, signal) => {
    try {
      const r = await lirePhoto(page.photo, signal);
      return { ...page, texte: r.paragraphes.join("\n\n"), incertains: r.incertains, tronque: r.tronque, erreur: r.vide ? "Aucun texte lisible sur cette photo." : null, etat: "lu" };
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      journaliserErreur("LirePhoto", e.message);
      return { ...page, erreur: e.message || "Lecture impossible.", etat: "erreur" };
    }
  };

  const lancer = async () => {
    if (!pages.length) { setErreur("Ajoutez au moins une photo."); return; }
    onUsage?.("lance", pages.length);
    setErreur(null);
    setÉtape("encours");
    contrôleur.current = new AbortController();
    const résultat = [...pages];
    try {
      for (let i = 0; i < résultat.length; i++) {
        setProgrès({ faits: i, total: résultat.length });
        résultat[i] = await lirePage(résultat[i], contrôleur.current.signal);
        setPages([...résultat]);
      }
      setProgrès({ faits: résultat.length, total: résultat.length });
      setÉtape("revue");
    } catch (e) {
      if (e?.name === "AbortError") { setÉtape("choix"); return; }
      setErreur(e.message);
      setÉtape("choix");
    }
  };

  const relire = async (id) => {
    const p = pages.find((x) => x.id === id);
    if (!p) return;
    setPages((ps) => ps.map((x) => (x.id === id ? { ...x, etat: "attente", erreur: null } : x)));
    contrôleur.current = new AbortController();
    try {
      const n = await lirePage(p, contrôleur.current.signal);
      setPages((ps) => ps.map((x) => (x.id === id ? n : x)));
    } catch { /* annulé */ }
  };

  const modifierTexte = (id, texte) => setPages((ps) => ps.map((x) => (x.id === id ? { ...x, texte, incertains: (texte.match(/\[\?\]|\[passage illisible\]/gi) || []).length } : x)));
  const retirer = (id) => setPages((ps) => ps.filter((x) => x.id !== id));

  const insérer = () => {
    const nœuds = pages.flatMap((p) => versNoeuds(p.texte));
    if (!nœuds.length) { setErreur("Il n'y a aucun texte à insérer."); return; }
    const vide = !editor.state.doc.textContent.trim();
    if (vide) editor.commands.setContent(nœuds);
    else if (position === "curseur") editor.chain().focus().insertContent(nœuds).run();
    else editor.commands.insertContentAt(editor.state.doc.content.size, nœuds);
    onUsage?.("applique", pages.filter((p) => p.texte.trim()).length);
    setInséré(nœuds.length);
    setÉtape("fini");
  };

  const incertainsTotal = pages.reduce((a, p) => a + p.incertains, 0);
  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>📷 Lire une page à partir d'une photo</span>
          <button onClick={() => { contrôleur.current?.abort(); onFermer(); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {étape === "choix" && (
            <>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.55 }}>
                Photographiez une ou plusieurs pages (jusqu'à {MAX_PHOTOS}) : l'IA les <b>recopie telles quelles, fautes comprises</b>, et le texte arrive dans
                votre chapitre. Vous pourrez alors lui appliquer le Nettoyage mécanique, « Vérifier le fond », etc.
              </p>
              <p style={{ fontSize: 12, color: "#8a6d00", background: "#FFF8E6", borderRadius: 6, padding: "8px 10px", margin: "0 0 12px", lineHeight: 1.5 }}>
                Pour un bon résultat : page bien à plat, bien éclairée, texte net et droit, sans doigt sur le texte. La photo est envoyée à l'IA le temps de la
                lecture puis oubliée : Cursus ne la conserve pas. Si ce n'est pas votre texte, assurez-vous de l'accord de son auteur.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <label style={{ ...bouton(true), display: "inline-block" }}>
                  📷 Prendre une photo
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { ajouter(e.target.files); e.target.value = ""; }} />
                </label>
                <label style={{ ...bouton(false), display: "inline-block" }}>
                  🖼 Choisir des images
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { ajouter(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
              {pages.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {pages.map((p, i) => (
                    <div key={p.id} style={{ position: "relative", width: 96 }}>
                      <img src={p.photo.apercu} alt={`Page ${i + 1}`} style={{ width: 96, height: 128, objectFit: "cover", borderRadius: 6, border: "0.5px solid #ddd" }} />
                      <button onClick={() => retirer(p.id)} title="Retirer" style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 10, width: 20, height: 20, cursor: "pointer", fontSize: 12, lineHeight: "18px", padding: 0 }}>✕</button>
                      <div style={{ fontSize: 11, color: "#777", textAlign: "center" }}>Page {i + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              {erreur && <div style={{ marginTop: 12, fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{erreur}</div>}
            </>
          )}

          {étape === "encours" && (
            <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13.5, color: "#555" }}>
              ⏳ Lecture de la page {Math.min(progrès.faits + 1, progrès.total)} sur {progrès.total}…
              <div style={{ height: 6, background: "#eee", borderRadius: 3, margin: "14px auto 0", maxWidth: 320 }}>
                <div style={{ height: 6, borderRadius: 3, background: couleur, width: `${(progrès.faits / Math.max(1, progrès.total)) * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {étape === "revue" && (
            <>
              <p style={{ fontSize: 12.5, color: "#555", margin: "0 0 10px", lineHeight: 1.5 }}>
                Relisez chaque lecture <b>en regard de la photo</b> (touchez la photo pour l'agrandir) et corrigez-la au besoin : l'IA peut se tromper sur une lettre.
                {incertainsTotal > 0 && <> Les <b>[?]</b> marquent les mots qu'elle n'a pas pu lire ({incertainsTotal}).</>}
              </p>
              {pages.map((p, i) => (
                <div key={p.id} style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, padding: 10, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <img src={p.photo.apercu} alt={`Page ${i + 1}`} onClick={() => setAgrandie(p.photo.apercu)} style={{ width: 96, height: 128, objectFit: "cover", borderRadius: 6, cursor: "zoom-in", border: "0.5px solid #ddd" }} />
                    <div style={{ fontSize: 11, color: "#777", textAlign: "center" }}>Page {i + 1}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {p.etat === "attente" && <div style={{ fontSize: 12.5, color: "#777" }}>⏳ Nouvelle lecture…</div>}
                    {p.erreur && (
                      <div style={{ fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "6px 8px", borderRadius: 6, marginBottom: 6 }}>
                        {p.erreur} <button onClick={() => relire(p.id)} style={{ ...bouton(false), padding: "2px 8px", fontSize: 12, marginLeft: 6 }}>Relire cette page</button>
                      </div>
                    )}
                    {p.etat !== "attente" && (
                      <textarea value={p.texte} onChange={(e) => modifierTexte(p.id, e.target.value)} rows={8}
                        style={{ width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.55, fontFamily: "Georgia, serif", padding: 8, border: "0.5px solid #ccc", borderRadius: 6, resize: "vertical" }} />
                    )}
                    {p.tronque && <div style={{ fontSize: 11.5, color: "#8a6d00" }}>La lecture a été coupée (page très chargée) : vérifiez la fin.</div>}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: "#555", marginBottom: 6 }}>Où insérer le texte ?</div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}><input type="radio" checked={position === "fin"} onChange={() => setPosition("fin")} /> À la fin du chapitre</label>
              <label style={{ display: "block", fontSize: 13 }}><input type="radio" checked={position === "curseur"} onChange={() => setPosition("curseur")} /> À l'emplacement du curseur</label>
              {erreur && <div style={{ marginTop: 12, fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{erreur}</div>}
            </>
          )}

          {étape === "fini" && (
            <div style={{ fontSize: 13.5, color: "#0F6E56", background: "#E1F5EE", padding: "12px 14px", borderRadius: 8, lineHeight: 1.6 }}>
              ✓ {inséré} paragraphe{inséré > 1 ? "s" : ""} inséré{inséré > 1 ? "s" : ""} dans le chapitre (Ctrl+Z annule). Vous pouvez maintenant utiliser le
              🧹 Nettoyage mécanique ou « Vérifier le fond » sur ce texte.
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {étape === "choix" && <><button style={bouton(false)} onClick={onFermer}>Fermer</button><button style={{ ...bouton(true), opacity: pages.length ? 1 : 0.5 }} disabled={!pages.length} onClick={lancer}>Lire {pages.length || ""} page{pages.length > 1 ? "s" : ""}</button></>}
          {étape === "encours" && <button style={bouton(false)} onClick={() => contrôleur.current?.abort()}>Annuler</button>}
          {étape === "revue" && <><button style={bouton(false)} onClick={() => setÉtape("choix")}>← Photos</button><button style={bouton(true)} onClick={insérer}>Insérer dans le chapitre</button></>}
          {étape === "fini" && <button style={bouton(true)} onClick={onFermer}>Fermer</button>}
        </div>
      </div>

      {agrandie && (
        <div onClick={() => setAgrandie(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, overflow: "auto", cursor: "zoom-out" }}>
          <img src={agrandie} alt="Page agrandie" style={{ maxWidth: "100%", maxHeight: "100%" }} />
        </div>
      )}
    </div>
  );
}
