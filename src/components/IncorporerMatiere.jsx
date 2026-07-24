/**
 * CURSUS — Incorporer de la matière brute
 * Ajouté le 24/07/2026. v2 puis v3 le même jour, suite aux retours de
 * Joseph après tests successifs.
 *
 * PRINCIPE DE SÉCURITÉ NON NÉGOCIABLE : ceci reste une RECOMMANDATION,
 * jamais une insertion automatique. Chaque segment est inséré, modifié,
 * annulé ou déplacé INDIVIDUELLEMENT, à la demande explicite de l'auteur.
 *
 * v3 — nouveautés :
 * - Score de fidélité (0-100%) affiché pour CHAQUE segment, pas seulement
 *   ceux jugés douteux. Calcul heuristique par recouvrement de trigrammes
 *   de caractères entre le segment et le texte original collé — une copie
 *   exacte donne 100%, un passage reformulé ou déplacé donne un score plus
 *   bas. Ce n'est pas une preuve absolue, juste un signal utile.
 * - Aperçu cliquable du chapitre cible quand la destination est un nœud
 *   EXISTANT : les paragraphes du chapitre s'affichent, et un clic entre
 *   deux paragraphes fixe le point d'insertion exact (avant tel paragraphe,
 *   après tel autre) — plutôt que de toujours coller à la fin. Choix
 *   délibéré de limiter le clic aux frontières de paragraphes (pas au
 *   caractère près en plein milieu d'un paragraphe) pour ne jamais risquer
 *   de couper une mise en forme existante au mauvais endroit.
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
const SEUIL_SCORE_ALERTE = 90; // en dessous, le bouton "Revérifier" apparaît

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

// Score heuristique de fidélité (0-100). 100 = copie exacte retrouvée telle
// quelle dans le texte original. En dessous, calcul par recouvrement de
// trigrammes de caractères — donne un signal continu même quand le passage
// n'apparaît pas identique mot pour mot (reformulation, découpage différent).
// Ce n'est pas une preuve absolue de fidélité, juste un indicateur utile.
function scoreFidélité(segment, texteOriginal) {
  const normaliser = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const segNorm = normaliser(segment);
  const origNorm = normaliser(texteOriginal);
  if (!segNorm) return 100;
  if (origNorm.includes(segNorm)) return 100;

  const trigrammes = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const segTri = trigrammes(segNorm);
  const origTri = trigrammes(origNorm);
  if (segTri.size === 0) return 100;
  let intersection = 0;
  segTri.forEach((t) => { if (origTri.has(t)) intersection++; });
  return Math.round((intersection / segTri.size) * 100);
}

function couleurScore(score) {
  if (score >= 95) return { c: "#1D9E75", bg: "#E1F5EE" };
  if (score >= SEUIL_SCORE_ALERTE) return { c: "#BA7517", bg: "#FAEEDA" };
  return { c: "#E24B4A", bg: "#FCEBEB" };
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
2. OMETS SYSTÉMATIQUEMENT du texte de chaque segment tout titre ou intertitre du brouillon qui se contente d'annoncer le sujet de la section (ex. "Giuseppe : le prénom de l'oncle disparu" en tête de paragraphe) — ce n'est jamais de la prose à conserver, seulement un repère de structuration de l'auteur. Le segment doit commencer directement par le contenu narratif ou analytique lui-même. Chaque mot de PROSE du texte original doit apparaître dans exactement un segment (pas de perte, pas de doublon) ; seuls ces intertitres structurels peuvent être omis.
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

// Découpe le HTML d'un nœud en blocs de haut niveau (paragraphes, titres,
// citations, listes…), pour l'aperçu cliquable de positionnement.
function découperEnBlocs(html) {
  const dom = new DOMParser().parseFromString(html || "", "text/html");
  return Array.from(dom.body.children).map((el) => el.outerHTML);
}

function texteBrutDuBloc(blocHTML) {
  const dom = new DOMParser().parseFromString(blocHTML, "text/html");
  return (dom.body.textContent || "").trim();
}

export default function IncorporerMatiere({ projet, onFermer, onStructureChangée }) {
  const [texteBrut, setTexteBrut] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [segments, setSegments] = useState(null); // null = pas encore analysé
  const [structureActuelle, setStructureActuelle] = useState(projet.structure || []);
  const [actionEnCours, setActionEnCours] = useState(null);
  const [aperçuOuvertPour, setAperçuOuvertPour] = useState(null); // clé du segment dont l'aperçu de positionnement est déplié

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
        score: scoreFidélité(s.texte, texteBrut),
        statutInsertion: "propose",
        indexInsertion: null, // null = à la fin (par défaut)
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
      modifierSegment(clé, { texte: nouveauTexte, score: scoreFidélité(nouveauTexte, texteBrut) });
    } catch {
      setErreur("La revérification a échoué. Vous pouvez modifier le texte manuellement.");
    } finally {
      setActionEnCours(null);
    }
  };

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
        const blocs = découperEnBlocs(texteAvant);
        const position = segment.indexInsertion === null ? blocs.length : Math.min(segment.indexInsertion, blocs.length);
        const nouveauxBlocs = texteVersHTML(segment.texte);
        const texteAprès = blocs.slice(0, position).join("") + nouveauxBlocs + blocs.slice(position).join("");

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
        background: "#fff", borderRadius: 12, width: "min(780px, 94vw)",
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
                en segments et une destination pour chacun — vous pourrez modifier le texte, choisir l'emplacement
                exact dans le chapitre, insérer individuellement, et annuler après coup.
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
                Le score indique la fidélité au texte original collé (100% = copie exacte retrouvée telle quelle).
              </p>
              {erreur && (
                <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 12 }}>
                  {erreur}
                </div>
              )}
              {segments.map((s) => {
                const enCours = actionEnCours === s.clé;
                const sc = couleurScore(s.score);
                const nœudCible = s.typeDestination === "existant" ? trouverNœudParId(structureActuelle, s.idCible) : null;
                const blocsCible = nœudCible ? découperEnBlocs(nœudCible.texte) : [];
                const aperçuOuvert = aperçuOuvertPour === s.clé;

                return (
                  <div key={s.clé} style={{
                    border: "0.5px solid #e5e5e5", borderRadius: 8, padding: 12, marginBottom: 10,
                    background: s.statutInsertion === "insere" ? "#F0FAF6" : (s.inclus ? "#fff" : "#f7f7f7"),
                    opacity: (s.inclus || s.statutInsertion === "insere") ? 1 : 0.6,
                  }}>
                    {s.statutInsertion === "insere" ? (
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
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{
                                fontSize: 10.5, fontWeight: 600, color: sc.c, background: sc.bg,
                                borderRadius: 20, padding: "2px 8px",
                              }}>
                                Fidélité : {s.score}%
                              </span>
                              {s.score < SEUIL_SCORE_ALERTE && (
                                <button
                                  onClick={() => revérifierSegment(s.clé)}
                                  disabled={enCours}
                                  style={{ fontSize: 10.5, color: "#BA7517", background: "#FAEEDA", border: "none", borderRadius: 5, padding: "2px 8px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                                >
                                  {enCours ? "Vérification…" : "🔍 Revérifier"}
                                </button>
                              )}
                            </div>
                            <textarea
                              value={s.texte}
                              onChange={(e) => modifierSegment(s.clé, { texte: e.target.value, score: scoreFidélité(e.target.value, texteBrut) })}
                              rows={3}
                              style={{
                                width: "100%", fontSize: 12, color: "#333", lineHeight: 1.5,
                                background: "#fafafa", borderRadius: 6, padding: 8, marginBottom: 6,
                                fontFamily: "Georgia, serif", border: "0.5px solid #e5e5e5", boxSizing: "border-box", resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{s.justification}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 24, flexWrap: "wrap" }}>
                          <select
                            value={`${s.typeDestination}::${s.idCible}`}
                            onChange={(e) => {
                              const [typeDestination, idCible] = e.target.value.split("::");
                              modifierSegment(s.clé, { typeDestination, idCible, indexInsertion: null });
                              setAperçuOuvertPour(null);
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
                          {s.typeDestination === "existant" && blocsCible.length > 0 && (
                            <button
                              onClick={() => setAperçuOuvertPour(aperçuOuvert ? null : s.clé)}
                              style={{ fontSize: 11, color: "#7F77DD", background: "none", border: "0.5px solid #7F77DD40", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
                            >
                              📍 {aperçuOuvert ? "Fermer l'aperçu" : `Emplacement : ${s.indexInsertion === null ? "à la fin" : `avant §${s.indexInsertion + 1}`}`}
                            </button>
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

                        {/* Aperçu cliquable de positionnement — n'apparaît que si déplié */}
                        {aperçuOuvert && s.typeDestination === "existant" && (
                          <div style={{
                            marginTop: 10, marginLeft: 24, border: "0.5px solid #e5e5e5", borderRadius: 8,
                            padding: 10, maxHeight: 280, overflowY: "auto", background: "#fcfcfc",
                          }}>
                            <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>
                              Cliquez sur une barre <strong>+ Insérer ici</strong> pour choisir où le segment sera placé :
                            </div>
                            <BarreInsertion active={s.indexInsertion === 0} onClick={() => modifierSegment(s.clé, { indexInsertion: 0 })} />
                            {blocsCible.map((bloc, i) => (
                              <div key={i}>
                                <div style={{
                                  fontSize: 11.5, color: "#444", lineHeight: 1.5,
                                  border: "0.5px solid #eee", borderRadius: 6,
                                  padding: "6px 8px", background: "#fff",
                                }}>
                                  <span style={{ fontSize: 9.5, color: "#bbb", fontWeight: 600, marginRight: 6 }}>§{i + 1}</span>
                                  {texteBrutDuBloc(bloc).slice(0, 160) || "(bloc vide)"}
                                  {texteBrutDuBloc(bloc).length > 160 && "…"}
                                </div>
                                <BarreInsertion active={s.indexInsertion === i + 1} onClick={() => modifierSegment(s.clé, { indexInsertion: i + 1 })} />
                              </div>
                            ))}
                          </div>
                        )}
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

function BarreInsertion({ active, onClick }) {
  const [survol, setSurvol] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        margin: "3px 0", padding: "3px 8px", borderRadius: 5, cursor: "pointer",
        border: active ? "1px solid #7F77DD" : "1px dashed #ddd",
        background: active ? "#EEEDFE" : (survol ? "#f5f5ff" : "transparent"),
        transition: "all 0.1s",
      }}
      title="Cliquer pour insérer ici"
    >
      <span style={{ fontSize: 10, color: active ? "#534AB7" : "#aaa", fontWeight: active ? 600 : 400 }}>
        {active ? "✓ Insertion ici" : "+ Insérer ici"}
      </span>
    </div>
  );
}

function compterMotsMinimal(texte) {
  return texte.trim().split(/\s+/).filter(Boolean).length < 20;
}
