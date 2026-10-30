/**
 * CURSUS — Rechercher / remplacer (28/10/2026). Panneau flottant, non bloquant : le texte reste visible et modifiable.
 * Deux portées : ce chapitre (surlignage dans l'éditeur, une occurrence après l'autre) et tout le livre (liste par chapitre ;
 * remplacement avec instantané de chaque chapitre modifié dans l'historique AVANT l'écriture). Voir rechercheTexte.js / rechercheEditeur.js.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { chercherDansHtml, chercherDansTitre, remplacerDansHtml, remplacerTout } from "../lib/rechercheTexte.js";
import { etatRecherche, majRecherche, allerA, remplacerUne, remplacerToutes } from "../lib/rechercheEditeur.js";

const champ = { width: "100%", boxSizing: "border-box", border: "0.5px solid #bbb", borderRadius: 7, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#1a1a1a" };
const bouton = (actif = false) => ({ fontSize: 12, border: "0.5px solid #ccc", background: actif ? "#EEEDFE" : "#fff", color: actif ? "#534AB7" : "#333", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });
const compterMots = (html) => (html || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

export default function RechercheRemplacement({ editor, couleur = "#7F77DD", lectureSeule = false, mobile = false, requeteInitiale = "", noeudId, noeuds = [], onOuvrirNoeud, onEcrireNoeud, onRenommerNoeud, sauvegarderAvant, onFermer }) {
  const [requete, setRequete] = useState(requeteInitiale);
  const [remplacement, setRemplacement] = useState("");
  const [casse, setCasse] = useState(false);
  const [motEntier, setMotEntier] = useState(false);
  const [accents, setAccents] = useState(false);
  const [portee, setPortee] = useState("chapitre");
  const [horsCorps, setHorsCorps] = useState(false);
  const [livre, setLivre] = useState(null); // résultats de la recherche dans tout le livre
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [annulable, setAnnulable] = useState(false); // dernier « Tout remplacer » du chapitre, annulable depuis le panneau (Ctrl+Z reste dans le champ de saisie)
  const [, setTic] = useState(0);
  const champRef = useRef(null);
  const options = useMemo(() => ({ casse, motEntier, accents }), [casse, motEntier, accents]);

  useEffect(() => { champRef.current?.focus(); champRef.current?.select(); }, []);
  useEffect(() => {
    if (!editor) return;
    const f = () => setTic((t) => t + 1);
    editor.on("transaction", f);
    return () => editor.off("transaction", f);
  }, [editor]);
  // Surlignage : suit la requête et les options ; effacé à la fermeture.
  useEffect(() => { if (editor) majRecherche(editor, requete, options, 0); setLivre(null); setConfirmer(false); setAnnulable(false); }, [editor, requete, options]);
  useEffect(() => () => { try { if (editor && !editor.isDestroyed) majRecherche(editor, "", {}); } catch { /* éditeur déjà fermé */ } }, [editor]);

  const e = etatRecherche(editor);
  const total = e?.occurrences.length || 0;
  const courant = e?.courant ?? -1;

  const suivant = () => { setMessage(""); allerA(editor, (courant < 0 ? 0 : courant + 1)); };
  const precedent = () => { setMessage(""); allerA(editor, (courant < 0 ? total - 1 : courant - 1)); };
  const remplacerCourante = () => {
    if (lectureSeule || !total) return;
    const i = courant < 0 ? 0 : courant;
    remplacerUne(editor, i, remplacement);
    setMessage("1 remplacement.");
    setTimeout(() => allerA(editor, i), 0); // l'occurrence suivante prend la place de l'index courant
  };
  const toutRemplacerChapitre = () => {
    if (lectureSeule || !total) return;
    const n = remplacerToutes(editor, remplacement);
    setMessage(`${n} remplacement${n > 1 ? "s" : ""} dans ce chapitre.`);
    setAnnulable(true);
  };
  const annulerRemplacement = () => { editor?.commands.undo(); setAnnulable(false); setMessage("Remplacement annulé."); };

  const listeNoeuds = () => noeuds.filter((n) => horsCorps || n.zone === "corps");
  const chercherLivre = () => {
    setMessage("");
    const res = listeNoeuds().map((n) => {
      const html = n.id === noeudId && editor ? editor.getHTML() : n.texte;
      const t = chercherDansTitre(n.titre, requete, options);
      return { id: n.id, titre: n.titre, ...chercherDansHtml(html, requete, options), nTitre: t.n, extraitTitre: t.extrait };
    }).filter((r) => r.n + r.nTitre > 0);
    setLivre(res); setConfirmer(false);
  };
  // Titre d'un chapitre / d'une partie : renommé par l'application (aucun historique des titres : la confirmation montre « avant → après »).
  const nouveauTitre = (titre) => remplacerTout(titre || "", requete, remplacement, options).texte;
  const changerTitre = async (r) => {
    const apres = nouveauTitre(r.titre).trim();
    if (!apres) throw new Error("le titre deviendrait vide : non modifié");
    const res = await onRenommerNoeud?.(r.id, apres);
    if (res?.error) throw new Error(res.error.message);
  };
  const toutRemplacerLivre = async () => {
    if (lectureSeule || !livre?.length) return;
    setOccupe(true); setMessage("");
    let n = 0, nTitres = 0, aLaMain = 0; const echecs = []; const modifies = new Set();
    const libelle = `Avant remplacement « ${requete.slice(0, 30)} » → « ${remplacement.slice(0, 30)} »`;
    for (const r of livre) {
      try {
        if (r.id === noeudId && editor) {
          await sauvegarderAvant?.(libelle);
          const k = remplacerToutes(editor, remplacement);
          if (k) { n += k; modifies.add(r.id); }
          if (r.nTitre) { await changerTitre(r); n += r.nTitre; nTitres += r.nTitre; modifies.add(r.id); }
          continue;
        }
        const source = noeuds.find((x) => x.id === r.id);
        const res = remplacerDansHtml(source?.texte || "", requete, remplacement, options);
        aLaMain += res.aLaMain;
        if (!res.n) { if (r.nTitre) { await changerTitre(r); n += r.nTitre; nTitres += r.nTitre; modifies.add(r.id); } continue; }
        const apercu = `${libelle} — ${(source.titre || "").slice(0, 40)}`;
        const { error: errV } = await supabase.from("versions_noeuds").insert({ noeud_id: r.id, contenu: source.texte, mots: compterMots(source.texte), apercu });
        if (errV) throw new Error("instantané impossible : " + errV.message);
        const ecr = await onEcrireNoeud?.(r.id, res.html);
        if (ecr?.error) throw new Error(ecr.error.message);
        n += res.n; modifies.add(r.id);
        if (r.nTitre) { await changerTitre(r); n += r.nTitre; nTitres += r.nTitre; }
      } catch (err) { echecs.push(`${r.titre || "(sans titre)"} : ${err.message}`); }
    }
    setOccupe(false); setConfirmer(false); setLivre(null);
    const chapitres = modifies.size;
    setMessage(`${n} remplacement${n > 1 ? "s" : ""} dans ${chapitres} chapitre${chapitres > 1 ? "s" : ""}${nTitres ? ` (dont ${nTitres} dans des titres)` : ""}.` + (aLaMain ? ` ${aLaMain} occurrence${aLaMain > 1 ? "s" : ""} à cheval sur une mise en forme : à faire à la main.` : "") + (echecs.length ? ` ⚠ Non modifié : ${echecs.join(" ; ")}` : ""));
  };

  const totalLivre = livre?.reduce((s, r) => s + r.n + r.nTitre, 0) || 0;
  const titresModifies = livre?.filter((r) => r.nTitre) || [];
  const touche = (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); onFermer?.(); }
    else if (ev.key === "Enter" && ev.target === champRef.current) { ev.preventDefault(); if (portee === "livre") chercherLivre(); else (ev.shiftKey ? precedent() : suivant()); }
    else if (ev.key === "Enter") { ev.preventDefault(); remplacerCourante(); }
  };

  return (
    <div role="dialog" aria-label="Rechercher et remplacer" onKeyDown={touche} data-pointeur-ignore
      style={{ position: "fixed", zIndex: 70, background: "#fff", color: "#1a1a1a", border: "0.5px solid #ccc", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", padding: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 13,
        ...(mobile ? { left: 8, right: 8, bottom: 8, maxHeight: "60vh", overflowY: "auto" } : { top: 120, right: 24, width: 380, maxHeight: "70vh", overflowY: "auto" }) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <strong style={{ fontSize: 13 }}>🔎 Rechercher / remplacer</strong>
        <span style={{ flex: 1 }} />
        <button type="button" style={bouton(portee === "chapitre")} onClick={() => setPortee("chapitre")}>Ce chapitre</button>
        <button type="button" style={bouton(portee === "livre")} onClick={() => setPortee("livre")}>Tout le livre</button>
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: "none", background: "none", fontSize: 16, color: "#888", cursor: "pointer" }}>✕</button>
      </div>

      <input ref={champRef} value={requete} onChange={(ev) => { setRequete(ev.target.value); setMessage(""); }} placeholder="Rechercher…" aria-label="Rechercher" style={champ} />
      <input value={remplacement} onChange={(ev) => setRemplacement(ev.target.value)} placeholder="Remplacer par…" aria-label="Remplacer par" disabled={lectureSeule} style={champ} />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={bouton(casse)} onClick={() => setCasse(!casse)} title="Majuscules et minuscules comptent">Aa</button>
        <button type="button" style={bouton(motEntier)} onClick={() => setMotEntier(!motEntier)} title="Seulement le mot entier (« chat » ne trouve pas « chaton »)">Mot entier</button>
        <button type="button" style={bouton(accents)} onClick={() => setAccents(!accents)} title="Les accents comptent (« ete » ne trouve plus « été »)">é ≠ e</button>
        {portee === "livre" && <button type="button" style={bouton(horsCorps)} onClick={() => setHorsCorps(!horsCorps)} title="Chercher aussi dans la réserve, les notes de cadrage et les brouillons">+ réserve, notes, brouillons</button>}
      </div>

      {portee === "chapitre" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={bouton()} onClick={precedent} disabled={!total} aria-label="Occurrence précédente">◀</button>
            <button type="button" style={bouton()} onClick={suivant} disabled={!total} aria-label="Occurrence suivante">▶</button>
            <span style={{ fontSize: 12, color: "#555", minWidth: 70 }}>{!requete ? "" : total ? `${courant + 1} / ${total}` : "Aucun résultat"}</span>
            <span style={{ flex: 1 }} />
            <button type="button" style={bouton()} onClick={remplacerCourante} disabled={lectureSeule || !total}>Remplacer</button>
            <button type="button" style={{ ...bouton(), background: total && !lectureSeule ? couleur : "#eee", color: total && !lectureSeule ? "#fff" : "#999" }} onClick={toutRemplacerChapitre} disabled={lectureSeule || !total}>Tout remplacer</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={{ ...bouton(), background: requete ? couleur : "#eee", color: requete ? "#fff" : "#999" }} onClick={chercherLivre} disabled={!requete}>Chercher dans le livre</button>
            <span style={{ fontSize: 12, color: "#555" }}>{livre ? (livre.length ? `${totalLivre} occurrence${totalLivre > 1 ? "s" : ""} · ${livre.length} chapitre${livre.length > 1 ? "s" : ""}` : "Aucun résultat") : ""}</span>
          </div>
          {livre?.length > 0 && !lectureSeule && !confirmer && <button type="button" style={bouton()} onClick={() => setConfirmer(true)}>Tout remplacer dans le livre…</button>}
          {confirmer && (
            <div style={{ background: "#FFF6E0", border: "0.5px solid #E8C770", borderRadius: 8, padding: 8, fontSize: 12, lineHeight: 1.5 }}>
              Remplacer <b>{totalLivre}</b> occurrence{totalLivre > 1 ? "s" : ""} de « {requete} » par « {remplacement || "(rien : suppression)"} » dans <b>{livre.length}</b> chapitre{livre.length > 1 ? "s" : ""} ? Chaque chapitre modifié est d'abord enregistré dans son historique (↺ Historique).
              {titresModifies.length > 0 && <div style={{ marginTop: 4 }}><b>Titres modifiés</b> (pas d'historique pour les titres) :{titresModifies.map((r) => <div key={r.id}>« {r.titre} » → « {nouveauTitre(r.titre)} »</div>)}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button type="button" style={{ ...bouton(), background: couleur, color: "#fff" }} onClick={toutRemplacerLivre} disabled={occupe}>{occupe ? "En cours…" : "Confirmer"}</button>
                <button type="button" style={bouton()} onClick={() => setConfirmer(false)} disabled={occupe}>Annuler</button>
              </div>
            </div>
          )}
          {livre?.map((r) => (
            <button key={r.id} type="button" onClick={() => { onOuvrirNoeud?.(r.id); setPortee("chapitre"); }} style={{ textAlign: "left", border: "0.5px solid #ddd", background: r.id === noeudId ? "#F6F5FF" : "#fff", borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontFamily: "inherit", color: "#1a1a1a" }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.titre || "(sans titre)"} <span style={{ color: "#888", fontWeight: 400 }}>· {r.n + r.nTitre}</span></div>
              {r.extraitTitre && <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.4 }}><b>Titre :</b> …{r.extraitTitre.avant}<mark style={{ background: "#FFE98A", color: "inherit" }}>{r.extraitTitre.trouve}</mark>{r.extraitTitre.apres}…</div>}
              {r.extraits.map((x, i) => <div key={i} style={{ fontSize: 11.5, color: "#555", lineHeight: 1.4 }}>{x.note && <b>Note : </b>}…{x.avant}<mark style={{ background: "#FFE98A", color: "inherit" }}>{x.trouve}</mark>{x.apres}…</div>)}
            </button>
          ))}
        </>
      )}
      {annulable && portee === "chapitre" && <button type="button" style={bouton()} onClick={annulerRemplacement}>↩ Annuler ce « Tout remplacer »</button>}
      {message && <div role="status" style={{ fontSize: 12, color: message.includes("⚠") ? "#b3261e" : "#1D6F4F", lineHeight: 1.45 }}>{message}</div>}
    </div>
  );
}
