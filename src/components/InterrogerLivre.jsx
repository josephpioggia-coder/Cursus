/**
 * CURSUS — « 📖 Interroger le livre » (26/11/2026), panneau du Co-pilote. Pose une question à TOUS les chapitres du projet et produit un relevé
 * classé avec citations exactes (vérifiées par le code), chapitre et voix. Moteur : src/lib/interrogerLivre.js (méthode décrite en tête).
 * Étapes : question → mots à chercher (comptés gratuitement) → devis → catégories → relevé. Le relevé est gardé sur cet appareil.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { aplatirStructure } from "../lib/rechercheTexte.js";
import * as L from "../lib/interrogerLivre.js";
import { appelClaude } from "../lib/correctionRapide.js";
import { chargerModeles } from "../lib/modelesIA.js";
import { detecterRefus } from "../lib/scenesIntimes.js";
import { journaliserErreur } from "../lib/journalErreurs.js";

const CLE = (projetId) => `cursus-releve-livre-v1:${projetId || "sans-projet"}`;
const lire = (projetId) => { try { return JSON.parse(localStorage.getItem(CLE(projetId)) || "null"); } catch { return null; } };
const écrire = (projetId, v) => { try { localStorage.setItem(CLE(projetId), JSON.stringify(v)); } catch { /* stockage plein ou indisponible */ } };

const carte = { background: "#fff", border: "0.5px solid #ddd", borderRadius: 8, padding: "9px 10px", marginBottom: 10, color: "#1a1a1a" };
const titreEtape = { fontSize: 11.5, fontWeight: 600, color: "#444", marginBottom: 5 };
const champ = { width: "100%", boxSizing: "border-box", border: "0.5px solid #ccc", borderRadius: 6, padding: "6px 8px", fontSize: 16, fontFamily: "inherit", color: "#1a1a1a", background: "#fff", resize: "vertical" };
const nombre = (n) => Number(n || 0).toLocaleString("fr-FR");

export default function InterrogerLivre({ structureProjet = [], projetId = null, projetTitre = "", couleur = "#7F77DD", onOuvrirPassage, onRetour }) {
  const sauvé = useMemo(() => lire(projetId), [projetId]);
  const [question, setQuestion] = useState(sauvé?.question || "");
  const [termes, setTermes] = useState(sauvé?.termes || "");
  const [cats, setCats] = useState(sauvé?.cats || "");
  const [horsCorps, setHorsCorps] = useState(false);
  const [relevé, setRelevé] = useState(sauvé?.relevé || null);
  const [occupé, setOccupé] = useState(null); // "termes" | "categories" | "releve"
  const [progression, setProgression] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ouvertes, setOuvertes] = useState(() => new Set());
  const [copie, setCopie] = useState(false);
  const signalRef = useRef(null);

  const nœuds = useMemo(() => aplatirStructure(structureProjet), [structureProjet]);
  const passages = useMemo(() => L.passagesDuLivre(nœuds, { horsCorps }), [nœuds, horsCorps]);
  const sansTexte = useMemo(() => nœuds.filter((n) => (horsCorps || n.zone === "corps") && !(n.texte || "").trim() && n.type !== "partie").length, [nœuds, horsCorps]);
  const rep = useMemo(() => L.repérer(passages, L.analyserTermes(termes)), [passages, termes]);
  const d = useMemo(() => L.devis(rep.candidats), [rep]);
  const catégories = useMemo(() => L.analyserCatégories(cats), [cats]);

  useEffect(() => { écrire(projetId, { question, termes, cats, relevé }); }, [projetId, question, termes, cats, relevé]);

  const modèleCourt = async () => { const m = (await chargerModeles()).find((x) => /haiku/i.test(x.id)); return m?.id || null; };

  const proposerTermes = async () => {
    if (!question.trim()) { setErreur("Écrivez d'abord votre question."); return; }
    setErreur(null); setOccupé("termes");
    try {
      const { texte } = await appelClaude(L.construireConsigneTermes(), question.trim(), 400, undefined, null, await modèleCourt());
      const t = L.analyserTermesProposés(texte);
      if (!t) throw new Error("L'IA n'a proposé aucun mot exploitable : saisissez-les vous-même.");
      setTermes(t);
    } catch (e) { setErreur(e?.message || "Impossible de proposer des mots."); } finally { setOccupé(null); }
  };

  const proposerCatégories = async () => {
    if (!question.trim() || !rep.candidats.length) { setErreur("Il faut une question et au moins un passage repéré."); return; }
    setErreur(null); setOccupé("categories");
    try {
      // Échantillon réparti sur tout le livre (et non les premiers chapitres seulement).
      const pas = Math.max(1, Math.floor(rep.candidats.length / 40));
      let car = 0; const échantillon = [];
      for (let i = 0; i < rep.candidats.length && échantillon.length < 40; i += pas) { const p = rep.candidats[i]; if (car + p.texte.length > 9000) break; échantillon.push(p); car += p.texte.length; }
      const { texte } = await appelClaude(L.construireConsigneCatégories(question.trim()), L.blocPassagesPourLot(échantillon), 1200, undefined);
      const propres = L.catégoriesEnTexte(L.analyserCatégories(texte));
      if (!propres) throw new Error("L'IA n'a proposé aucune catégorie exploitable : saisissez-les vous-même.");
      setCats(propres);
    } catch (e) { setErreur(e?.message || "Impossible de proposer des catégories."); } finally { setOccupé(null); }
  };

  const lancer = async () => {
    if (!question.trim()) { setErreur("Écrivez votre question."); return; }
    if (!rep.candidats.length) { setErreur("Aucun passage ne contient ces mots."); return; }
    setErreur(null); setOccupé("releve"); setProgression({ lot: 0, lots: d.lots });
    const ctrl = new AbortController(); signalRef.current = ctrl;
    try {
      const brut = await L.lancerRelevé({
        question: question.trim(), catégories, candidats: rep.candidats, signal: ctrl.signal, detecterRefus: (t) => detecterRefus(t),
        appel: (s, u, m, sig) => appelClaude(s, u, m, sig), onProgression: setProgression,
      });
      const synthèse = L.synthétiser({ catégories, items: brut.items, candidats: rep.candidats.length, horsSujet: brut.horsSujet, écartées: brut.écartées, nonTraités: brut.nonTraités, erreurs: brut.erreurs });
      setRelevé({ ...synthèse, date: new Date().toISOString(), question: question.trim(), termes });
      setOuvertes(new Set());
    } catch (e) {
      if (e?.name === "AbortError") setErreur("Relevé annulé.");
      else { setErreur(e?.message || "Le relevé a échoué."); journaliserErreur?.("InterrogerLivre:relevé", e?.message || String(e), projetId); }
    } finally { setOccupé(null); setProgression(null); signalRef.current = null; }
  };

  const markdown = () => L.versMarkdown({ titreProjet: projetTitre, question: relevé.question, termes: relevé.termes, relevé });
  const copier = async () => { try { await navigator.clipboard.writeText(markdown()); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { setErreur("Copie impossible depuis ce navigateur."); } };
  const télécharger = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([markdown()], { type: "text/markdown;charset=utf-8" }));
    a.download = `releve-${(projetTitre || "livre").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const extrait = (c) => String(c).split(/\[…\]|…|\.\.\./)[0].trim().slice(0, 60);
  const bouton = (actif = true) => ({ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: `0.5px solid ${couleur}60`, background: actif ? `${couleur}15` : "#f3f3f3", color: actif ? couleur : "#999", cursor: actif ? "pointer" : "default", fontFamily: "inherit" });
  const trop = d.analyses > 8;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#fafafa", color: "#1a1a1a" }}>
      <div style={{ padding: "10px 12px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={onRetour} style={{ ...bouton(), padding: "4px 8px" }}>← Co-pilote</button>
        <b style={{ fontSize: 13 }}>📖 Interroger le livre</b>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.5, marginBottom: 10 }}>
          Une question posée à <b>tous les chapitres</b> : Cursus repère gratuitement les passages, vous montre le coût, puis l'IA les classe. Chaque citation est vérifiée mot pour mot dans votre texte.
        </div>

        <div style={carte}>
          <div style={titreEtape}>1. Votre question</div>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} style={champ} placeholder="Ex. : l'auteure parle de plusieurs sortes d'amour, liste-les avec des citations" />
        </div>

        <div style={carte}>
          <div style={titreEtape}>2. Mots à chercher dans le livre</div>
          <textarea value={termes} onChange={(e) => setTermes(e.target.value)} rows={2} style={champ} placeholder="amour, aim, tendresse, … (séparés par des virgules)" />
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={proposerTermes} disabled={!!occupé} style={bouton(!occupé)}>{occupé === "termes" ? "…" : "✨ Proposer des mots"}</button>
          </div>
          <div style={{ fontSize: 10.5, color: "#777", marginTop: 5, lineHeight: 1.4 }}>Un mot cherche tous les mots qui commencent ainsi (« aim » trouve aime, aimer, aimons). « =aime » cherche ce mot exact. Les nombres ci-dessous sont des passages (paragraphes), comptés sans IA.</div>
          {termes.trim() && (
            <table style={{ width: "100%", fontSize: 11.5, marginTop: 6, borderCollapse: "collapse" }}>
              <tbody>
                {Object.entries(rep.parTerme).map(([t, n]) => (
                  <tr key={t}><td style={{ padding: "1px 0", color: n ? "#1a1a1a" : "#A32D2D" }}>{t}</td><td style={{ textAlign: "right", color: n ? "#1a1a1a" : "#A32D2D" }}>{nombre(n)}{n === 0 ? " (aucun)" : ""}</td></tr>
                ))}
                <tr><td style={{ paddingTop: 4, fontWeight: 600 }}>Passages repérés</td><td style={{ paddingTop: 4, textAlign: "right", fontWeight: 600 }}>{nombre(rep.candidats.length)} / {nombre(passages.length)}</td></tr>
              </tbody>
            </table>
          )}
          <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 11, color: "#555", marginTop: 6 }}>
            <input type="checkbox" checked={horsCorps} onChange={(e) => setHorsCorps(e.target.checked)} /> Inclure aussi la réserve, les notes et les brouillons
          </label>
          {sansTexte > 0 && <div style={{ fontSize: 10.5, color: "#854F0B", marginTop: 4 }}>⚠ {sansTexte} chapitre{sansTexte > 1 ? "s" : ""} sans texte chargé : ouvrez-les une fois pour qu'ils soient lus.</div>}
        </div>

        <div style={carte}>
          <div style={titreEtape}>3. Catégories de classement</div>
          <textarea value={cats} onChange={(e) => setCats(e.target.value)} rows={5} style={champ} placeholder={"Une par ligne : « Nom : description ».\nLaissez vide pour une simple liste, ou demandez une proposition."} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button type="button" onClick={proposerCatégories} disabled={!!occupé || !rep.candidats.length} style={bouton(!occupé && !!rep.candidats.length)}>{occupé === "categories" ? "…" : "✨ Proposer des catégories"}</button>
          </div>
          <div style={{ fontSize: 10.5, color: "#777", marginTop: 5 }}>La proposition lit un échantillon réparti sur le livre (≈ 3 000 tokens). Vous la corrigez avant de lancer.</div>
        </div>

        <div style={{ ...carte, border: `0.5px solid ${trop ? "#E0B27A" : `${couleur}50`}`, background: trop ? "#FFF8EC" : "#fff" }}>
          <div style={titreEtape}>4. Devis</div>
          {rep.candidats.length ? (
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>
              <b>{nombre(d.passages)}</b> passages à lire, {nombre(d.caracteres)} caractères en {d.lots} lot{d.lots > 1 ? "s" : ""}.<br />
              Environ <b>{nombre(d.tokensTotal)} tokens</b>, soit à peu près <b>{String(d.analyses).replace(".", ",")} analyses</b> de votre quota (estimation).
              {trop && <div style={{ color: "#854F0B", marginTop: 4 }}>C'est élevé : retirez des mots peu utiles (voir les nombres plus haut) avant de lancer.</div>}
            </div>
          ) : <div style={{ fontSize: 12, color: "#888" }}>Saisissez des mots à chercher pour obtenir le devis. Le repérage est gratuit.</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" onClick={lancer} disabled={!!occupé || !rep.candidats.length || !question.trim()} style={{ ...bouton(!occupé && !!rep.candidats.length && !!question.trim()), flex: 1, fontWeight: 600 }}>
              {occupé === "releve" ? `Lecture… ${progression?.lot ?? 0}/${progression?.lots ?? d.lots}` : "▶ Lancer le relevé"}
            </button>
            {occupé === "releve" && <button type="button" onClick={() => signalRef.current?.abort()} style={bouton()}>Annuler</button>}
          </div>
        </div>

        {erreur && <div style={{ background: "#FCEBEB", color: "#A32D2D", borderRadius: 7, padding: "7px 9px", fontSize: 12, marginBottom: 10 }}>{erreur}</div>}

        {relevé && (
          <div style={carte}>
            <div style={{ ...titreEtape, fontSize: 12.5 }}>Relevé — « {relevé.question} »</div>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5, marginBottom: 6 }}>
              {nombre(relevé.lus)} passages repérés · <b>{nombre(relevé.pertinents)} retenus</b> · {nombre(relevé.horsSujet)} hors sujet
              {relevé.écartées > 0 && <> · <span style={{ color: "#A32D2D" }}>{relevé.écartées} citation{relevé.écartées > 1 ? "s" : ""} écartée{relevé.écartées > 1 ? "s" : ""} (introuvable{relevé.écartées > 1 ? "s" : ""} dans le texte)</span></>}
              {relevé.nonTraités > 0 && <> · <span style={{ color: "#A32D2D" }}>{relevé.nonTraités} passage{relevé.nonTraités > 1 ? "s" : ""} non traité{relevé.nonTraités > 1 ? "s" : ""}</span></>}
              {relevé.erreurs?.length > 0 && <div style={{ color: "#A32D2D" }}>{[...new Set(relevé.erreurs)].join(" ")}</div>}
            </div>
            <div style={{ fontSize: 10.5, color: "#777", marginBottom: 8 }}>Le classement est une lecture de l'IA : à contrôler. Seule l'existence des citations est garantie.</div>
            {relevé.parCatégorie.map((c) => {
              const ouvert = ouvertes.has(c.nom);
              return (
                <div key={c.nom} style={{ borderTop: "0.5px solid #eee", padding: "5px 0" }}>
                  <button type="button" onClick={() => setOuvertes((s) => { const n = new Set(s); n.has(c.nom) ? n.delete(c.nom) : n.add(c.nom); return n; })}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "#1a1a1a", padding: 0, display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ color: couleur }}>{ouvert ? "▾" : "▸"}</span><span style={{ flex: 1, fontWeight: 600 }}>{c.nom}</span><span style={{ color: "#555" }}>{c.n}</span>
                  </button>
                  {c.description && ouvert && <div style={{ fontSize: 10.5, color: "#777", margin: "2px 0 4px 14px" }}>{c.description}</div>}
                  {ouvert && c.items.map((i, k) => (
                    <div key={k} style={{ margin: "5px 0 5px 14px", fontSize: 11.5, lineHeight: 1.45 }}>
                      <span style={{ fontStyle: "italic" }}>« {i.citation} »</span>
                      <div style={{ fontSize: 10.5, color: "#777", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span>{i.titreNœud}, § {i.rang}</span>
                        <span style={{ background: i.nature === "NOMMÉ" ? "#E6F4EC" : "#F1EFE8", borderRadius: 8, padding: "0 6px" }}>{i.nature.toLowerCase()}</span>
                        {i.voix !== "AUTEUR" && <span style={{ background: "#FAEEDA", color: "#854F0B", borderRadius: 8, padding: "0 6px" }}>voix : {i.voix}</span>}
                        {onOuvrirPassage && <button type="button" onClick={() => onOuvrirPassage(i.nœudId, extrait(i.citation))} style={{ background: "none", border: "none", color: couleur, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, padding: 0, textDecoration: "underline" }}>voir dans le texte</button>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={copier} style={bouton()}>{copie ? "✔ Copié" : "📋 Copier le relevé"}</button>
              <button type="button" onClick={télécharger} style={bouton()}>⬇ Télécharger (.md)</button>
              <button type="button" onClick={() => { if (window.confirm("Effacer ce relevé de cet appareil ?")) setRelevé(null); }} style={{ ...bouton(), color: "#A32D2D", border: "0.5px solid #E5B5B5", background: "#fff" }}>Effacer</button>
            </div>
            <div style={{ fontSize: 10, color: "#999", marginTop: 6 }}>Gardé sur cet appareil seulement ({new Date(relevé.date).toLocaleString("fr-BE")}).</div>
          </div>
        )}
      </div>
    </div>
  );
}
