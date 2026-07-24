/**
 * CURSUS — Incorporer de la matière brute
 * Ajouté le 24/07/2026. Refondu plusieurs fois le même jour suite aux
 * retours successifs de Joseph. v5 — refonte architecturale majeure :
 * plus d'écrans séparés (comparatif → validation → placement), tout est
 * désormais visible et modifiable dans UN SEUL espace de travail par
 * segment, avec le comparatif global toujours visible en haut.
 *
 * PRINCIPE DE SÉCURITÉ NON NÉGOCIABLE : ceci reste une RECOMMANDATION,
 * jamais une insertion automatique. Chaque segment est inséré, modifié,
 * annulé ou déplacé INDIVIDUELLEMENT, à la demande explicite de l'auteur.
 *
 * v5 — nouveautés :
 * - Un seul espace de travail par segment : texte modifiable, score de
 *   fidélité, choix de destination, positionnement précis, transition
 *   optionnelle, et insertion — tout au même endroit, plus de validation
 *   séparée avant de voir où le texte atterrit.
 * - Positionnement entre NŒUDS FRÈRES quand la destination est un NOUVEAU
 *   chapitre/scène (symétrique au positionnement entre paragraphes pour
 *   un nœud existant) : on voit les frères déjà présents sous le même
 *   parent et on choisit où le nouveau vient s'intercaler. Les frères
 *   suivants sont renumérotés en conséquence (nœudsAPI.réordonner), et
 *   l'annulation restaure leur numérotation d'origine.
 * - Transition optionnelle par segment : un bouton demande au co-pilote
 *   une phrase de liaison courte entre ce qui précède et le nouveau texte
 *   (basée sur le paragraphe/frère précédent) ; modifiable ou effaçable
 *   avant insertion, jamais générée automatiquement sans action explicite.
 * - Comparatif global (couverture, mots omis/ajoutés) toujours visible en
 *   haut de la fenêtre, dépliable pour le détail, jamais une étape
 *   obligatoire séparée.
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
const SEUIL_SCORE_ALERTE = 90;

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

// Insère un nouveau nœud à une position précise (index) parmi les enfants
// d'un parent donné — pas seulement à la fin. Nécessaire pour le
// positionnement entre frères (v5).
function insérerNœudÀPositionLocal(structure, parentId, index, nouveauNœud) {
  return structure.map((n) => {
    if (n.id === parentId) {
      const copie = [...(n.enfants || [])];
      copie.splice(index, 0, nouveauNœud);
      return { ...n, enfants: copie };
    }
    if (n.enfants?.length) return { ...n, enfants: insérerNœudÀPositionLocal(n.enfants, parentId, index, nouveauNœud) };
    return n;
  });
}

function màjOrdresEnfantsLocal(structure, parentId, ordresParId) {
  return structure.map((n) => {
    if (n.id === parentId) {
      return { ...n, enfants: (n.enfants || []).map((e) => ordresParId[e.id] !== undefined ? { ...e, ordre: ordresParId[e.id] } : e) };
    }
    if (n.enfants?.length) return { ...n, enfants: màjOrdresEnfantsLocal(n.enfants, parentId, ordresParId) };
    return n;
  });
}

function supprimerNœudLocal(structure, nœudId) {
  return structure
    .filter((n) => n.id !== nœudId)
    .map((n) => n.enfants?.length ? { ...n, enfants: supprimerNœudLocal(n.enfants, nœudId) } : n);
}

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

// VÉRIFICATION RÉELLE, pas un score de probabilité : retrouve le passage
// proposé par l'IA DIRECTEMENT dans le texte original collé, et si trouvé,
// utilise l'extrait EXACT du texte source (découpé par le code, jamais
// retapé par l'IA) — ponctuation, apostrophes, tout garanti identique
// puisqu'il s'agit littéralement du même texte, pas d'une reproduction.
// Ajouté 24/07/2026 en remplacement du simple score de similarité, suite
// au constat que faire "retaper" le texte par l'IA dans le JSON était la
// cause structurelle des écarts (apostrophes, omissions), pas juste un
// détail à corriger après coup.
function localiserSegmentDansOriginal(segmentTexte, texteOriginal) {
  const segTrim = (segmentTexte || "").trim();
  if (!segTrim) return { texte: segmentTexte, vérifié: false };

  // 1. Correspondance exacte, telle quelle.
  const indexExact = texteOriginal.indexOf(segTrim);
  if (indexExact !== -1) {
    return { texte: texteOriginal.slice(indexExact, indexExact + segTrim.length), vérifié: true };
  }

  // 2. Correspondance par ancrage début/fin — tolère une variation mineure
  // au milieu (ex. un retour à la ligne différent) sans jamais utiliser le
  // texte de l'IA : le résultat final vient toujours du texte original,
  // découpé entre les deux ancres retrouvées.
  const début = segTrim.slice(0, 30);
  const fin = segTrim.slice(-30);
  const indexDébut = texteOriginal.indexOf(début);
  const indexFin = début && fin ? texteOriginal.indexOf(fin, indexDébut >= 0 ? indexDébut : 0) : -1;
  if (indexDébut !== -1 && indexFin !== -1 && indexFin >= indexDébut) {
    return { texte: texteOriginal.slice(indexDébut, indexFin + fin.length), vérifié: true };
  }

  // 3. Aucune correspondance fiable — le texte proposé par l'IA est gardé,
  // mais explicitement marqué NON vérifié pour que ce soit visible à l'écran.
  return { texte: segmentTexte, vérifié: false };
}

function diffMots(texteA, texteB) {
  const motsA = texteA.split(/(\s+)/).filter((t) => t !== "");
  const motsB = texteB.split(/(\s+)/).filter((t) => t !== "");
  const n = motsA.length, m = motsB.length;

  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = motsA[i] === motsB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const résultat = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (motsA[i] === motsB[j]) {
      résultat.push({ type: "égal", texte: motsA[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      résultat.push({ type: "supprimé", texte: motsA[i] });
      i++;
    } else {
      résultat.push({ type: "ajouté", texte: motsB[j] });
      j++;
    }
  }
  while (i < n) { résultat.push({ type: "supprimé", texte: motsA[i] }); i++; }
  while (j < m) { résultat.push({ type: "ajouté", texte: motsB[j] }); j++; }
  return résultat;
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
1. Le champ "texte" de chaque segment doit être une COPIE EXACTE d'un passage contigu du texte original, CARACTÈRE PAR CARACTÈRE — ne reformule JAMAIS, ne résume JAMAIS, ne corrige JAMAIS la moindre virgule. Conserve impérativement les caractères de ponctuation EXACTS du texte original, notamment le type d'apostrophe utilisé (apostrophe typographique ’ ou apostrophe droite ', selon ce que l'auteur a réellement écrit) et le type de guillemets (« » ou "" ou “”) — ne les uniformise ni ne les "nettoie" jamais vers un autre style, même si cela semble plus correct typographiquement. Un simple copier-coller de passages, jamais une réécriture, pas même au niveau de la ponctuation.
2. OMETS SYSTÉMATIQUEMENT du texte de chaque segment tout titre ou intertitre du brouillon qui se contente d'annoncer le sujet de la section (ex. "Giuseppe : le prénom de l'oncle disparu" en tête de paragraphe) — ce n'est jamais de la prose à conserver, seulement un repère de structuration de l'auteur. Le segment doit commencer directement par le contenu narratif ou analytique lui-même. Chaque mot de PROSE du texte original doit apparaître dans exactement un segment (pas de perte, pas de doublon) ; seuls ces intertitres structurels peuvent être omis DU TEXTE — mais ils ne doivent JAMAIS être perdus : si le segment est destiné à un NOUVEAU nœud ("typeDestination": "nouveau"), REPRENDS CET INTERTITRE MOT POUR MOT comme valeur de "titreSuggere" (ne l'invente jamais, recopie-le exactement). L'intertitre devient ainsi le titre du nouveau chapitre/scène plutôt que la première ligne de son texte.
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

const PROMPT_TRANSITION = (contextePrécédent, débutSegment) => `Tu es le co-pilote d'un écrivain. Voici ce qui précède immédiatement l'endroit où un nouveau passage va être inséré dans le manuscrit :
"""
${contextePrécédent}
"""

Voici le début du nouveau passage qui va suivre :
"""
${débutSegment}
"""

Propose UNE SEULE phrase de transition courte et naturelle, dans un ton sobre cohérent avec le contexte, qui pourrait s'insérer entre les deux pour adoucir l'enchaînement. Ne réécris ni l'un ni l'autre passage, juste la phrase de liaison elle-même. Réponds UNIQUEMENT en JSON valide :
{"transition":"..."}`;

function texteVersHTML(texte) {
  return texte
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

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
  const [segments, setSegments] = useState(null);
  const [diff, setDiff] = useState(null);
  const [détailComparatifOuvert, setDétailComparatifOuvert] = useState(false);
  const [structureActuelle, setStructureActuelle] = useState(projet.structure || []);
  const [actionEnCours, setActionEnCours] = useState(null);
  const [aperçuOuvertPour, setAperçuOuvertPour] = useState(null);

  const nœudsPlats = aplatirStructure(structureActuelle);
  const nœudsPouvantRecevoirNouveau = nœudsPlats.filter((n) => TYPE_ENFANT[n.type]);

  const recalculerDiff = (segmentsActuels) => {
    const texteReconstitué = segmentsActuels
      .map((s) => (s.titreSuggere ? s.titreSuggere + " " : "") + s.texte)
      .join(" ");
    setDiff(diffMots(texteBrut, texteReconstitué));
  };

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
      const segmentsAvecÉtat = (p.segments || []).map((s, i) => {
        const { texte: texteVérifié, vérifié } = localiserSegmentDansOriginal(s.texte, texteBrut);
        return {
          clé: `seg-${i}`,
          texte: texteVérifié,
          origineVérifiée: vérifié,
          typeDestination: s.typeDestination,
          idCible: s.idCible,
          titreSuggere: s.titreSuggere,
          justification: s.justification,
          inclus: true,
          score: vérifié ? 100 : scoreFidélité(s.texte, texteBrut),
          statutInsertion: "propose",
          indexInsertion: null,
          transition: "",
          idNœudFinal: null,
          texteAvantInsertion: null,
          texteAprèsInsertion: null,
          typeDestinationInsérée: null,
          ordresAvantInsertion: null,
        };
      });

      setSegments(segmentsAvecÉtat);
      recalculerDiff(segmentsAvecÉtat);
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

  const recommencer = () => {
    setSegments(null);
    setDiff(null);
  };

  const modifierSegment = (clé, champs) => {
    setSegments((prev) => {
      const suivant = prev.map((s) => s.clé === clé ? { ...s, ...champs } : s);
      if ("texte" in champs || "titreSuggere" in champs) recalculerDiff(suivant);
      return suivant;
    });
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
      const texteRenvoyé = p.texteCorrigé || p.texteCorrige || segment.texte;
      const { texte: texteVérifié, vérifié } = localiserSegmentDansOriginal(texteRenvoyé, texteBrut);
      modifierSegment(clé, { texte: texteVérifié, origineVérifiée: vérifié, score: vérifié ? 100 : scoreFidélité(texteRenvoyé, texteBrut) });
    } catch {
      setErreur("La revérification a échoué. Vous pouvez modifier le texte manuellement.");
    } finally {
      setActionEnCours(null);
    }
  };

  const proposerTransition = async (clé) => {
    const segment = segments.find((s) => s.clé === clé);
    if (!segment) return;
    setActionEnCours(clé);
    setErreur(null);
    try {
      let contextePrécédent = "(début — rien ne précède)";
      if (segment.typeDestination === "existant") {
        const nœudCible = trouverNœudParId(structureActuelle, segment.idCible);
        const blocs = nœudCible ? découperEnBlocs(nœudCible.texte) : [];
        const position = segment.indexInsertion === null ? blocs.length : segment.indexInsertion;
        if (position > 0 && blocs[position - 1]) contextePrécédent = texteBrutDuBloc(blocs[position - 1]).slice(-300);
      } else {
        const parent = trouverNœudParId(structureActuelle, segment.idCible);
        const fratrie = parent?.enfants || [];
        const position = segment.indexInsertion === null ? fratrie.length : segment.indexInsertion;
        if (position > 0 && fratrie[position - 1]) contextePrécédent = `[Fin du chapitre/scène précédent : "${fratrie[position - 1].titre}"]`;
        else if (parent) contextePrécédent = `[Début de "${parent.titre}", rien avant]`;
      }
      const résultat = await appelClaude(
        "Réponds en français. (Les clés JSON restent telles quelles.)",
        PROMPT_TRANSITION(contextePrécédent, segment.texte.slice(0, 300)),
        512
      );
      const p = parserJSON(résultat);
      modifierSegment(clé, { transition: p.transition || "" });
    } catch {
      setErreur("La proposition de transition a échoué. Vous pouvez l'écrire manuellement.");
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
      const transitionHTML = segment.transition.trim() ? texteVersHTML(segment.transition.trim()) : "";

      if (segment.typeDestination === "existant") {
        const nœudCible = trouverNœudParId(structureActuelle, segment.idCible);
        if (!nœudCible) throw new Error("Nœud cible introuvable — la structure a peut-être changé.");
        const texteAvant = nœudCible.texte || "";
        const blocs = découperEnBlocs(texteAvant);
        const position = segment.indexInsertion === null ? blocs.length : Math.min(segment.indexInsertion, blocs.length);
        const nouveauContenu = transitionHTML + texteVersHTML(segment.texte);
        const texteAprès = blocs.slice(0, position).join("") + nouveauContenu + blocs.slice(position).join("");

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
        const fratrie = parent.enfants || [];
        const position = segment.indexInsertion === null ? fratrie.length : Math.min(segment.indexInsertion, fratrie.length);

        // Renumérotation séquentielle de toute la fratrie avec le nouveau
        // nœud inséré à la position choisie — plus sûr que de ne décaler
        // qu'une partie de la liste. Le "avant" est conservé pour permettre
        // une annulation propre (restauration exacte des numéros d'ordre).
        const ordresAvant = fratrie.map((f) => ({ id: f.id, ordre: f.ordre ?? 0 }));
        const fratrieAvecPlaceholder = [...fratrie];
        fratrieAvecPlaceholder.splice(position, 0, { id: "__nouveau__" });
        const nouvelOrdreParId = {};
        let ordreDuNouveau = 1;
        fratrieAvecPlaceholder.forEach((f, idx) => {
          if (f.id === "__nouveau__") ordreDuNouveau = idx + 1;
          else nouvelOrdreParId[f.id] = idx + 1;
        });

        if (Object.keys(nouvelOrdreParId).length > 0) {
          const misÀJour = Object.entries(nouvelOrdreParId).map(([id, ordre]) => ({ id, ordre }));
          const { error: erreurRéordre } = await nœudsAPI.réordonner(misÀJour);
          if (erreurRéordre) throw erreurRéordre;
        }

        const { data, error } = await nœudsAPI.créer({
          type: typeNouveau,
          titre: segment.titreSuggere || "Sans titre",
          ordre: ordreDuNouveau,
          parentId: parent.id,
          texte: "",
        }, projet.id);
        if (error || !data) throw error || new Error("Échec de création du nœud");

        const contenuHTML = transitionHTML + texteVersHTML(segment.texte);
        const { error: erreurTexte } = await nœudsAPI.sauvegarderTexte(data.id, contenuHTML);
        if (erreurTexte) throw erreurTexte;

        const nouveauNœud = { id: data.id, type: typeNouveau, titre: data.titre, texte: contenuHTML, ordre: ordreDuNouveau, enfants: [] };
        setStructureActuelle((prev) => {
          const avecOrdresMisÀJour = màjOrdresEnfantsLocal(prev, parent.id, nouvelOrdreParId);
          return insérerNœudÀPositionLocal(avecOrdresMisÀJour, parent.id, position, nouveauNœud);
        });
        modifierSegment(clé, {
          statutInsertion: "insere",
          idNœudFinal: data.id,
          texteAvantInsertion: null,
          texteAprèsInsertion: contenuHTML,
          typeDestinationInsérée: "nouveau",
          ordresAvantInsertion: ordresAvant,
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

        // Restaure la numérotation d'ordre des frères telle qu'avant l'insertion.
        if (segment.ordresAvantInsertion?.length) {
          const { error: erreurRéordre } = await nœudsAPI.réordonner(segment.ordresAvantInsertion);
          if (erreurRéordre) throw erreurRéordre;
          const ordresParId = {};
          segment.ordresAvantInsertion.forEach((o) => { ordresParId[o.id] = o.ordre; });
          const parent = trouverNœudParId(structureActuelle, segment.idCible);
          if (parent) setStructureActuelle((prev) => màjOrdresEnfantsLocal(prev, parent.id, ordresParId));
        }
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
        ordresAvantInsertion: null,
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

  const statsDiff = diff ? {
    supprimés: diff.filter((d) => d.type === "supprimé" && d.texte.trim() !== "").length,
    ajoutés: diff.filter((d) => d.type === "ajouté" && d.texte.trim() !== "").length,
  } : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "min(820px, 95vw)",
        maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>📥 Incorporer de la matière</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>×</button>
        </div>

        {segments !== null && (
          <div style={{ padding: "10px 20px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
            <div
              onClick={() => setDétailComparatifOuvert(!détailComparatifOuvert)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                padding: "6px 10px", borderRadius: 8,
                background: statsDiff.supprimés === 0 && statsDiff.ajoutés === 0 ? "#E1F5EE" : "#FAEEDA",
                color: statsDiff.supprimés === 0 && statsDiff.ajoutés === 0 ? "#1D9E75" : "#854F0B",
                fontSize: 12,
              }}
            >
              <span>
                <strong>Couverture du texte collé :</strong> {statsDiff.supprimés} mot{statsDiff.supprimés !== 1 ? "s" : ""} potentiellement omis,{" "}
                {statsDiff.ajoutés} mot{statsDiff.ajoutés !== 1 ? "s" : ""} ajouté{statsDiff.ajoutés !== 1 ? "s" : ""}
              </span>
              <span>{détailComparatifOuvert ? "▲ Masquer le détail" : "▼ Voir le détail"}</span>
            </div>
            {détailComparatifOuvert && (
              <div style={{
                marginTop: 8, border: "0.5px solid #e5e5e5", borderRadius: 8, padding: 12,
                fontSize: 12, lineHeight: 1.6, fontFamily: "Georgia, serif",
                background: "#fafafa", maxHeight: 200, overflowY: "auto",
              }}>
                {diff.map((d, i) => {
                  if (d.type === "égal") return <span key={i}>{d.texte}</span>;
                  if (d.type === "supprimé") return (
                    <span key={i} style={{ color: "#E24B4A", textDecoration: "line-through", background: "#FCEBEB" }}>{d.texte}</span>
                  );
                  return (
                    <span key={i} style={{ color: "#7F77DD", background: "#EEEDFE", fontWeight: 600 }}>{d.texte}</span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {segments === null ? (
            <>
              <p style={{ fontSize: 12.5, color: "#777", marginBottom: 10, lineHeight: 1.5 }}>
                Collez un texte brut (notes, brouillon, transcription). Le co-pilote propose un découpage en
                segments et une destination pour chacun ; chaque segment est ensuite retrouvé et vérifié
                directement dans votre texte collé (pas retapé par l'IA) avant de vous être présenté — le texte
                final utilisé est garanti identique à l'original quand cette vérification réussit.
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
                {segments.length} segment{segments.length > 1 ? "s" : ""}. Modifiez, positionnez et insérez
                chacun individuellement, ou tous ensemble en bas.
              </p>
              {erreur && (
                <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 12 }}>
                  {erreur}
                </div>
              )}
              {segments.map((s) => {
                const enCours = actionEnCours === s.clé;
                const sc = couleurScore(s.score);
                const nœudCibleExistant = s.typeDestination === "existant" ? trouverNœudParId(structureActuelle, s.idCible) : null;
                const parentPourNouveau = s.typeDestination === "nouveau" ? trouverNœudParId(structureActuelle, s.idCible) : null;
                const blocsParagraphes = nœudCibleExistant ? découperEnBlocs(nœudCibleExistant.texte) : [];
                const fratrieNouveau = parentPourNouveau?.enfants || [];
                const aperçuOuvert = aperçuOuvertPour === s.clé;
                const nbRepères = s.typeDestination === "existant" ? blocsParagraphes.length : fratrieNouveau.length;
                const positionEffective = s.indexInsertion === null ? nbRepères : s.indexInsertion;

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
                              {s.origineVérifiée ? (
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#1D9E75", background: "#E1F5EE", borderRadius: 20, padding: "2px 8px" }}>
                                  ✓ Extrait vérifié — identique au texte original
                                </span>
                              ) : (
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: sc.c, background: sc.bg, borderRadius: 20, padding: "2px 8px" }}>
                                  ⚠️ Non retrouvé tel quel — {s.score}% de similarité estimée
                                </span>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {!s.origineVérifiée && (
                                  <button
                                    onClick={() => revérifierSegment(s.clé)}
                                    disabled={enCours}
                                    style={{ fontSize: 10.5, color: "#BA7517", background: "#FAEEDA", border: "none", borderRadius: 5, padding: "2px 8px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                                  >
                                    {enCours ? "…" : "🔍 Revérifier"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <textarea
                              value={s.texte}
                              onChange={(e) => {
                                const { texte: v, vérifié } = localiserSegmentDansOriginal(e.target.value, texteBrut);
                                modifierSegment(s.clé, { texte: e.target.value, origineVérifiée: e.target.value === v ? vérifié : false, score: vérifié && e.target.value === v ? 100 : scoreFidélité(e.target.value, texteBrut) });
                              }}
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

                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 24, flexWrap: "wrap", marginBottom: 8 }}>
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
                          {nbRepères > 0 && (
                            <button
                              onClick={() => setAperçuOuvertPour(aperçuOuvert ? null : s.clé)}
                              style={{ fontSize: 11, color: "#7F77DD", background: "none", border: "0.5px solid #7F77DD40", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
                            >
                              📍 {aperçuOuvert ? "Fermer l'aperçu" : `Emplacement : ${s.indexInsertion === null ? "à la fin" : `position ${s.indexInsertion + 1}`}`}
                            </button>
                          )}
                          <button
                            onClick={() => proposerTransition(s.clé)}
                            disabled={enCours}
                            style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", border: "none", borderRadius: 6, padding: "4px 10px", cursor: enCours ? "default" : "pointer", fontFamily: "inherit" }}
                          >
                            {enCours ? "…" : "🤖 Proposer une transition"}
                          </button>
                          <button
                            onClick={() => insérerSegment(s.clé)}
                            disabled={enCours}
                            style={{
                              fontSize: 11.5, color: "#fff", background: "#1D9E75", border: "none",
                              borderRadius: 6, padding: "4px 12px", cursor: enCours ? "default" : "pointer",
                              fontFamily: "inherit", marginLeft: "auto",
                            }}
                          >
                            {enCours ? "…" : "Insérer ce segment"}
                          </button>
                        </div>

                        {(s.transition || aperçuOuvert) && (
                          <div style={{ marginLeft: 24, marginBottom: 8 }}>
                            <textarea
                              value={s.transition}
                              onChange={(e) => modifierSegment(s.clé, { transition: e.target.value })}
                              placeholder="Phrase de transition (optionnelle) — laissez vide pour ne rien ajouter"
                              rows={2}
                              style={{
                                width: "100%", fontSize: 11.5, color: "#534AB7", lineHeight: 1.5,
                                background: "#F5F4FE", borderRadius: 6, padding: 6,
                                fontFamily: "Georgia, serif", border: "0.5px dashed #7F77DD60", boxSizing: "border-box", resize: "vertical",
                              }}
                            />
                          </div>
                        )}

                        {aperçuOuvert && s.typeDestination === "existant" && (
                          <div style={{
                            marginLeft: 24, border: "0.5px solid #e5e5e5", borderRadius: 8,
                            padding: 10, maxHeight: 320, overflowY: "auto", background: "#fcfcfc",
                          }}>
                            <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>
                              Cliquez sur une barre pour choisir où le segment (en violet) sera inséré parmi les paragraphes existants :
                            </div>
                            <BarreInsertion active={positionEffective === 0} onClick={() => modifierSegment(s.clé, { indexInsertion: 0 })} />
                            {positionEffective === 0 && <AperçuSegmentInséré texte={s.texte} transition={s.transition} />}
                            {blocsParagraphes.map((bloc, i) => (
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
                                <BarreInsertion active={positionEffective === i + 1} onClick={() => modifierSegment(s.clé, { indexInsertion: i + 1 })} />
                                {positionEffective === i + 1 && <AperçuSegmentInséré texte={s.texte} transition={s.transition} />}
                              </div>
                            ))}
                          </div>
                        )}

                        {aperçuOuvert && s.typeDestination === "nouveau" && fratrieNouveau.length > 0 && (
                          <div style={{
                            marginLeft: 24, border: "0.5px solid #e5e5e5", borderRadius: 8,
                            padding: 10, maxHeight: 320, overflowY: "auto", background: "#fcfcfc",
                          }}>
                            <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>
                              Cliquez sur une barre pour choisir entre quels éléments déjà présents le nouveau {TYPE_ENFANT[parentPourNouveau?.type]} (en violet) viendra s'intercaler :
                            </div>
                            <BarreInsertion active={positionEffective === 0} onClick={() => modifierSegment(s.clé, { indexInsertion: 0 })} />
                            {positionEffective === 0 && <AperçuSegmentInséré texte={s.titreSuggere || s.texte} estTitre={!!s.titreSuggere} transition={s.transition} />}
                            {fratrieNouveau.map((frère, i) => (
                              <div key={frère.id}>
                                <div style={{
                                  fontSize: 11.5, color: "#444", lineHeight: 1.5,
                                  border: "0.5px solid #eee", borderRadius: 6,
                                  padding: "6px 8px", background: "#fff",
                                }}>
                                  {ICONES_TYPE[frère.type]} {frère.titre}
                                </div>
                                <BarreInsertion active={positionEffective === i + 1} onClick={() => modifierSegment(s.clé, { indexInsertion: i + 1 })} />
                                {positionEffective === i + 1 && <AperçuSegmentInséré texte={s.titreSuggere || s.texte} estTitre={!!s.titreSuggere} transition={s.transition} />}
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

        <div style={{ padding: "12px 20px", borderTop: "0.5px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
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
              <button onClick={recommencer} style={{ fontSize: 13, color: "#777", background: "none", border: "0.5px solid #ddd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                ↩ Recommencer
              </button>
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

function AperçuSegmentInséré({ texte, transition, estTitre }) {
  return (
    <div style={{
      background: "#EEEDFE", border: "1px solid #7F77DD", borderRadius: 6,
      padding: "8px 10px", margin: "4px 0", fontSize: 11.5, color: "#3d3580",
      lineHeight: 1.5, fontFamily: "Georgia, serif",
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#7F77DD", marginBottom: 3, fontFamily: "-apple-system, sans-serif" }}>
        ↓ NOUVEAU {estTitre ? "CHAPITRE/SCÈNE" : "SEGMENT"} ↓
      </div>
      {transition && <div style={{ fontStyle: "italic", marginBottom: 4, opacity: 0.85 }}>{transition}</div>}
      {estTitre ? <strong>{texte}</strong> : (<>{texte.slice(0, 220)}{texte.length > 220 && "…"}</>)}
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
