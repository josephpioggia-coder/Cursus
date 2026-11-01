/**
 * CURSUS — « 🧭 Questionnaire de démarrage » (01/11/2026) : l'ADN du projet, les 11 questions de niveau 1 de
 * `banque_questions` (Joseph a retrouvé la banque le 01/11/2026). Ce composant était depuis le 23/08/2026 une coquille
 * vide (il ne rendait rien : voir l'historique) — d'où « le questionnaire ne s'affiche pas et le bouton ne fait rien ».
 *
 * Une question par écran. Chaque réponse est enregistrée en passant à la suivante (`reponses_questionnaire`, sous la forme
 * { valeur }), ce que lit le Co-pilote. « Plus tard » ferme sans rien perdre. Q009b (fiction / faits réels / biographie)
 * n'est posée que si Q009 inclut « Roman ». Voir src/lib/questionnaireDemarrage.js (ordre, listes de choix).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { reponsesQuestionnaireAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { construireSections, enTexte, exporterQuestionnaireJSON, exporterQuestionnaireWord } from "../lib/exportQuestionnaireDemarrage.js";
import { AIDES, IDS_CONTEXTE, OPTIONS, SANS_AUTRE, SERIES, estComplet, STATUTS_PERSONNE, genre, joindreMultiple, joindrePersonnes, parseMultiple, parsePersonnes, questionsAPoser, seriesProposees } from "../lib/questionnaireDemarrage.js";

const COULEUR = "#7F77DD";
const entrée = { fontSize: 14, padding: "8px 10px", border: "0.5px solid #bbb", borderRadius: 8, fontFamily: "inherit", width: "100%", boxSizing: "border-box", background: "#fff", color: "#222", lineHeight: 1.5 };

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  const [questions, setQuestions] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [réponses, setRéponses] = useState({}); // { Q001: "texte" }
  const [indice, setIndice] = useState(0);
  const [serie, setSerie] = useState("base"); // « base » | « affinage » | « personnes » | null = écran des suites proposées
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annulé = false;
    (async () => {
      const [q, r] = await Promise.all([
        supabase.from("banque_questions").select("id, question, objectif, type_reponse, niveau").or(`niveau.eq.1,id.in.(${IDS_CONTEXTE.join(",")})`),
        reponsesQuestionnaireAPI.lire(projetId),
      ]);
      if (annulé) return;
      if (q.error || !q.data?.length) {
        const msg = q.error?.message || "Aucune question de niveau 1 n'est lisible (table vide ou règle de sécurité).";
        journaliserErreur("QuestionnaireIntention:chargement", msg, projetId);
        setErreurChargement(msg);
        return;
      }
      const dejà = {};
      Object.entries(r.data || {}).forEach(([id, rep]) => { dejà[id] = typeof rep === "string" ? rep : (rep?.valeur || ""); });
      setRéponses(dejà);
      setQuestions(q.data);
      // Base déjà complète : on propose directement les suites ; sinon on reprend à la première question sans réponse.
      const rep = Object.fromEntries(Object.entries(dejà).map(([k, v]) => [k, { valeur: v }]));
      if (estComplet(q.data, rep, "base")) { setSerie(null); return; }
      const liste = questionsAPoser(q.data, rep, "base");
      const premier = liste.findIndex((x) => !String(dejà[x.id] || "").trim());
      setIndice(premier === -1 ? 0 : premier);
    })();
    return () => { annulé = true; };
  }, [projetId]);

  const avecValeurs = useMemo(() => Object.fromEntries(Object.entries(réponses).map(([k, v]) => [k, { valeur: v }])), [réponses]);
  const liste = useMemo(() => (questions && serie ? questionsAPoser(questions, avecValeurs, serie) : []), [questions, avecValeurs, serie]);
  const [exportMsg, setExportMsg] = useState("");
  const exporter = async (mode) => {
    try {
      const sections = construireSections(questions, réponses);
      if (mode === "word") await exporterQuestionnaireWord(sections, projetTitre);
      else if (mode === "json") exporterQuestionnaireJSON(réponses, projetTitre);
      else { await navigator.clipboard.writeText(enTexte(sections, projetTitre)); setExportMsg("Copié dans le presse-papiers."); return; }
      setExportMsg("Fichier créé.");
    } catch (e) {
      journaliserErreur("QuestionnaireIntention:export", e?.message || String(e), projetId);
      setExportMsg(`Export impossible : ${e?.message || e}`);
    }
  };
  const suites = useMemo(() => (questions ? seriesProposees(questions, avecValeurs) : []), [questions, avecValeurs]);
  const commencer = (nom) => {
    const l = questionsAPoser(questions, avecValeurs, nom);
    const premier = l.findIndex((x) => !String(réponses[x.id] || "").trim());
    setIndice(premier === -1 ? 0 : premier); setSerie(nom); setErreur(null);
  };
  const q = liste[Math.min(indice, Math.max(liste.length - 1, 0))];
  const valeur = q ? (réponses[q.id] || "") : "";
  const fixer = (v) => { setErreur(null); setRéponses((r) => ({ ...r, [q.id]: v })); };
  // Q016 : liste de personnes, éditée en local puis rangée dans la réponse (une ligne « nom — statut » par personne).
  const [lignes, setLignes] = useState([{ nom: "", statut: "" }]);
  useEffect(() => {
    if (q?.id !== "Q016") return;
    const l = parsePersonnes(réponses.Q016);
    setLignes(l.length ? l : [{ nom: "", statut: "" }]);
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const majLignes = (suivant) => { setLignes(suivant); fixer(joindrePersonnes(suivant)); };
  const fermer = () => (onFermer || onTerminé)?.();

  const enregistrerEtAller = async (versIndice) => {
    if (!q) return;
    setEnCours(true); setErreur(null);
    if (valeur.trim()) {
      const { error } = await reponsesQuestionnaireAPI.enregistrer(projetId, q.id, valeur.trim());
      if (error) {
        setEnCours(false);
        journaliserErreur("QuestionnaireIntention:enregistrer", `${q.id} — ${error.message} (code ${error.code || "?"})`, projetId);
        setErreur(`Réponse non enregistrée : ${error.message}`);
        return;
      }
    }
    setEnCours(false);
    if (versIndice >= liste.length) { setSerie(null); return; } // série terminée : écran des suites proposées
    setIndice(Math.max(0, versIndice));
  };

  const dernier = indice >= liste.length - 1;
  const g = q ? genre(q) : null;
  const options = q ? OPTIONS[q.id] || [] : [];
  const autreAutorisé = q ? !SANS_AUTRE.has(q.id) : false;
  // Choix + « Autre » coexistent : les options cochées sont séparées du texte libre SANS rogner les espaces (sinon on ne peut pas taper « a b »).
  const morceaux = g === "multiple" || g === "choix" ? valeur.split(" ; ") : [];
  const choisis = morceaux.filter((c) => options.includes(c));
  const texteAutre = morceaux.filter((c) => c !== "" && !options.includes(c)).join(" ; ");
  const composer = (cochés, autre) => [...cochés, autre].filter(Boolean).join(" ; ");

  const bouton = (principal, actif = true) => ({
    fontSize: 14, padding: "9px 16px", borderRadius: 8, cursor: actif ? "pointer" : "default", fontFamily: "inherit", opacity: actif ? 1 : 0.5,
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? COULEUR : "#fff", color: principal ? "#fff" : "#555",
  });
  const puce = (actif) => ({ fontSize: 13.5, padding: "7px 12px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${actif ? COULEUR : "#ccc"}`, background: actif ? COULEUR : "#fff", color: actif ? "#fff" : "#444" });

  return (
    <div role="dialog" aria-label="Questionnaire de démarrage" style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", color: "#222", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "94vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>🧭 {serie ? SERIES[serie].titre : "Questionnaire de démarrage"}</div>
            {projetTitre && <div style={{ fontSize: 12, color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projetTitre}</div>}
          </div>
          <button onClick={fermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Plus tard" aria-label="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {erreurChargement && (
            <div style={{ fontSize: 13.5, color: "#b3261e", lineHeight: 1.5 }}>
              Les questions n'ont pas pu être chargées ({erreurChargement}). L'erreur est notée dans le Journal des erreurs.
            </div>
          )}
          {!questions && !erreurChargement && <div style={{ fontSize: 13.5, color: "#777" }}>Chargement…</div>}

          {questions && !serie && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>✓ Le questionnaire de base est enregistré</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.55, marginBottom: 14 }}>
                Le Co-pilote s'en sert comme ligne de conduite de ce livre. Vous pouvez aller plus loin maintenant, ou plus tard : le bouton « 🧭 Questionnaire de démarrage » de la page du livre rouvre cet écran.
              </div>
              {suites.map((x) => (
                <div key={x.serie} style={{ border: "0.5px solid #ddd", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{x.titre} <span style={{ fontWeight: 400, color: "#888", fontSize: 12.5 }}>· {x.repondues} / {x.total}</span></div>
                  <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.5, margin: "4px 0 10px" }}>
                    {x.serie === "affinage"
                      ? "Six précisions : ce qui doit primer, qui n'est pas le lecteur visé, le niveau de langage, l'audace, l'énergie émotionnelle, les malentendus à éviter."
                      : "Votre livre semble évoquer des personnes réelles : trois questions pour garder la trace des précautions (identification, noms, risques). Ce n'est pas un avis juridique."}
                  </div>
                  <button type="button" style={bouton(true)} onClick={() => commencer(x.serie)}>{x.repondues === 0 ? "Commencer" : x.repondues >= x.total ? "Revoir mes réponses" : "Continuer"}</button>
                </div>
              ))}
              <div style={{ border: "0.5px solid #ddd", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>📄 Exporter mes réponses</div>
                <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.5, margin: "4px 0 10px" }}>Un document lisible (questions + réponses) à garder, à envoyer ou à joindre à un audit CursAudit.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={bouton(true)} onClick={() => exporter("word")}>Word (.docx)</button>
                  <button type="button" style={bouton(false)} onClick={() => exporter("texte")}>Copier le texte</button>
                  <button type="button" style={bouton(false)} onClick={() => exporter("json")}>Sauvegarde (.json)</button>
                </div>
                {exportMsg && <div role="status" style={{ fontSize: 12.5, color: "#555", marginTop: 8 }}>{exportMsg}</div>}
              </div>
              {questions && !estComplet(questions, avecValeurs, "base") && (
                <button type="button" style={{ ...bouton(false), marginTop: 4 }} onClick={() => commencer("base")}>Reprendre les questions de base sans réponse</button>
              )}
            </div>
          )}

          {q && (
            <>
              <div style={{ height: 6, borderRadius: 3, background: "#eee", marginBottom: 6 }}>
                <div style={{ height: 6, borderRadius: 3, background: COULEUR, width: `${((indice + 1) / liste.length) * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Question {indice + 1} sur {liste.length} — réponse facultative, modifiable plus tard</div>

              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>{q.question}</div>
              {(AIDES[q.id] || q.objectif) && <div style={{ fontSize: 12.5, color: "#777", marginBottom: 12, lineHeight: 1.5 }}>{AIDES[q.id] || q.objectif}</div>}

              {g === "choix" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {options.map((o) => <button key={o} type="button" aria-pressed={choisis.includes(o)} style={{ ...puce(choisis.includes(o)), textAlign: "left", borderRadius: 10 }} onClick={() => fixer(composer(choisis.includes(o) ? [] : [o], texteAutre))}>{o}</button>)}
                  {autreAutorisé && <input type="text" placeholder="Autre (précisez) — s'ajoute au choix ci-dessus" value={texteAutre} onChange={(e) => fixer(composer(choisis.slice(0, 1), e.target.value))} style={entrée} />}
                </div>
              )}
              {g === "multiple" && (
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {options.map((o) => {
                      const actif = choisis.includes(o);
                      return <button key={o} type="button" style={puce(actif)} aria-pressed={actif} onClick={() => fixer(composer(actif ? choisis.filter((c) => c !== o) : [...choisis, o], texteAutre))}>{o}</button>;
                    })}
                  </div>
                  <input type="text" placeholder="Autre (précisez)" value={texteAutre} onChange={(e) => fixer(composer(choisis, e.target.value))} style={entrée} />
                </div>
              )}
              {g === "personnes" && (
                <div>
                  {lignes.map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      <input type="text" value={l.nom} placeholder="ex. Monsieur Yves" aria-label={`Personne ${i + 1}`} onChange={(e) => majLignes(lignes.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} style={{ ...entrée, flex: "2 1 160px", width: "auto" }} />
                      <select value={l.statut} aria-label={`Statut de la personne ${i + 1}`} onChange={(e) => majLignes(lignes.map((x, j) => (j === i ? { ...x, statut: e.target.value } : x)))} style={{ ...entrée, flex: "1 1 150px", width: "auto" }}>
                        <option value="">Statut…</option>
                        {STATUTS_PERSONNE.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {lignes.length > 1 && <button type="button" aria-label={`Retirer la personne ${i + 1}`} title="Retirer" onClick={() => majLignes(lignes.filter((_, j) => j !== i))} style={{ ...puce(false), padding: "6px 10px" }}>✕</button>}
                    </div>
                  ))}
                  <button type="button" style={puce(false)} onClick={() => setLignes([...lignes, { nom: "", statut: "" }])}>+ Ajouter une personne</button>
                </div>
              )}
              {(g === "long" || g === "liste") && <textarea value={valeur} onChange={(e) => fixer(e.target.value)} rows={g === "liste" ? 6 : 5} style={{ ...entrée, resize: "vertical" }} placeholder={g === "liste" ? "Un thème par ligne" : "Votre réponse…"} />}
              {g === "court" && <input type="text" value={valeur} onChange={(e) => fixer(e.target.value)} style={entrée} placeholder="Votre réponse…" />}
              {erreur && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "#b3261e" }}>{erreur}</div>}
            </>
          )}
        </div>

        {questions && !serie && (
          <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", textAlign: "right" }}><button style={bouton(true)} onClick={() => onTerminé?.()}>Fermer</button></div>
        )}
        {q && (
          <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <button style={bouton(false)} onClick={fermer} disabled={enCours}>Plus tard</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={bouton(false, indice > 0 && !enCours)} onClick={() => enregistrerEtAller(indice - 1)} disabled={indice === 0 || enCours}>← Précédent</button>
              <button style={bouton(true, !enCours)} onClick={() => enregistrerEtAller(indice + 1)} disabled={enCours}>{enCours ? "…" : dernier ? "Terminer" : "Suivant →"}</button>
            </div>
          </div>
        )}
        {erreurChargement && (
          <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", textAlign: "right" }}><button style={bouton(false)} onClick={fermer}>Fermer</button></div>
        )}
      </div>
    </div>
  );
}
