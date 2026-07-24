/**
 * CURSUS — Incorporer de la matière brute
 * Ajouté le 24/07/2026. Revu en profondeur le 24/07/2026 (v2) suite au
 * retour de Joseph après premier test : la v1 était "tout ou rien" (un
 * seul bouton d'insertion globale, texte figé, aucun retour en arrière).
 *
 * PRINCIPE DE SÉCURITÉ NON NÉGOCIABLE : ceci reste une RECOMMANDATION,
 * jamais une insertion automatique. Chaque segment est inséré, modifié,
 * annulé ou déplacé INDIVIDUELLEMENT, à la demande explicite de l'auteur.
 *
 * v2 — nouveautés :
 * - Texte de chaque segment modifiable avant insertion
 * - Bouton "Revérifier" par segment (redemande au co-pilote de retrouver
 *   l'extrait exact dans le texte original, si le contrôle de fidélité a
 *   échoué)
 * - Insertion INDIVIDUELLE par segment (plus seulement un bloc global)
 * - Après insertion : affichage de la destination réelle, bouton "Changer
 *   d'emplacement" (annule proprement puis rouvre le segment) et bouton
 *   "Annuler l'insertion"
 * - L'annulation vérifie que le nœud cible n'a pas été modifié depuis
 *   (par un autre segment inséré ensuite) avant de restaurer l'état
 *   antérieur — sinon elle refuse plutôt que de risquer une perte de
 *   contenu.
 * - La structure du manuscrit est tenue à jour localement au fil des
 *   insertions/annulations, sans jamais fermer la fenêtre ni perdre le
 *   fil de l'analyse en cours.
 */

import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { nœudsAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";

const TYPE_ENFANT = { partie: "chapitre", chapitre: "scene", scene: "scene" };
const ICONES_TYPE = { partie: "📂", chapitre: "📄", scene: "✏️" };

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SEUIL_CARACTÈRES = 8000;

async function appelClaude(system, user, maxTokens = 4096) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("SESSION_EXPIREE");

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
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

function parserJSON(résultat) {
  const nettoyé = résultat.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(nettoyé);
  } catch {
    throw new Error("__ERREUR_PARSING__");
  }
}

function aplatirStructure(nœuds, profondeur = 0, résultat = []) {
  for (const n of nœuds) {
    résultat.push({ id: n.id, type: n.type, titre: n.titre, profondeur, texte: n.texte || "" });
    if (n.enfants?.length) aplatirStructure(n.enfants, profondeur + 1, résultat);
  }
  return résultat;
}

function trouverNœudParId(liste, id) {
  for (const n of liste) {
    if (n.id === id) return n;
    if (n.enfants?.length) {
      const trouvé = trouverNœudParId(n.enfants, id);
      if (trouvé) return trouvé;
    }
  }
  return null;
}

// Met à jour le texte d'un nœud dans une copie de la structure locale
// (immutabilité respectée), sans toucher Supabase — utilisé pour refléter
// immédiatement à l'écran une insertion/annulation déjà faite en base.
function màjTexteLocal(structure, nœudId, nouveauTexte) {
  return structure.map((n) => {
    if (n.id === nœudId) return { ...n, texte: nouveauTexte };
    if (n.enfants?.length) return { ...n, enfants: màjTexteLocal(n.enfants, nœudId, nouveauTexte) };
    return n;
  });
}

function ajouterNœudLocal(structure, parentId, nouveauNœud) {
  return structure.map((n) => {
    if (n.id === parentId) return { ...n, enfants: [...(n.enfants || []), nouveauNœud] };
    if (n.enfants?.length) return { ...n, enfants: ajouterNœudLocal(n.enfants, parentId, nouveauNœud) };
    return n;
  });
}

function supprimerNœudLocal(structure, nœudId) {
  return structure
    .filter((n) => n.id !== nœudId)
    .map((n) => n.enfants?.length ? { ...n, enfants: supprimerNœudLocal(n.enfants, nœudId) } : n);
}

function segmentEstFidèle(segment, texteOriginal) {
  const normaliser = (s) => s.replace(/\s+/g, " ").trim();
  return normaliser(texteOriginal).includes(normaliser(segment).slice(0, 200));
}

function construireContexteStructure(nœudsPlats) {
  return nœudsPlats
    .map((n) => `${"  ".repeat(n.profondeur)}${ICONES_TYPE[n.type]} ${n.titre} [id:${n.id}]`)
    .join("\n");
}

const PROMPT_SEGMENTATION = (contexteStructure, texteAuteur) => `Tu es le co-pilote d'un écrivain travaillant sur un manuscrit structuré en Parties, Chapitres et Scènes. Voici la structure actuelle complète du manuscrit (identifiants entre crochets) :

${contexteStructure}

L'auteur vient de coller un texte brut (notes, brouillon, transcription) qu'il souhaite intégrer à ce manuscrit. Ton rôle : découper ce texte en segments cohérents, et pour CHAQUE segment proposer une destination.

RÈGLES IMPÉRATIVES :
1. Le champ "texte" de chaque segment doit être une COPIE EXACTE d'un passage contigu du texte original — ne reformule JAMAIS, ne résume JAMAIS, ne corrige JAMAIS la moindre virgule. Un simple copier-coller de passages, jamais une réécriture.
2. Chaque mot du texte original doit apparaître dans exactement un segment (pas de perte, pas de doublon), sauf les titres/intertitres purement structurels que l'auteur a mis dans son brouillon, que tu peux omettre du texte des segments s'ils servent uniquement à annoncer la section suivante.
3. Pour chaque segment, deux options de destination :
   - "existant" : le segment complète un nœud déjà présent dans la structure (donne son id exact dans "idCible")
   - "nouveau" : le segment mérite un nouveau nœud, à créer comme enfant d'un nœud PARENT déjà présent dans la structure (donne l'id du parent dans "idCible", et un titre court et fidèle au contenu dans "titreSuggere")
4. Justifie chaque proposition en une phrase courte.

Texte de l'auteur à segmenter :
"""
${texteAuteur}
"""

Réponds UNIQUEMENT en JSON valide :
{"segments":[{"texte":"...","typeDestination":"existant","idCible":"...","titreSuggere":null,"justification":"..."},{"texte":"...","typeDestination":"nouveau","idCible":"...","titreSuggere":"...","justification":"..."}]}`;

const PROMPT_REVERIFICATION = (texteOriginal, passageProposé) => `Voici un texte original complet, et un passage censé en être un extrait EXACT (copié-collé, sans aucune reformulation) :

TEXTE ORIGINAL COMPLET :
"""
${texteOriginal}
"""

PASSAGE PROPOSÉ (censé être un extrait exact) :
"""
${passageProposé}
"""

Le passage proposé est-il un extrait exact et fidèle du texte original (aux espaces/retours à la ligne près) ? Si oui, renvoie-le tel quel. Si non — s'il a été reformulé, résumé ou modifié — retrouve et renvoie l'extrait le plus proche et le plus pertinent qui EST réellement présent mot pour mot dans le texte original. Réponds UNIQUEMENT en JSON valide :
{"texteCorrige":"..."}`;

function texteVersHTML(texte) {
  return texte
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function IncorporerMatiere({ projet, onFermer, onStructureChangée }) {
  const [texteBrut, setTexteBrut] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [segments, setSegments] = useState(null); // null = pas encore analysé
  const [structureActuelle, setStructureActuelle] = useState(projet.structure || []);
  const [actionEnCours, setActionEnCours] = useState(null); // clé du segment en cours de traitement

  const nœudsPlats = aplatirStructure(structureActuelle);
  const nœudsPouvantRecevoirNouveau = nœudsPlats.filter((n) => TYPE_ENFANT[n.type]);

  const analyser = async () => {
    setErreur(null);
    setAnalyseEnCours(true);
    try {
      const contexteStructure = construireContexteStructure(nœudsPlats);
      const résultat = await appelClaude(
        "Réponds en français. (Les clés JSON restent telles quelles.)",
        PROMPT_SEGMENTATION(contexteStructure, texteBrut)
      );
      const p = parserJSON(résultat);
      const segmentsAvecÉtat = (p.segments || []).map((s, i) => ({
        clé: `seg-${i}`,
        texte: s.texte,
        typeDestination: s.typeDestination,
        idCible: s.idCible,
        titreSuggere: s.titreSuggere,
        justification: s.justification,
        inclus: true,
        fidèle: segmentEstFidèle(s.texte, texteBrut),
        statutInsertion: "propose", // "propose" | "insere"
        idNœudFinal: null,
        texteAvantInsertion: null,
        texteAprèsInsertion: null,
        typeDestinationInsérée: null,
      }));
      setSegments(segmentsAvecÉtat);
    } catch (err) {
      setErreur(
        err.message === "SESSION_EXPIREE" ? "Votre session a expiré. Reconnectez-vous et réessayez."
        : err.message === "__ERREUR_PARSING__" ? "La réponse du co-pilote n'a pas pu être interprétée. Réessayez."
        : "Une erreur est survenue. Réessayez."
      );
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const modifierSegment = (clé, champs) => {
    setSegments((prev) => prev.map((s) => s.clé === clé ? { ...s, ...champs } : s));
  };

  // Redemande au co-pilote de retrouver l'extrait exact dans le texte
  // original, pour UN SEUL segment — répond au point "pourquoi ne puis-je
  // pas demander d'analyser sur place le texte proposé".
  const revérifierSegment = async (clé) => {
    const segment = segments.find((s) => s.clé === clé);
    if (!segment) return;
    setActionEnCours(clé);
    setErreur(null);
    try {
      const résultat = await appelClaude(
        "Réponds en français. (Les clés JSON restent telles quelles.)",
        PROMPT_REVERIFICATION(texteBrut, segment.texte),
        1024
      );
      const p = parserJSON(résultat);
      const nouveauTexte = p.texteCorrigé || p.texteCorrige || segment.texte;
      modifierSegment(clé, { texte: nouveauTexte, fidèle: segmentEstFidèle(nouveauTexte, texteBrut) });
    } catch {
      setErreur("La revérification a échoué. Vous pouvez modifier le texte manuellement.");
    } finally {
      setActionEnCours(null);
    }
  };

  // Insère UN segment, indépendamment des autres. Retourne silencieusement
  // si le segment n'est plus dans l'état "propose" (déjà inséré).
  const insérerSegment = async (clé) => {
    const segment = segments.find((s) => s.clé === clé);
    if (!segment || segment.statutInsertion === "insere") return;
    setActionEnCours(clé);
    setErreur(null);
    try {
      if (segment.typeDestination === "existant") {
        const nœudCible = trouverNœudParId(structureActuelle, segment.idCible);
        if (!nœudCible) throw new Error("Nœud cible introuvable — la structure a peut-être changé.");
        const texteAvant = nœudCible.texte || "";
        const texteAprès = texteAvant + texteVersHTML(segment.texte);
        const { error } = await nœudsAPI.sauvegarderTexte(segment.idCible, texteAprès);
        if (error) throw error;

        setStructureActuelle((prev) => màjTexteLocal(prev, segment.idCible, texteAprès));
        modifierSegment(clé, {
          statutInsertion: "insere",
          idNœudFinal: segment.idCible,
          texteAvantInsertion: texteAvant,
          texteAprèsInsertion: texteAprès,
          typeDestinationInsérée: "existant",
        });
      } else {
        const parent = trouverNœudParId(structureActuelle, segment.idCible);
        if (!parent) throw new Error("Nœud parent introuvable — la structure a peut-être changé.");
        const typeNouveau = TYPE_ENFANT[parent.type] || "scene";
        const ordre = (parent.enfants?.length || 0) + 1;
        const { data, error } = await nœudsAPI.créer({
          type: typeNouveau,
          titre: segment.titreSuggere || "Sans titre",
          ordre,
          parentId: parent.id,
          texte: "",
        }, projet.id);
        if (error || !data) throw error || new Error("Échec de création du nœud");

        const contenuHTML = texteVersHTML(segment.texte);
        const { error: erreurTexte } = await nœudsAPI.sauvegarderTexte(data.id, contenuHTML);
        if (erreurTexte) throw erreurTexte;

        const nouveauNœud = { id: data.id, type: typeNouveau, titre: data.titre, texte: contenuHTML, enfants: [] };
        setStructureActuelle((prev) => ajouterNœudLocal(prev, parent.id, nouveauNœud));
        modifierSegment(clé, {
          statutInsertion: "insere",
          idNœudFinal: data.id,
          texteAvantInsertion: null,
          texteAprèsInsertion: contenuHTML,
          typeDestinationInsérée: "nouveau",
        });
      }
      onStructureChangée?.();
    } catch (err) {
      journaliserErreur("IncorporerMatiere:insérerSegment", err.message || String(err), projet.id);
      setErreur(`Échec de l'insertion de ce segment : ${err.message || "erreur inconnue"}.`);
    } finally {
      setActionEnCours(null);
    }
  };

  const insérerTout = async () => {
    const àInsérer = segments.filter((s) => s.inclus && s.statutInsertion === "propose");
    for (const s of àInsérer) {
      await insérerSegment(s.clé);
    }
  };

  // Annule l'insertion d'un segment — supprime le nœud créé (cas "nouveau"),
  // ou restaure le texte antérieur du nœud complété (cas "existant"). Dans
  // ce second cas, vérifie D'ABORD que rien d'autre n'a modifié ce nœud
  // depuis (par exemple un autre segment inséré ensuite au même endroit) :
  // si le contenu actuel ne correspond plus exactement à ce qu'on attend,
  // l'annulation est refusée plutôt que de risquer d'effacer autre chose.
  const annulerInsertion = async (clé) => {
    const segment = segments.find((s) => s.clé === clé);
    if (!segment || segment.statutInsertion !== "insere") return;
    setActionEnCours(clé);
    setErreur(null);
    try {
      if (segment.typeDestinationInsérée === "nouveau") {
        const { error } = await nœudsAPI.supprimer(segment.idNœudFinal);
        if (error) throw error;
        setStructureActuelle((prev) => supprimerNœudLocal(prev, segment.idNœudFinal));
      } else {
        const nœudActuel = trouverNœudParId(structureActuelle, segment.idNœudFinal);
        if (nœudActuel?.texte !== segment.texteAprèsInsertion) {
          setErreur("Ce chapitre a été modifié depuis l'insertion de ce segment (probablement par un autre segment inséré ensuite) — annulation automatique refusée pour ne pas risquer de perdre du contenu. Vérifiez et corrigez manuellement dans l'éditeur si besoin.");
          setActionEnCours(null);
          return;
        }
        const { error } = await nœudsAPI.sauvegarderTexte(segment.idNœudFinal, segment.texteAvantInsertion);
        if (error) throw error;
        setStructureActuelle((prev) => màjTexteLocal(prev, segment.idNœudFinal, segment.texteAvantInsertion));
      }
      modifierSegment(clé, {
        statutInsertion: "propose",
        idNœudFinal: null,
        texteAvantInsertion: null,
        texteAprèsInsertion: null,
        typeDestinationInsérée: null,
      });
      onStructureChangée?.();
    } catch (err) {
      journaliserErreur("IncorporerMatiere:annulerInsertion", err.message || String(err), projet.id);
      setErreur(`Échec de l'annulation : ${err.message || "erreur inconnue"}.`);
    } finally {
      setActionEnCours(null);
    }
  };

  const trouverTitreNœud = (id) => nœudsPlats.find((n) => n.id === id)?.titre || "?";

  const texteTropVolumineux = texteBrut.length > SEUIL_CARACTÈRES;
  const auMoinsUnSegmentÀInsérer = segments?.some((s) => s.inclus && s.statutInsertion === "propose");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "min(760px, 92vw)",
        maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>📥 Incorporer de la matière</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>×</button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {segments === null ? (
            <>
              <p style={{ fontSize: 12.5, color: "#777", marginBottom: 10, lineHeight: 1.5 }}>
                Collez un texte brut (notes, brouillon, transcription). Le co-pilote proposera un découpage
                en segments et une destination pour chacun — vous pourrez modifier le texte, changer la
                destination, insérer chaque segment individuellement, et annuler après coup.
              </p>
              <textarea
                value={texteBrut}
                onChange={(e) => setTexteBrut(e.target.value)}
                placeholder="Collez votre texte ici…"
                rows={14}
                style={{
                  width: "100%", padding: 10, border: "0.5px solid #ddd", borderRadius: 8,
                  fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                  lineHeight: 1.5,
                }}
              />
              <div style={{ fontSize: 11, color: texteTropVolumineux ? "#E24B4A" : "#999", marginTop: 6 }}>
                {texteBrut.length.toLocaleString("fr-FR")} / {SEUIL_CARACTÈRES.toLocaleString("fr-FR")} caractères
                {texteTropVolumineux && " — texte trop long, scindez-le en plusieurs passages plus courts"}
              </div>
              {erreur && (
                <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginTop: 10 }}>
                  {erreur}
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: "#777", marginBottom: 14, lineHeight: 1.5 }}>
                {segments.length} segment{segments.length > 1 ? "s" : ""} proposé{segments.length > 1 ? "s" : ""}.
                Modifiez, insérez un par un ou tous ensemble — chaque insertion peut être annulée après coup.
              </p>
              {erreur && (
                <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 12 }}>
                  {erreur}
                </div>
              )}
              {segments.map((s) => {
                const enCours = actionEnCours === s.clé;
                return (
                  <div key={s.clé} style={{
                    border: "0.5px solid #e5e5e5", borderRadius: 8, padding: 12, marginBottom: 10,
                    background: s.statutInsertion === "insere" ? "#F0FAF6" : (s.inclus ? "#fff" : "#f7f7f7"),
                    opacity: (s.inclus || s.statutInsertion === "insere") ? 1 : 0.6,
                  }}>
                    {s.statutInsertion === "insere" ? (
                      // ── Segment déjà inséré ──
                      <>
                        <div style={{ fontSize: 12, color: "#1D9E75", fontWeight: 500, marginBottom: 6 }}>
                          ✓ Inséré dans {ICONES_TYPE[trouverNœudParId(structureActuelle, s.idNœudFinal)?.type] || ""} {trouverTitreNœud(s.idNœudFinal)}
                        </div>
                        <div style={{
                          fontSize: 12, color: "#555", lineHeight: 1.5, maxHeight: 60, overflowY: "auto",
                          background: "#fafafa", borderRadius: 6, padding: 8, marginBottom: 8,
                          fontFamily: "Georgia, serif",
                        }}>
                          {s.texte}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => annulerInsertion(s.clé)}
                            disabled={enCours}
                            style={{ fontSize: 11, color: "#777", background: "none", border: "0.5px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                          >
                            {enCours ? "…" : "↩ Annuler l'insertion"}
                          </button>
                          <button
                            onClick={() => annulerInsertion(s.clé)}
                            disabled={enCours}
                            title="Annule l'insertion actuelle pour pouvoir choisir une autre destination"
                            style={{ fontSize: 11, color: "#7F77DD", background: "none", border: "0.5px solid #7F77DD40", borderRadius: 6, padding: "4px 10px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                          >
                            ↷ Changer d'emplacement
                          </button>
                        </div>
                      </>
                    ) : (
                      // ── Segment proposé, pas encore inséré ──
                      <>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            checked={s.inclus}
                            onChange={(e) => modifierSegment(s.clé, { inclus: e.target.checked })}
                            style={{ marginTop: 3 }}
                            title="Inclure dans l'insertion groupée (bouton en bas)"
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <textarea
                              value={s.texte}
                              onChange={(e) => modifierSegment(s.clé, { texte: e.target.value, fidèle: segmentEstFidèle(e.target.value, texteBrut) })}
                              rows={3}
                              style={{
                                width: "100%", fontSize: 12, color: "#333", lineHeight: 1.5,
                                background: "#fafafa", borderRadius: 6, padding: 8, marginBottom: 6,
                                fontFamily: "Georgia, serif", border: "0.5px solid #e5e5e5", boxSizing: "border-box", resize: "vertical",
                              }}
                            />
                            {!s.fidèle && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 10.5, color: "#BA7517" }}>
                                  ⚠️ Ne correspond pas exactement au texte collé.
                                </span>
                                <button
                                  onClick={() => revérifierSegment(s.clé)}
                                  disabled={enCours}
                                  style={{ fontSize: 10.5, color: "#BA7517", background: "#FAEEDA", border: "none", borderRadius: 5, padding: "2px 8px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                                >
                                  {enCours ? "Vérification…" : "🔍 Revérifier"}
                                </button>
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{s.justification}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 24, flexWrap: "wrap" }}>
                          <select
                            value={`${s.typeDestination}::${s.idCible}`}
                            onChange={(e) => {
                              const [typeDestination, idCible] = e.target.value.split("::");
                              modifierSegment(s.clé, { typeDestination, idCible });
                            }}
                            style={{ fontSize: 11.5, padding: "3px 6px", border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit" }}
                          >
                            <optgroup label="Compléter un nœud existant">
                              {nœudsPlats.map((n) => (
                                <option key={n.id} value={`existant::${n.id}`}>
                                  {"  ".repeat(n.profondeur)}{ICONES_TYPE[n.type]} {n.titre}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Créer un nouveau nœud sous…">
                              {nœudsPouvantRecevoirNouveau.map((n) => (
                                <option key={n.id} value={`nouveau::${n.id}`}>
                                  {"  ".repeat(n.profondeur)}{ICONES_TYPE[n.type]} {n.titre} → nouveau {TYPE_ENFANT[n.type]}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {s.typeDestination === "nouveau" && (
                            <input
                              value={s.titreSuggere || ""}
                              onChange={(e) => modifierSegment(s.clé, { titreSuggere: e.target.value })}
                              placeholder="Titre du nouveau nœud"
                              style={{ fontSize: 11.5, padding: "3px 6px", border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", flex: 1, minWidth: 140 }}
                            />
                          )}
                          <button
                            onClick={() => insérerSegment(s.clé)}
                            disabled={enCours}
                            style={{
                              fontSize: 11.5, color: "#fff", background: "#1D9E75", border: "none",
                              borderRadius: 6, padding: "4px 12px", cursor: enCours ? "default" : "pointer",
                              fontFamily: "inherit", marginLeft: "auto",
                            }}
                          >
                            {enCours ? "Insertion…" : "Insérer ce segment"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "0.5px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {segments === null ? (
            <>
              <button onClick={onFermer} style={{ fontSize: 13, color: "#777", background: "none", border: "0.5px solid #ddd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
              <button
                onClick={analyser}
                disabled={analyseEnCours || texteTropVolumineux || compterMotsMinimal(texteBrut)}
                style={{
                  fontSize: 13, color: "#fff", background: "#7F77DD", border: "none", borderRadius: 8,
                  padding: "8px 16px", cursor: (analyseEnCours || texteTropVolumineux) ? "default" : "pointer",
                  fontFamily: "inherit", opacity: analyseEnCours ? 0.6 : 1,
                }}
              >
                {analyseEnCours ? "Analyse en cours…" : "Analyser et proposer un découpage"}
              </button>
            </>
          ) : (
            <>
              <button onClick={onFermer} style={{ fontSize: 13, color: "#777", background: "none", border: "0.5px solid #ddd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                Fermer
              </button>
              <button
                onClick={insérerTout}
                disabled={!auMoinsUnSegmentÀInsérer || actionEnCours !== null}
                style={{
                  fontSize: 13, color: "#fff", background: "#1D9E75", border: "none", borderRadius: 8,
                  padding: "8px 16px", cursor: auMoinsUnSegmentÀInsérer ? "pointer" : "default",
                  fontFamily: "inherit", opacity: auMoinsUnSegmentÀInsérer ? 1 : 0.5,
                }}
              >
                Insérer tous les segments cochés restants
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function compterMotsMinimal(texte) {
  return texte.trim().split(/\s+/).filter(Boolean).length < 20;
}
