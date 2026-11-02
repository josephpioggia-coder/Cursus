/**
 * CURSUS — Rechercher / remplacer (28/10/2026). Panneau flottant, non bloquant : le texte reste visible et modifiable.
 * Deux portées : ce chapitre (surlignage dans l'éditeur, une occurrence après l'autre) et tout le livre (liste par chapitre ;
 * remplacement avec instantané de chaque chapitre modifié dans l'historique AVANT l'écriture). Voir rechercheTexte.js / rechercheEditeur.js.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { chercherDansHtml, chercherDansTitre, remplacerDansHtml, remplacerTout, jetonsNonPris } from "../lib/rechercheTexte.js";
import { etatRecherche, majRecherche, allerA, remplacerUne, remplacerToutes, ciblesDe, atteindreCible, placerAuCaractere } from "../lib/rechercheEditeur.js";

const champ = { width: "100%", boxSizing: "border-box", border: "0.5px solid #bbb", borderRadius: 7, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#1a1a1a" };
const bouton = (actif = false) => ({ fontSize: 12, border: "0.5px solid #ccc", background: actif ? "#EEEDFE" : "#fff", color: actif ? "#534AB7" : "#333", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });
// Caractères spéciaux (menu « Spécial », comme dans Word) : [code, libellé]
const SPECIAUX_RECHERCHE = [["^s", "Espace insécable"], ["^t", "Tabulation"], ["^l", "Saut de ligne"], ["^w", "Espace blanc (un ou plusieurs)"], ["^?", "Un caractère quelconque"], ["^#", "Un chiffre"], ["^$", "Une lettre"], ["^f", "Note de bas de page"], ["^g", "Image"], ["^^", "Un accent circonflexe « ^ »"]];
const SPECIAUX_REMPLACEMENT = [["^s", "Espace insécable"], ["^t", "Tabulation"], ["^l", "Saut de ligne"], ["^&", "Le texte trouvé"], ["^^", "Un accent circonflexe « ^ »"]];
const compterMots = (html) => (html || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

export default function RechercheRemplacement({ editor, couleur = "#7F77DD", lectureSeule = false, mobile = false, requeteInitiale = "", porteeInitiale = "chapitre", onAtteindreLigne, nbLignes = 0, noeudId, noeuds = [], onOuvrirNoeud, onEcrireNoeud, onRenommerNoeud, sauvegarderAvant, onFermer }) {
  const [requete, setRequete] = useState(requeteInitiale);
  const [remplacement, setRemplacement] = useState("");
  const [casse, setCasse] = useState(false);
  const [motEntier, setMotEntier] = useState(false);
  const [debutMot, setDebutMot] = useState(false);
  const [finMot, setFinMot] = useState(false);
  const [accents, setAccents] = useState(false);
  const [portee, setPortee] = useState(porteeInitiale);
  // « Atteindre » (Ctrl+G)
  const [cible, setCible] = useState("titre"); // titre | intertitre | ligne | paragraphe | page | note | image
  const [saisieCible, setSaisieCible] = useState("");
  const [choixNoeud, setChoixNoeud] = useState("");
  const [choixIntertitre, setChoixIntertitre] = useState("0");
  const enAttente = useRef(null); // { id, car } : page estimée dans un AUTRE chapitre, appliquée dès qu'il est ouvert
  const [horsCorps, setHorsCorps] = useState(false);
  const [vue, setVue] = useState("resultats"); // volet du livre : titres | pages | resultats
  const [plan, setPlan] = useState([]); // tous les chapitres/parties, avec page estimée et nombre de résultats
  const [livre, setLivre] = useState(null); // résultats de la recherche dans tout le livre
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [annulable, setAnnulable] = useState(false); // dernier « Tout remplacer » du chapitre, annulable depuis le panneau (Ctrl+Z reste dans le champ de saisie)
  const [, setTic] = useState(0);
  const champRef = useRef(null);
  const remplRef = useRef(null);
  const [plus, setPlus] = useState(false); // « Plus >> » : caractères spéciaux
  const [menuSpecial, setMenuSpecial] = useState(false);
  const dernierChamp = useRef("rech"); // champ qui avait le focus en dernier : "rech" | "rempl"
  const insererSpecial = (code) => {
    const rempl = dernierChamp.current === "rempl";
    const el = rempl ? remplRef.current : champRef.current;
    const valeur = rempl ? remplacement : requete;
    const a = el?.selectionStart ?? valeur.length, b = el?.selectionEnd ?? valeur.length;
    const neuf = valeur.slice(0, a) + code + valeur.slice(b);
    (rempl ? setRemplacement : setRequete)(neuf);
    setMenuSpecial(false);
    setTimeout(() => { el?.focus(); el?.setSelectionRange(a + code.length, a + code.length); }, 0);
  };
  const options = useMemo(() => ({ casse, motEntier, debutMot, finMot, accents }), [casse, motEntier, debutMot, finMot, accents]);

  useEffect(() => { champRef.current?.focus(); champRef.current?.select(); }, []);
  useEffect(() => {
    if (!enAttente.current || enAttente.current.id !== noeudId || !editor) return undefined;
    const car = enAttente.current.car; enAttente.current = null;
    const t = setTimeout(() => placerAuCaractere(editor, car), 350); // laisse l'éditeur charger le chapitre
    return () => clearTimeout(t);
  }, [noeudId, editor]);
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

  const aller = () => {
    setMessage("");
    if (cible === "titre") {
      const n = noeuds.find((x) => x.id === choixNoeud); if (!n) { setMessage("⚠ Choisissez un chapitre ou une partie."); return; }
      if (n.id !== noeudId) onOuvrirNoeud?.(n.id);
      setMessage(`« ${n.titre || "(sans titre)"} » ouvert.`); return;
    }
    if (cible === "ligne") { const r = onAtteindreLigne?.(saisieCible) || { ok: false, message: "Indisponible." }; setMessage((r.ok ? "" : "⚠ ") + r.message); return; }
    if (cible === "intertitre") { const r = atteindreCible(editor, "intertitre", "", Number(choixIntertitre)); setMessage((r.ok ? "" : "⚠ ") + r.message); return; }
    if (cible === "page") {
      const n = parseInt(String(saisieCible).replace(/\D/g, ""), 10);
      if (!Number.isFinite(n) || n < 1) { setMessage("⚠ Indiquez un numéro de page."); return; }
      let cumul = 0;
      const tousLesNoeuds = listeNoeuds().length ? listeNoeuds() : [{ id: noeudId, titre: "ce chapitre", texte: "" }]; // sans livre (ou chapitre isolé) : le chapitre ouvert
      for (const x of tousLesNoeuds) {
        const html = x.id === noeudId && editor ? editor.getHTML() : x.texte;
        const long = (html || "").replace(/<[^>]+>/g, "").length;
        if (n * 1800 > cumul && (n - 1) * 1800 < cumul + long) {
          const car = Math.max(0, (n - 1) * 1800 - cumul);
          if (x.id === noeudId && editor) placerAuCaractere(editor, car);
          else { enAttente.current = { id: x.id, car }; onOuvrirNoeud?.(x.id); }
          setMessage(`Page ${n} estimée : « ${x.titre || "(sans titre)"} » (≈ 1 800 caractères par page, sans pagination réelle).`); return;
        }
        cumul += long;
      }
      const nb = Math.max(1, Math.ceil(cumul / 1800)); setMessage(`⚠ Le livre compte environ ${nb} page${nb > 1 ? "s" : ""} (estimation).`); return;
    }
    const r = atteindreCible(editor, cible, saisieCible); setMessage((r.ok ? "" : "⚠ ") + r.message);
  };

  const listeNoeuds = () => noeuds.filter((n) => horsCorps || n.zone === "corps");
  const chercherLivre = () => {
    setMessage("");
    // Pages ESTIMÉES (Cursus n'a pas de pagination réelle) : ~1 800 caractères par page, chapitres mis bout à bout.
    let cumul = 0;
    const tous = listeNoeuds().map((n) => {
      const html = n.id === noeudId && editor ? editor.getHTML() : n.texte;
      const t = chercherDansTitre(n.titre, requete, options);
      const longueur = (html || "").replace(/<[^>]+>/g, "").length;
      const debut = Math.floor(cumul / 1800) + 1;
      cumul += longueur;
      const fin = Math.max(debut, Math.ceil(cumul / 1800));
      return { id: n.id, titre: n.titre, profondeur: n.profondeur || 0, debut, fin, ...chercherDansHtml(html, requete, options), nTitre: t.n, extraitTitre: t.extrait };
    });
    setPlan(tous);
    const res = tous.filter((r) => r.n + r.nTitre > 0);
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>🔎 Rechercher / remplacer</strong>
        <span style={{ flex: 1 }} />
        <button type="button" style={bouton(portee === "chapitre")} onClick={() => setPortee("chapitre")}>Ce chapitre</button>
        <button type="button" style={bouton(portee === "livre")} onClick={() => setPortee("livre")}>Tout le livre</button>
        <button type="button" style={bouton(portee === "atteindre")} onClick={() => setPortee("atteindre")} title="Aller à un chapitre, une ligne, un paragraphe, une page, une note, une image (Ctrl+G)">Atteindre</button>
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: "none", background: "none", fontSize: 16, color: "#888", cursor: "pointer" }}>✕</button>
      </div>

      {portee !== "atteindre" && (<>
      <input ref={champRef} value={requete} onFocus={() => { dernierChamp.current = "rech"; }} onChange={(ev) => { setRequete(ev.target.value); setMessage(""); }} placeholder="Rechercher…" aria-label="Rechercher" style={champ} />
      <input ref={remplRef} value={remplacement} onFocus={() => { dernierChamp.current = "rempl"; }} onChange={(ev) => setRemplacement(ev.target.value)} placeholder="Remplacer par…" aria-label="Remplacer par" disabled={lectureSeule} style={champ} />
      {jetonsNonPris(requete).length > 0 && <div role="status" style={{ fontSize: 11.5, color: "#8a5a00", background: "#FFF6E0", borderRadius: 6, padding: "4px 8px" }}>Pas encore pris en charge : {jetonsNonPris(requete).join(", ")}. Ces codes sont cherchés tels quels.</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={bouton(casse)} onClick={() => setCasse(!casse)} title="Majuscules et minuscules comptent">Aa</button>
        <button type="button" style={bouton(motEntier)} onClick={() => setMotEntier(!motEntier)} title="Seulement le mot entier (« chat » ne trouve pas « chaton »)">Mot entier</button>
        <button type="button" style={bouton(accents)} onClick={() => setAccents(!accents)} title="Les accents comptent (« ete » ne trouve plus « été »)">é ≠ e</button>
        <button type="button" style={bouton(plus)} onClick={() => { setPlus(!plus); setMenuSpecial(false); }} title="Caractères spéciaux : espace insécable, tabulation, saut de ligne…" aria-expanded={plus}>Plus {plus ? "<<" : ">>"}</button>
        {portee === "livre" && <button type="button" style={bouton(horsCorps)} onClick={() => setHorsCorps(!horsCorps)} title="Chercher aussi dans la réserve, les notes de cadrage et les brouillons">+ réserve, notes, brouillons</button>}
      </div>

      {plus && (
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <button type="button" style={bouton(debutMot)} onClick={() => setDebutMot(!debutMot)} aria-pressed={debutMot} title="Le mot commence par ce texte (« temp » trouve « temps » et « température », pas « longtemps »)">Début de mot</button>
            <button type="button" style={bouton(finMot)} onClick={() => setFinMot(!finMot)} aria-pressed={finMot} title="Le mot finit par ce texte (« temps » trouve « longtemps » et « contretemps », pas « temporel »)">Fin de mot</button>
          </div>
          <button type="button" style={bouton(menuSpecial)} onClick={() => setMenuSpecial(!menuSpecial)} aria-expanded={menuSpecial}>Spécial ▾</button>
          <span style={{ fontSize: 11, color: "#777", marginLeft: 8 }}>s'insère dans le champ où se trouve le curseur ({dernierChamp.current === "rempl" ? "Remplacer par" : "Rechercher"})</span>
          {menuSpecial && (
            <div role="menu" style={{ marginTop: 6, background: "#fff", border: "0.5px solid #ccc", borderRadius: 8, padding: 4 }}>
              {(dernierChamp.current === "rempl" ? SPECIAUX_REMPLACEMENT : SPECIAUX_RECHERCHE).map(([code, lib]) => (
                <button key={code} type="button" role="menuitem" onClick={() => insererSpecial(code)}
                  style={{ display: "flex", justifyContent: "space-between", gap: 14, width: "100%", border: "none", background: "none", textAlign: "left", padding: "5px 8px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: "#1a1a1a", borderRadius: 5 }}>
                  <span>{lib}</span><code style={{ color: "#666" }}>{code}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {portee === "atteindre" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#555" }}>Aller à
            <select value={cible} onChange={(ev) => { setCible(ev.target.value); setMessage(""); setSaisieCible(""); }} style={{ ...champ, marginTop: 4 }} aria-label="Type de destination">
              <option value="titre">Un chapitre ou une partie</option>
              <option value="intertitre">Un intertitre de ce chapitre</option>
              <option value="ligne">Une ligne (numéros de la marge)</option>
              <option value="paragraphe">Un paragraphe</option>
              <option value="page">Une page (estimée)</option>
              <option value="note">Une note de bas de page</option>
              <option value="image">Une image</option>
            </select>
          </label>
          {cible === "titre" && (
            <select value={choixNoeud} onChange={(ev) => setChoixNoeud(ev.target.value)} style={champ} aria-label="Chapitre ou partie">
              <option value="">— choisir —</option>
              {listeNoeuds().map((n) => <option key={n.id} value={n.id}>{"\u00A0\u00A0".repeat(n.profondeur || 0)}{n.titre || "(sans titre)"}</option>)}
            </select>
          )}
          {cible === "intertitre" && (() => {
            const liste = editor ? ciblesDe(editor, "intertitre") : [];
            return liste.length ? (
              <select value={choixIntertitre} onChange={(ev) => setChoixIntertitre(ev.target.value)} style={champ} aria-label="Intertitre">
                {liste.map((c, i) => <option key={i} value={i}>{"\u00A0\u00A0".repeat(Math.max(0, (c.niveau || 1) - 1))}{c.libelle || "(vide)"}</option>)}
              </select>
            ) : <div style={{ fontSize: 12, color: "#777" }}>Aucun intertitre (titre de niveau 1 à 6) dans ce chapitre.</div>;
          })()}
          {!["titre", "intertitre"].includes(cible) && (
            <input value={saisieCible} onChange={(ev) => setSaisieCible(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); aller(); } }} inputMode="text" aria-label="Numéro"
              placeholder={cible === "ligne" ? `Numéro de ligne (1 à ${nbLignes || "…"}) ou +3 / −2` : cible === "page" ? "Numéro de page (estimée)" : "Numéro, ou +1 / −1 depuis le curseur"} style={champ} />
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" style={{ ...bouton(), background: couleur, color: "#fff" }} onClick={aller}>Atteindre</button>
            {["ligne", "paragraphe", "note", "image"].includes(cible) && <>
              <button type="button" style={bouton()} onClick={() => { setSaisieCible("-1"); setTimeout(() => { const r = cible === "ligne" ? onAtteindreLigne?.("-1") : atteindreCible(editor, cible, "-1"); setMessage(r ? (r.ok ? "" : "⚠ ") + r.message : ""); }, 0); }}>◀ Précédent</button>
              <button type="button" style={bouton()} onClick={() => { setSaisieCible("+1"); setTimeout(() => { const r = cible === "ligne" ? onAtteindreLigne?.("+1") : atteindreCible(editor, cible, "+1"); setMessage(r ? (r.ok ? "" : "⚠ ") + r.message : ""); }, 0); }}>Suivant ▶</button>
            </>}
          </div>
          <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Un nombre précédé de + ou − se compte depuis le curseur (« +3 » = trois plus loin). Les pages sont estimées (≈ 1 800 caractères) : Cursus n'a pas de pagination réelle avant l'export.</div>
        </div>
      ) : portee === "chapitre" ? (
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
            <span style={{ fontSize: 12, color: "#555" }}>{livre ? (livre.length ? <b>{totalLivre} résultat{totalLivre > 1 ? "s" : ""} <span style={{ fontWeight: 400 }}>· {livre.length} chapitre{livre.length > 1 ? "s" : ""}</span></b> : "Aucun résultat") : ""}</span>
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
          {livre && (
            <div role="tablist" style={{ display: "flex", gap: 14, borderBottom: "0.5px solid #ddd" }}>
              {[["titres", "Titres"], ["pages", "Pages"], ["resultats", "Résultats"]].map(([id, lib]) => (
                <button key={id} type="button" role="tab" aria-selected={vue === id} onClick={() => setVue(id)}
                  style={{ border: "none", background: "none", padding: "4px 0", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", color: vue === id ? couleur : "#666", borderBottom: vue === id ? `2px solid ${couleur}` : "2px solid transparent", fontWeight: vue === id ? 600 : 400 }}>{lib}</button>
              ))}
            </div>
          )}
          {livre && vue === "titres" && plan.map((r) => (
            <button key={r.id} type="button" onClick={() => { onOuvrirNoeud?.(r.id); setPortee("chapitre"); }}
              style={{ textAlign: "left", border: "none", background: r.id === noeudId ? "#F6F5FF" : "transparent", borderRadius: 6, padding: `4px 6px 4px ${6 + r.profondeur * 14}px`, cursor: "pointer", fontFamily: "inherit", color: r.n + r.nTitre ? "#1a1a1a" : "#999", fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{r.titre || "(sans titre)"}</span>
              {r.n + r.nTitre > 0 && <b style={{ color: couleur }}>{r.n + r.nTitre}</b>}
            </button>
          ))}
          {livre && vue === "pages" && (livre.length ? (
            <>
              <div style={{ fontSize: 11, color: "#888" }}>Pages estimées (≈ 1 800 caractères par page) : Cursus n'a pas de pagination réelle avant l'export.</div>
              {livre.map((r) => (
                <button key={r.id} type="button" onClick={() => { onOuvrirNoeud?.(r.id); setPortee("chapitre"); }}
                  style={{ textAlign: "left", border: "0.5px solid #ddd", background: "#fff", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit", color: "#1a1a1a", fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>Page{r.fin > r.debut ? "s" : ""} {r.fin > r.debut ? `${r.debut}–${r.fin}` : r.debut} · {r.titre || "(sans titre)"}</span>
                  <b style={{ color: couleur }}>{r.n + r.nTitre}</b>
                </button>
              ))}
            </>
          ) : null)}
          {livre && vue === "resultats" && livre.map((r) => (
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
