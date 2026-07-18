/**
 * CURSUS — Module : Co-pilote IA
 * Branché sur l'API Claude en temps réel.
 * 4 onglets : Suggestions / Personnages / Références APA / Cohérence
 *
 * Version i18n (chantier 04/07/2026) :
 * - Tous les textes d'interface passent par t('copilote.xxx')
 * - `langueProjet` est propagée à claude-prox pour que la réponse générée
 *   par l'IA soit dans la langue du projet, pas seulement l'UI autour d'elle
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";

// Plus de troncature artificielle depuis le 17/07/2026 (demande de Joseph) :
// la seule limite est ce que l'auteur choisit lui-même — la sélection
// surlignée, ou le chapitre entier. La fenêtre de contexte de Claude est
// largement suffisante pour un chapitre complet ; le seul vrai coût est le
// quota de tokens de l'auteur, qui augmente proportionnellement à la taille
// du texte envoyé (voir vérification du 15/07 : 3% du quota mensuel utilisé
// à ce stade, large marge).
const extraireTexte = (html = "") => {
  const nettoyé = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { texte: nettoyé, tronqué: false };
};

const compterMots = (html = "") =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

// ─── Appel API Claude ─────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function appelClaude(system, user, signal, maxTokens = 1000) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("SESSION_EXPIREE");
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  if (data.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
  return data.content?.[0]?.text || "";
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
// Ces prompts système restent en français : ce sont des instructions à Claude,
// pas du texte d'interface. La langue de LA RÉPONSE générée (elle, visible par
// l'utilisateur) est imposée via l'instruction de langue ajoutée dans analyser().

// Tente de parser du JSON ; si la réponse n'en est pas (par exemple un refus
// poli du modèle sur un passage sensible), affiche ce texte tel quel plutôt
// qu'une erreur technique cryptique de type "JSON.parse: unterminated string".
//
// Filet de sécurité ajouté le 17/07/2026 : depuis que la troncature d'entrée
// à 4000 caractères a été retirée, un très gros texte source peut produire
// une réponse IA plus longue, parfois coupée par le plafond de tokens de
// sortie — laissant un JSON "ouvert". réparerJSONTronqué() referme
// proprement les structures encore ouvertes plutôt que d'échouer net.
function réparerJSONTronqué(str) {
  let s = str;
  const nbGuillemets = (s.match(/(?<!\\)"/g) || []).length;
  if (nbGuillemets % 2 !== 0) s += '"'; // referme une chaîne restée ouverte
  const pile = [];
  for (const ch of s) {
    if (ch === "{" || ch === "[") pile.push(ch);
    else if (ch === "}" && pile[pile.length - 1] === "{") pile.pop();
    else if (ch === "]" && pile[pile.length - 1] === "[") pile.pop();
  }
  while (pile.length) s += pile.pop() === "{" ? "}" : "]";
  return s;
}

function parserJSON(résultat) {
  const nettoyé = résultat.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(nettoyé);
  } catch {
    try {
      return JSON.parse(réparerJSONTronqué(nettoyé));
    } catch {
      throw new Error(nettoyé.slice(0, 300) || "__ERREUR_GENERIQUE__");
    }
  }
}

const INSTRUCTION_LANGUE = {
  fr: "Réponds en français.",
  en: "Respond in English.",
};

const PROMPTS = {
  suggestions: (type) => `Tu es co-pilote d'un écrivain professionnel travaillant sur un ${type === "fiction" ? "roman" : "essai ou ouvrage de non-fiction"}. Analyse le texte et génère exactement 3 suggestions concrètes. Réponds UNIQUEMENT en JSON valide :
{"suggestions":[{"type":"suite","titre":"...","texte":"..."},{"type":"approfondissement","titre":"...","texte":"..."},{"type":"reformulation","titre":"...","texte":"..."}]}`,

  personnages: `Tu es assistant littéraire spécialisé en fiction. Extrait les personnages du texte. Réponds UNIQUEMENT en JSON valide :
{"personnages":[{"nom":"...","rôle":"...","traits":["..."],"cohérence":"ok","note":"..."}]}`,

  // Le biais linguistique des références est volontaire, pas un oubli :
  // un texte rédigé en français doit normalement s'appuyer sur la littérature
  // francophone en priorité (comme un texte anglais s'appuierait naturellement
  // sur la littérature anglo-saxonne) — sans exclure les ouvrages étrangers
  // majeurs quand aucun équivalent francophone sérieux n'existe. Ajouté le
  // 17/07/2026, à la demande de Joseph.
  références: (langueProjet) => {
    const biais = langueProjet === "fr"
      ? "Le texte analysé est rédigé en français : privilégie les publications francophones (auteurs de langue française, ou traductions françaises officielles d'ouvrages étrangers) chaque fois qu'une référence équivalente sérieuse existe. Ne cite un ouvrage non traduit en français que s'il n'existe aucun équivalent francophone valable sur ce concept précis — indique-le alors explicitement dans le champ \"pertinence\" (ex. \"aucun équivalent francophone identifié\")."
      : "Privilégie la littérature scientifique de langue anglaise, norme académique dominante pour ce type d'ouvrage.";
    return `Tu es assistant de recherche académique. Identifie les concepts qui méritent des références scientifiques ou historiques. ${biais} Propose des références réelles en format APA 7e — vérifie que l'édition citée (traducteur, éditeur, année) est exacte, pas approximative. Réponds UNIQUEMENT en JSON valide :
{"références":[{"concept":"...","apa":"...","page":"...","pertinence":"..."}]}`;
  },

  cohérence: (type) => `Tu es éditeur professionnel relisant un ${type === "fiction" ? "roman" : "essai"}. Détecte incohérences, répétitions, transitions manquantes. Réponds UNIQUEMENT en JSON valide :
{"points":[{"type":"incohérence","sévérité":"attention","description":"...","suggestion":"..."}]}`,

  // Aide au démarrage — ajouté le 18/07/2026. Jusqu'ici, le co-pilote exigeait
  // au moins 20 mots déjà écrits pour fonctionner, ce qui le rendait inutile
  // précisément au moment où l'auteur en a le plus besoin : la page blanche.
  // Ce prompt ne s'appuie sur aucun texte de l'éditeur — uniquement sur le
  // contexte ADN du projet et le titre du chapitre/partie en cours.
  demarrage: () => `Tu es le co-pilote d'un écrivain qui n'a pas encore commencé à écrire ce chapitre — la page est blanche ou presque. Ton rôle ici n'est pas d'analyser un texte existant (il n'y en a pas), mais d'aider à démarrer, en t'appuyant uniquement sur le contexte du projet fourni ci-dessus (réponses au questionnaire d'intention) et sur le titre du chapitre donné. Propose exactement 3 pistes concrètes et courtes pour amorcer précisément CE chapitre : une proposition de première phrase ou de scène d'ouverture, un angle d'attaque possible pour aborder le sujet du chapitre, et une question qui pourrait en structurer le déroulement. Reste ancré dans le ton et les thèmes déjà définis par l'auteur — ne propose rien de générique qui pourrait convenir à n'importe quel livre. Réponds UNIQUEMENT en JSON valide :
{"suggestions":[{"type":"ouverture","titre":"...","texte":"..."},{"type":"angle","titre":"...","texte":"..."},{"type":"question","titre":"...","texte":"..."}]}`,
};

function systemAvecLangue(promptBase, langueProjet, contexteADN) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  const blocADN = contexteADN
    ? `CONTEXTE DU PROJET — réponses de l'auteur au questionnaire d'intention (à respecter impérativement dans ton comportement, pas seulement à titre informatif) :\n${contexteADN}\n\n`
    : "";
  return `${blocADN}${promptBase}\n\n${instruction} (Les clés JSON restent telles quelles ; seules les valeurs textuelles sont dans cette langue.)`;
}

// Récupère les réponses au questionnaire ADN (niveau 1) pour un projet, et les
// met en forme comme bloc de contexte à injecter dans chaque prompt système du
// co-pilote. Sans ce contexte, le co-pilote ignorait totalement le rôle voulu
// (Q9), le ton (Q5), les thèmes (Q6) et les lignes rouges (Q7) — corrigé le
// 15/07/2026. Chaque réponse est plafonnée à 500 caractères pour éviter de
// gonfler démesurément le prompt (et donc le quota de tokens de l'auteur) ;
// à ajuster si ce plafond coupe des réponses importantes en pratique.
async function chargerContexteADN(projetId) {
  if (!projetId) return null;
  try {
    const { data: questions } = await supabase
      .from("banque_questions")
      .select("id, question")
      .eq("niveau", 1);
    const { data: réponses } = await supabase
      .from("reponses_questionnaire")
      .select("question_id, reponse")
      .eq("projet_id", projetId);

    if (!questions?.length || !réponses?.length) return null;

    const réponseParId = {};
    réponses.forEach((r) => { réponseParId[r.question_id] = r.reponse; });

    const lignes = questions
      .map((q) => {
        const r = réponseParId[q.id];
        if (!r?.valeur) return null;
        const texte = r.synthese || (r.valeur.length > 500 ? r.valeur.slice(0, 500) + "…" : r.valeur);
        return `- ${q.question} → ${texte}`;
      })
      .filter(Boolean);

    return lignes.length ? lignes.join("\n") : null;
  } catch {
    return null; // le co-pilote continue de fonctionner même sans ce contexte
  }
}

// ─── Composants d'affichage ───────────────────────────────────────────────────

function CarteSuggestion({ s, couleur }) {
  const icônes = { suite: "→", approfondissement: "↓", reformulation: "↺", structure: "⊞", transition: "⤷", ouverture: "✍️", angle: "🎯", question: "❓" };
  return (
    <div style={{ background: "#fff", border: `0.5px solid ${couleur}30`, borderLeft: `3px solid ${couleur}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: couleur, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{icônes[s.type] || "→"} {s.type}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a", marginBottom: 4 }}>{s.titre}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{s.texte}</div>
    </div>
  );
}

function CartePersonnage({ p }) {
  const c = { ok: "#1D9E75", attention: "#BA7517", problème: "#E24B4A" }[p.cohérence] || "#888";
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nom}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: c + "20", color: c, fontWeight: 500 }}>{p.cohérence}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{p.rôle}</div>
      {p.traits?.map(t => <span key={t} style={{ display: "inline-block", fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f0f0f0", color: "#666", marginRight: 4 }}>{t}</span>)}
      {p.note && <div style={{ fontSize: 11, color: c, marginTop: 4 }}>{p.note}</div>}
    </div>
  );
}

function CarteRéférence({ r }) {
  const { t } = useTranslation("copilote");
  const [copié, setCopié] = useState(false);
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderLeft: "3px solid #378ADD", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", marginBottom: 4 }}>{r.concept}</div>
      <div style={{ background: "#E6F1FB", borderRadius: 6, padding: "8px 10px", marginBottom: 6, fontSize: 12, color: "#0C447C", fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{r.apa}</div>
      {r.page && <div style={{ fontSize: 11, color: "#185FA5", marginBottom: 4 }}>{t("references.pageSuggeree", { page: r.page })}</div>}
      <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>{r.pertinence}</div>
      <button onClick={() => { navigator.clipboard?.writeText(r.apa); setCopié(true); setTimeout(() => setCopié(false), 2000); }}
        style={{ fontSize: 11, color: copié ? "#1D9E75" : "#185FA5", background: copié ? "#E1F5EE" : "#E6F1FB", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
        {copié ? t("references.copie") : t("references.copier")}
      </button>
    </div>
  );
}

function CarteCoherence({ p }) {
  const s = { info: { c: "#378ADD", bg: "#E6F1FB" }, attention: { c: "#BA7517", bg: "#FAEEDA" }, important: { c: "#E24B4A", bg: "#FCEBEB" } }[p.sévérité] || { c: "#888", bg: "#f0f0f0" };
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.c, fontWeight: 500, marginRight: 6 }}>{p.sévérité}</span>
      <span style={{ fontSize: 11, color: "#999" }}>{p.type}</span>
      <div style={{ fontSize: 12, color: "#1a1a1a", margin: "6px 0", lineHeight: 1.6 }}>{p.description}</div>
      {p.suggestion && <div style={{ fontSize: 12, color: "#1D9E75", fontStyle: "italic" }}>💡 {p.suggestion}</div>}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteIA({ texteActif = "", texteSélectionné = "", typeProjet = "non-fiction", couleurProjet = "#7F77DD", projetTitre = "", titreNœud = "", langueProjet = "fr", projetId = null }) {
  const { t } = useTranslation("copilote");
  const [contexteADN, setContexteADN] = useState(null);
  // true = analyser uniquement le passage surligné dans l'éditeur, s'il y en a un.
  // S'active automatiquement dès qu'une sélection substantielle apparaît (pour
  // que le comportement par défaut soit intuitif), mais reste modifiable par
  // l'auteur. Ajouté le 16/07/2026, en réponse au constat que le texte était
  // silencieusement tronqué à 4000 caractères pour les longs chapitres.
  const [analyserSélection, setAnalyserSélection] = useState(false);

  useEffect(() => {
    if (texteSélectionné && texteSélectionné.trim().length > 20) {
      setAnalyserSélection(true);
    } else if (!texteSélectionné) {
      setAnalyserSélection(false);
    }
  }, [texteSélectionné]);

  useEffect(() => {
    let annulé = false;
    chargerContexteADN(projetId).then((c) => { if (!annulé) setContexteADN(c); });
    return () => { annulé = true; };
  }, [projetId]);
  const [onglet, setOnglet] = useState("suggestions");
  const [données, setDonnées] = useState({ suggestions: null, personnages: null, références: null, cohérence: null });
  const [chargement, setChargement] = useState({});
  const [erreur, setErreur] = useState({});
  const [modeAuto, setModeAuto] = useState(false);
  const [dernièreAnalyse, setDernièreAnalyse] = useState(null);
  const abortRef = useRef(null);
  const intervalRef = useRef(null);

  const messageErreur = useCallback((err) => {
    if (err.message === "SESSION_EXPIREE") return t("erreur.sessionExpiree");
    if (err.message === "__ERREUR_GENERIQUE__") return t("erreur.generique");
    return err.message;
  }, [t]);

  const analyser = useCallback(async (ongletCible) => {
    const sourceTexte = (analyserSélection && texteSélectionné) ? texteSélectionné : texteActif;
    const { texte } = extraireTexte(sourceTexte);
    if (compterMots(sourceTexte) < 20) {
      setErreur(e => ({ ...e, [ongletCible]: t("erreur.motsInsuffisants") }));
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargement(c => ({ ...c, [ongletCible]: true }));
    setErreur(e => ({ ...e, [ongletCible]: null }));

    try {
      let résultat = "";
      const sig = abortRef.current.signal;

      if (ongletCible === "suggestions") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.suggestions(typeProjet), langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, suggestions: p.suggestions || [] }));
      } else if (ongletCible === "personnages") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.personnages, langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, personnages: p.personnages || [] }));
      } else if (ongletCible === "références") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.références(langueProjet), langueProjet, contexteADN), `Projet : ${projetTitre}\n\nTexte :\n\n${texte}`, sig, 4096);
        // Répare le JSON potentiellement tronqué
        let jsonStr = résultat.replace(/```json|```/g, "").trim();
        if (!jsonStr.endsWith("}")) jsonStr = jsonStr + ']}';
        try {
          const p = JSON.parse(jsonStr);
          setDonnées(d => ({ ...d, références: p.références || [] }));
        } catch {
          const match = jsonStr.match(/"références"\s*:\s*\[[\s\S]*\]/);
          if (match) {
            const partial = JSON.parse(`{${match[0]}}`);
            setDonnées(d => ({ ...d, références: partial.références || [] }));
          } else {
            throw new Error("__ERREUR_GENERIQUE__");
          }
        }
      } else if (ongletCible === "cohérence") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.cohérence(typeProjet), langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, cohérence: p.points || [] }));
      }

      setDernièreAnalyse(new Date().toLocaleTimeString(langueProjet === "en" ? "en-GB" : "fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, [ongletCible]: messageErreur(err) }));
      }
    } finally {
      setChargement(c => ({ ...c, [ongletCible]: false }));
    }
  }, [texteActif, texteSélectionné, analyserSélection, typeProjet, projetTitre, langueProjet, contexteADN, t, messageErreur]);

  // Aide au démarrage — ne dépend d'aucun texte de l'éditeur, uniquement du
  // contexte ADN et du titre du chapitre en cours. Ajoutée le 18/07/2026.
  const analyserDémarrage = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargement(c => ({ ...c, suggestions: true }));
    setErreur(e => ({ ...e, suggestions: null }));
    try {
      const sig = abortRef.current.signal;
      const résultat = await appelClaude(
        systemAvecLangue(PROMPTS.demarrage(), langueProjet, contexteADN),
        `Titre du chapitre ou de la partie à démarrer : ${titreNœud || "(sans titre)"}\nTitre du projet : ${projetTitre}`,
        sig, 2048
      );
      const p = parserJSON(résultat);
      setDonnées(d => ({ ...d, suggestions: p.suggestions || [] }));
      setDernièreAnalyse(new Date().toLocaleTimeString(langueProjet === "en" ? "en-GB" : "fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, suggestions: messageErreur(err) }));
      }
    } finally {
      setChargement(c => ({ ...c, suggestions: false }));
    }
  }, [titreNœud, projetTitre, langueProjet, contexteADN, messageErreur]);

  useEffect(() => {
    if (modeAuto) {
      analyser(onglet);
      intervalRef.current = setInterval(() => analyser(onglet), 600000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [modeAuto, onglet, analyser]);

  const onglets = [
    { id: "suggestions", label: t("onglets.suggestions") },
    { id: "personnages", label: t("onglets.personnages") },
    { id: "références", label: t("onglets.references") },
    { id: "cohérence", label: t("onglets.coherence") },
  ];

  const données_onglet = données[onglet];
  const enChargement = chargement[onglet];
  const erreurOnglet = erreur[onglet];

  // Avertissement préventif, AVANT le clic — ajouté le 17/07/2026 à la demande
  // de Joseph : depuis que la troncature automatique a été retirée, un texte
  // trop volumineux peut produire une réponse IA qui dépasse le plafond de
  // sortie (4096 tokens) et revient incomplète, même réparée. Plutôt que de
  // laisser l'auteur le découvrir après coup, on le bloque en amont avec un
  // message clair. Seuil de 8000 caractères choisi comme estimation prudente
  // (heuristique, pas une limite technique dure) — à ajuster si l'expérience
  // montre qu'il coupe des analyses qui se seraient bien passées, ou qu'il
  // laisse encore passer des textes trop longs.
  const SEUIL_AVERTISSEMENT = 8000;
  const { texte: sourceActuelleNettoyée } = extraireTexte(
    (analyserSélection && texteSélectionné) ? texteSélectionné : texteActif
  );
  const texteTropVolumineux = sourceActuelleNettoyée.length > SEUIL_AVERTISSEMENT;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", background: "#fafafa" }}>

      {/* En-tête */}
      <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>{t("titre")}</span>
            {dernièreAnalyse && <span style={{ fontSize: 10, color: "#999" }}>· {dernièreAnalyse}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#999" }}>{t("modeAuto.label")}</span>
            <div onClick={() => setModeAuto(!modeAuto)}
              style={{ width: 30, height: 16, borderRadius: 8, background: modeAuto ? couleurProjet : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: modeAuto ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
        </div>

        {modeAuto && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${couleurProjet}12`, border: `0.5px solid ${couleurProjet}30`, borderRadius: 6, padding: "5px 8px", marginBottom: 8, fontSize: 10.5, color: couleurProjet, lineHeight: 1.4 }}>
            <span>🔄</span>
            <span>{t("modeAuto.banniere")}</span>
          </div>
        )}

        <div style={{ display: "flex" }}>
          {onglets.map(o => (
            <button key={o.id} onClick={() => setOnglet(o.id)}
              style={{ flex: 1, padding: "6px 2px", border: "none", background: "transparent", fontFamily: "inherit", fontSize: 10, fontWeight: onglet === o.id ? 600 : 400, color: onglet === o.id ? couleurProjet : "#999", borderBottom: onglet === o.id ? `2px solid ${couleurProjet}` : "2px solid transparent", cursor: "pointer" }}>
              {o.label}
              {données[o.id] !== null && <span style={{ marginLeft: 2, opacity: 0.6 }}>({Array.isArray(données[o.id]) ? données[o.id].length : "✓"})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px" }}>
        {texteSélectionné && texteSélectionné.trim().length > 20 && (
          <>
            <div style={{
              display: "flex", gap: 6, marginBottom: 4,
              background: "#f5f5f5", borderRadius: 7, padding: 3,
            }}>
              <button
                onClick={() => setAnalyserSélection(true)}
                style={{
                  flex: 1, padding: "5px 6px", borderRadius: 5, border: "none",
                  background: analyserSélection ? "#fff" : "transparent",
                  color: analyserSélection ? couleurProjet : "#999",
                  fontWeight: analyserSélection ? 600 : 400,
                  fontSize: 10.5, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: analyserSélection ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t("selection.analyserSelection", { count: compterMots(texteSélectionné) })}
              </button>
              <button
                onClick={() => setAnalyserSélection(false)}
                style={{
                  flex: 1, padding: "5px 6px", borderRadius: 5, border: "none",
                  background: !analyserSélection ? "#fff" : "transparent",
                  color: !analyserSélection ? couleurProjet : "#999",
                  fontWeight: !analyserSélection ? 600 : 400,
                  fontSize: 10.5, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: !analyserSélection ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t("selection.analyserTout")}
              </button>
            </div>
          </>
        )}

        {texteTropVolumineux && (
          <div style={{
            background: "#FAEEDA", borderRadius: 7, padding: "8px 10px",
            fontSize: 11.5, color: "#854F0B", marginBottom: 8, lineHeight: 1.5,
          }}>
            ⚠️ {t("selection.texteTropVolumineux", { count: sourceActuelleNettoyée.length.toLocaleString("fr-FR") })}
          </div>
        )}

        <button onClick={() => analyser(onglet)} disabled={enChargement || texteTropVolumineux}
          style={{ width: "100%", padding: "7px", marginBottom: 10, background: `${couleurProjet}15`, color: couleurProjet, border: `0.5px solid ${couleurProjet}30`, borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: (enChargement || texteTropVolumineux) ? "default" : "pointer", fontFamily: "inherit", opacity: texteTropVolumineux ? 0.5 : 1 }}>
          {enChargement ? t("bouton.enCours") : modeAuto ? t("bouton.forcerAnalyse") : t("bouton.analyser")}
        </button>

        {enChargement && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#999", fontSize: 12, padding: "8px 0" }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${couleurProjet}30`, borderTopColor: couleurProjet, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {t("bouton.enCours")}
          </div>
        )}

        {erreurOnglet && !enChargement && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 8 }}>
            {erreurOnglet}
          </div>
        )}

        {!enChargement && !erreurOnglet && données_onglet === null && (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "#bbb", fontSize: 12, lineHeight: 1.7 }}>
            {onglet === "suggestions" && (
              compterMots(texteActif) < 20 ? (
                <div style={{ padding: "4px 4px 8px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>🌱</div>
                  <div style={{ marginBottom: 12 }}>{t("demarrage.description")}</div>
                  <button
                    onClick={analyserDémarrage}
                    disabled={!contexteADN}
                    style={{
                      width: "100%", padding: "8px", background: contexteADN ? `${couleurProjet}15` : "#f0f0f0",
                      color: contexteADN ? couleurProjet : "#bbb", border: `0.5px solid ${contexteADN ? couleurProjet + "30" : "#ddd"}`,
                      borderRadius: 7, fontSize: 12, fontWeight: 500,
                      cursor: contexteADN ? "pointer" : "default", fontFamily: "inherit",
                    }}
                  >
                    {t("demarrage.bouton")}
                  </button>
                  {!contexteADN && (
                    <div style={{ fontSize: 10.5, color: "#bbb", marginTop: 8, lineHeight: 1.5 }}>
                      {t("demarrage.sansADN")}
                    </div>
                  )}
                </div>
              ) : t("videEtat.suggestions")
            )}
            {onglet === "personnages" && t("videEtat.personnages")}
            {onglet === "références" && t("videEtat.references")}
            {onglet === "cohérence" && t("videEtat.coherence")}
          </div>
        )}

        {onglet === "suggestions" && Array.isArray(données_onglet) && données_onglet.map((s, i) => <CarteSuggestion key={i} s={s} couleur={couleurProjet} />)}
        {onglet === "personnages" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("personnages.aucun")}</p> : données_onglet.map((p, i) => <CartePersonnage key={i} p={p} />))}
        {onglet === "références" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("references.aucune")}</p> : données_onglet.map((r, i) => <CarteRéférence key={i} r={r} />))}
        {onglet === "cohérence" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center" }}>{t("coherence.aucunProbleme")}</p> : données_onglet.map((p, i) => <CarteCoherence key={i} p={p} />))}
      </div>
    </div>
  );
}

