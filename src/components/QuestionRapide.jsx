/**
 * CURSUS — « 💬 Question rapide » (28/10/2026) : poser une question à l'IA pendant qu'on écrit, sans passer par le Co-pilote.
 * Menu modèle + effort comme dans Claude (décision de Joseph) : l'effort détermine la consommation du quota, « Moyen » est
 * recommandé. Voir src/lib/questionRapide.js et src/lib/modelesIA.js. Rien n'est inséré dans le texte sans un clic.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { detecterRefus, MESSAGE_REFUS } from "../lib/scenesIntimes.js";
import { poserQuestion } from "../lib/questionRapide.js";
import { EFFORTS, PROFILS, STYLES, chargerModeles, consoRelative, ecrireChoix, lireChoix, modeleDuProfil, reglageRecommande, MODELES_PAR_DEFAUT } from "../lib/modelesIA.js";
import { preferencesIAAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";

const CLE_MODE = "cursus-question-rapide-mode";
const pastille = { fontSize: 10, border: "0.5px solid #bbb", borderRadius: 10, padding: "0 6px", color: "#666", marginLeft: 6, whiteSpace: "nowrap" };

export default function QuestionRapide({ editor, couleur = "#7F77DD", lectureSeule = false, selectionInitiale = "", mobile = false, onFermer, onAide }) {
  const [modeles, setModeles] = useState(MODELES_PAR_DEFAUT);
  const [reglage, setReglage] = useState(() => ({ ...lireChoix(MODELES_PAR_DEFAUT), profil: null }));
  const [propose, setPropose] = useState(false); // réglage recommandé proposé (rien d'enregistré encore) — non bloquant
  const [menu, setMenu] = useState(null); // null | "principal" | "effort" | "style" | "profils"
  const { modele, effort, style } = reglage;
  const [question, setQuestion] = useState("");
  const [avecSources, setAvecSources] = useState(() => { try { return localStorage.getItem(CLE_MODE) === "sources"; } catch { return false; } });
  const [joindre, setJoindre] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [echanges, setEchanges] = useState([]);
  const [copie, setCopie] = useState(null);
  const arret = useRef(null);
  const champ = useRef(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const liste = await chargerModeles();
      if (!vivant) return;
      setModeles(liste);
      // 1) réglage enregistré sur le compte ; 2) sinon celui de cet appareil ; 3) sinon le réglage RECOMMANDÉ, proposé sans bloquer.
      const { data } = await preferencesIAAPI.lire().catch(() => ({ data: null }));
      if (!vivant) return;
      if (data) { setReglage({ profil: data.profil, modele: liste.some((m) => m.id === data.modele) ? data.modele : lireChoix(liste).modele, effort: data.effort || "moyen", style: data.style || "equilibre", consigne: data.consigne || "" }); return; }
      const local = lireChoix(liste);
      if (local.enregistre) { setReglage({ ...local, profil: null }); return; }
      setReglage(reglageRecommande(liste)); setPropose(true);
    })();
    champ.current?.focus();
    return () => { vivant = false; arret.current?.abort(); };
  }, []);
  useEffect(() => {
    const touche = (e) => { if (e.key === "Escape") { if (menu) setMenu(null); else onFermer?.(); } };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [menu, onFermer]);

  const modeleChoisi = modeles.find((m) => m.id === modele) || modeles[0];
  const effortChoisi = EFFORTS.find((e) => e.id === effort) || EFFORTS[1];
  const styleChoisi = STYLES.find((x) => x.id === style) || STYLES[1];
  const conso = useMemo(() => consoRelative(modele, effort, modeles), [modele, effort, modeles]);
  const niveauConso = Math.min(5, Math.max(1, Math.round(Math.log2(Math.max(conso, 1)) * 1.3 + 1)));

  // Enregistre le réglage : cet appareil tout de suite, le compte ensuite (table absente → l'appareil seul, sans message).
  const sauver = (suite) => {
    setReglage(suite); setPropose(false);
    ecrireChoix(suite);
    preferencesIAAPI.enregistrer({ profil: suite.profil || null, modele: suite.modele, effort: suite.effort, style: suite.style, consigne: (suite.consigne || "").slice(0, 500) }).catch(() => {});
  };
  const choisirModele = (id) => { sauver({ ...reglage, modele: id, profil: null }); setMenu(null); };
  const choisirEffort = (id) => { sauver({ ...reglage, effort: id, profil: null }); setMenu(null); };
  const choisirStyle = (id) => { sauver({ ...reglage, style: id, profil: null }); setMenu(null); };
  const choisirProfil = (p) => { sauver({ ...reglage, profil: p.id, modele: modeleDuProfil(p, modeles), effort: p.effort, style: p.style }); setMenu(null); };
  const basculerMode = (sources) => { setAvecSources(sources); try { localStorage.setItem(CLE_MODE, sources ? "sources" : "memoire"); } catch { /* sans stockage */ } };

  const envoyer = async () => {
    const q = question.trim();
    if (!q || enCours) return;
    setEnCours(true); setErreur(null);
    const ctl = new AbortController(); arret.current = ctl;
    try {
      if (propose) sauver(reglage); // on a posé une question sans toucher au réglage proposé : il est retenu
      const r = await poserQuestion({ question: q, modele, effort, style, consignePerso: reglage.consigne, avecSources, selection: joindre ? selectionInitiale : "", signal: ctl.signal });
      setEchanges((liste) => [{ q, avecSources, ...r, poids: Math.round((r.entree + r.sortie) * (modeles.find((m) => m.id === r.modeleUtilise)?.poids ?? modeleChoisi?.poids ?? 1)) }, ...liste].slice(0, 6));
      setQuestion("");
    } catch (e) {
      if (e?.name !== "AbortError") { setErreur(e.message || "La question n'a pas abouti."); journaliserErreur("QuestionRapide", e.message || String(e)); }
    } finally { setEnCours(false); }
  };

  const copier = async (texte, i) => { try { await navigator.clipboard.writeText(texte); setCopie(i); setTimeout(() => setCopie(null), 1800); } catch { /* presse-papiers indisponible */ } };
  const inserer = (texte) => editor?.chain().focus().insertContent({ type: "note", attrs: { texte: texte.slice(0, 1500) } }).run();

  const ligneMenu = (actif, onClick, contenu, droite) => (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textAlign: "left", color: "#222" }}>
      <span style={{ display: "flex", alignItems: "center" }}>{contenu}</span>
      <span style={{ color: couleur }}>{droite ?? (actif ? "✓" : "")}</span>
    </button>
  );

  return (
    <div role="dialog" aria-label="Question rapide" style={{
      position: "fixed", zIndex: 900, background: "#fff", color: "#222", boxShadow: "0 4px 24px rgba(0,0,0,0.22)", border: "0.5px solid #ddd", display: "flex", flexDirection: "column",
      ...(mobile ? { left: 0, right: 0, bottom: 0, top: 48, borderRadius: "12px 12px 0 0" } : { right: 24, bottom: 56, width: 430, maxWidth: "calc(100vw - 32px)", minHeight: 340, maxHeight: "74vh", borderRadius: 12 }),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #eee" }}>
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>💬 Question rapide</span>
        <button type="button" onClick={() => setMenu(menu ? null : "principal")} aria-haspopup="menu" aria-expanded={!!menu}
          title="Choisir le modèle et l'effort : ils déterminent la consommation de votre quota"
          style={{ fontSize: 12, padding: "4px 10px", border: "0.5px solid #ccc", borderRadius: 14, background: menu ? `${couleur}15` : "#fff", color: "#444", cursor: "pointer", fontFamily: "inherit" }}>
          {modeleChoisi?.libelle} · {effortChoisi.libelle} · {styleChoisi.libelle} ▾
        </button>
        {onAide && <button type="button" onClick={onAide} title="Questions sur le fonctionnement de Cursus : réponses connues, pointer un bouton" style={{ border: "0.5px solid #ccc", background: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#534AB7", marginRight: 8 }}>❓ Aide sur Cursus</button>}
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: "none", background: "none", fontSize: 18, color: "#999", cursor: "pointer" }}>✕</button>
      </div>

      {menu && (
        <div role="menu" style={{ position: "absolute", top: 46, right: 10, width: 300, maxWidth: "calc(100% - 20px)", background: "#fff", border: "0.5px solid #ddd", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.2)", zIndex: 5, padding: "6px 0" }}>
          {menu === "principal" && (<>
            {modeles.map((m) => ligneMenu(m.id === modele, () => choisirModele(m.id), (<>{m.libelle}{m.recommande && <span style={pastille}>Recommandé</span>}{m.credits_requis && <span style={pastille}>Nécessite des crédits</span>}</>), m.id === modele ? "✓" : `×${m.poids}`))}
            <div style={{ borderTop: "0.5px solid #eee", margin: "4px 0" }} />
            {ligneMenu(false, () => setMenu("effort"), <>Effort</>, <span style={{ color: "#666", fontSize: 13 }}>{effortChoisi.libelle} ›</span>)}
            {ligneMenu(false, () => setMenu("style"), <>Style</>, <span style={{ color: "#666", fontSize: 13 }}>{styleChoisi.libelle} ›</span>)}
            {ligneMenu(false, () => setMenu("profils"), <>Profils</>, <span style={{ color: "#666", fontSize: 13 }}>{(PROFILS.find((p) => p.id === reglage.profil) || {}).libelle || "Personnalisé"} ›</span>)}
            <div style={{ fontSize: 11, color: "#888", padding: "4px 12px 6px", lineHeight: 1.4 }}>{modeleChoisi?.description}</div>
          </>)}
          {menu === "effort" && (<>
            <div style={{ fontSize: 12, color: "#777", padding: "4px 12px 8px", lineHeight: 1.45 }}>Un effort plus élevé signifie des réponses plus approfondies, mais prend plus de temps et consomme votre quota plus rapidement.</div>
            {EFFORTS.map((e) => ligneMenu(e.id === effort, () => choisirEffort(e.id), (<>{e.libelle}{e.recommande && <span style={pastille}>Recommandé</span>}</>)))}
            <button type="button" onClick={() => setMenu("principal")} style={{ border: "none", background: "none", color: "#888", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>‹ Retour</button>
          </>)}
          {menu === "style" && (<>
            <div style={{ fontSize: 12, color: "#777", padding: "4px 12px 8px", lineHeight: 1.45 }}>La longueur et la manière de répondre. Les règles de fond (ne pas inventer, signaler ce qui est à vérifier) restent toujours appliquées.</div>
            {STYLES.map((x) => ligneMenu(x.id === style, () => choisirStyle(x.id), (<span style={{ display: "flex", flexDirection: "column" }}><span>{x.libelle}{x.recommande && <span style={pastille}>Recommandé</span>}</span><span style={{ fontSize: 11, color: "#888" }}>{x.aide}</span></span>)))}
            <div style={{ borderTop: "0.5px solid #eee", margin: "6px 0 0", padding: "8px 12px 4px" }}>
              <label style={{ fontSize: 12, color: "#666" }}>Ma consigne personnelle (facultatif)</label>
              <textarea defaultValue={reglage.consigne || ""} maxLength={500} rows={2}
                onBlur={(e) => { if ((e.target.value || "") !== (reglage.consigne || "")) sauver({ ...reglage, consigne: e.target.value, profil: null }); }}
                placeholder="Ex. : tutoie-moi ; cite toujours tes sources"
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, fontSize: 12.5, padding: "6px 8px", border: "0.5px solid #ccc", borderRadius: 6, fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <button type="button" onClick={() => setMenu("principal")} style={{ border: "none", background: "none", color: "#888", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>‹ Retour</button>
          </>)}
          {menu === "profils" && (<>
            <div style={{ fontSize: 12, color: "#777", padding: "4px 12px 8px", lineHeight: 1.45 }}>Un profil règle d'un coup le modèle, l'effort et le style.</div>
            {PROFILS.map((p) => ligneMenu(p.id === reglage.profil, () => choisirProfil(p), (<span style={{ display: "flex", flexDirection: "column" }}><span>{p.libelle}{p.recommande && <span style={pastille}>Recommandé</span>}</span><span style={{ fontSize: 11, color: "#888" }}>{p.aide}</span></span>)))}
            <button type="button" onClick={() => setMenu("principal")} style={{ border: "none", background: "none", color: "#888", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>‹ Retour</button>
          </>)}
        </div>
      )}

      {propose && !menu && (
        <div role="note" style={{ margin: "8px 14px 0", padding: "8px 10px", background: "#F5F4FD", border: `0.5px solid ${couleur}40`, borderRadius: 8, fontSize: 12.5, color: "#444", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 180 }}>Assistant recommandé : <b>{modeleChoisi?.libelle} · {effortChoisi.libelle} · {styleChoisi.libelle}</b>. Il est déjà appliqué.</span>
          <button type="button" onClick={() => sauver(reglage)} style={{ fontSize: 12, border: "none", background: "none", color: couleur, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Garder</button>
          <button type="button" onClick={() => setMenu("principal")} style={{ fontSize: 12, border: `0.5px solid ${couleur}`, background: "#fff", color: couleur, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>Modifier</button>
        </div>
      )}

      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0, flex: 1 }}>
        <textarea ref={champ} value={question} onFocus={() => setMenu(null)} onChange={(e) => setQuestion(e.target.value)} rows={3}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); envoyer(); } }}
          placeholder="Ex. : Ernest Hemingway — dates, œuvres majeures, style…  (Ctrl+Entrée pour envoyer)"
          style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "8px 10px", border: "0.5px solid #ccc", borderRadius: 8, fontFamily: "inherit", resize: "vertical", background: "#fff", color: "#222" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div role="group" aria-label="Mode" style={{ display: "inline-flex", border: "0.5px solid #ccc", borderRadius: 14, overflow: "hidden" }}>
            {[[false, "De mémoire"], [true, "Avec sources"]].map(([val, lib]) => (
              <button key={lib} type="button" aria-pressed={avecSources === val} onClick={() => basculerMode(val)}
                title={val ? "Recherche web, avec les liens réellement trouvés (plus lent, un peu plus cher)" : "Réponse rapide de mémoire : à vérifier avant publication"}
                style={{ fontSize: 12, padding: "4px 10px", border: "none", cursor: "pointer", fontFamily: "inherit", background: avecSources === val ? couleur : "#fff", color: avecSources === val ? "#fff" : "#555" }}>{lib}</button>
            ))}
          </div>
          {selectionInitiale?.trim() && (
            <label style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={joindre} onChange={(e) => setJoindre(e.target.checked)} /> Joindre la sélection ({selectionInitiale.trim().length} car.)
            </label>
          )}
          <span style={{ flex: 1 }} />
          <span title="Consommation relative estimée (modèle × effort)" style={{ fontSize: 11, color: "#888" }}>
            Conso {"●".repeat(niveauConso)}<span style={{ color: "#ddd" }}>{"●".repeat(5 - niveauConso)}</span>
          </span>
          <button type="button" onClick={envoyer} disabled={enCours || !question.trim()}
            style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "none", background: couleur, color: "#fff", cursor: enCours || !question.trim() ? "default" : "pointer", opacity: enCours || !question.trim() ? 0.55 : 1, fontFamily: "inherit" }}>
            {enCours ? "…" : "Demander"}
          </button>
        </div>
        {erreur && <div role="alert" style={{ fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", borderRadius: 6, padding: "6px 8px" }}>⚠ {erreur}</div>}

        {echanges.map((x, i) => (
          <div key={i} style={{ borderTop: "0.5px solid #eee", paddingTop: 8 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>« {x.q.length > 140 ? x.q.slice(0, 140) + "…" : x.q} »</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{x.texte}</div>
            {detecterRefus(x.texte, x.stopReason) && <div style={{ marginTop: 6, fontSize: 12, color: "#8a5a00", background: "#FFF6E0", border: "0.5px solid #E8C770", borderRadius: 8, padding: "6px 8px", lineHeight: 1.45 }}>⚠ {MESSAGE_REFUS}</div>}
            {x.tronque && <div style={{ fontSize: 11.5, color: "#7a5a00", marginTop: 4 }}>Réponse coupée : augmentez l'effort ou reformulez plus court.</div>}
            {x.avecSources ? (
              x.sources.length > 0 ? (
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  <div style={{ color: "#888" }}>Sources trouvées par la recherche :</div>
                  {x.sources.map((s) => <div key={s.url}><a href={s.url} target="_blank" rel="noreferrer" style={{ color: couleur }}>🔗 {s.titre}</a></div>)}
                </div>
              ) : <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 6 }}>⚠ Aucune source n'a été trouvée : à vérifier avant publication.</div>
            ) : <div style={{ fontSize: 11.5, color: "#7a5a00", marginTop: 6 }}>De mémoire : à vérifier avant publication (dates, titres, citations).</div>}
            {x.bascule && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Le modèle demandé était indisponible : {x.modeleUtilise} a été utilisé.</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={() => copier(x.texte, i)} style={{ fontSize: 12, border: "0.5px solid #ccc", background: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", color: copie === i ? "#1D9E75" : "#555" }}>{copie === i ? "✓ Copié" : "📋 Copier"}</button>
              {!lectureSeule && editor && <button type="button" onClick={() => inserer(x.texte)} title="Insère la réponse comme note de bas de page au curseur" style={{ fontSize: 12, border: "0.5px solid #ccc", background: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", color: "#555" }}>📝 En note de bas de page</button>}
              <span style={{ flex: 1 }} />
              <span title={`${x.entree} tokens envoyés + ${x.sortie} reçus, pondérés par le modèle`} style={{ fontSize: 11, color: "#aaa" }}>≈ {x.poids.toLocaleString("fr-FR")} tokens de votre quota</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
