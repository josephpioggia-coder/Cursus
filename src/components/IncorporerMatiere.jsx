/**
 * CURSUS — Incorporer de la matière brute
 * Ajouté le 24/07/2026.
 *
 * Permet de coller un texte brut (notes, brouillon, transcription de séance…)
 * et de demander au co-pilote de proposer un découpage en segments, chacun
 * avec une destination suggérée dans la structure existante du manuscrit
 * (nœud existant à compléter, ou nouveau nœud à créer sous un parent donné).
 *
 * PRINCIPE DE SÉCURITÉ NON NÉGOCIABLE (demande explicite de Joseph, 24/07) :
 * ceci est une RECOMMANDATION, jamais une insertion automatique. Rien n'est
 * écrit en base tant que l'auteur n'a pas validé explicitement, segment par
 * segment ou globalement. Le texte de chaque segment est une copie exacte
 * d'un passage du texte original — l'IA ne reformule jamais le contenu,
 * seulement où le placer. Une vérification automatique (segmentEstFidèle)
 * signale visuellement tout segment qui ne correspondrait pas mot pour mot
 * à un passage du texte collé, au cas où le modèle s'écarterait malgré
 * l'instruction.
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

async function appelClaude(system, user) {
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
      max_tokens: 4096,
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

// Aplatit la structure en liste, en gardant le niveau de profondeur (pour
// l'indentation visuelle) et en excluant rien — sert à la fois à construire
// le contexte envoyé à l'IA et les menus déroulants de destination.
function aplatirStructure(nœuds, profondeur = 0, résultat = []) {
  for (const n of nœuds) {
    résultat.push({ id: n.id, type: n.type, titre: n.titre, profondeur, texte: n.texte || "" });
    if (n.enfants?.length) aplatirStructure(n.enfants, profondeur + 1, résultat);
  }
  return résultat;
}

// Vérifie qu'un segment proposé par l'IA est bien un passage fidèle du texte
// original (normalisation légère des espaces pour tolérer les retours à la
// ligne), plutôt que de faire confiance aveuglément à l'instruction "ne pas
// reformuler". Filet de sécurité, pas une garantie absolue.
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

// Convertit un texte brut (retours à la ligne) en HTML simple à base de
// paragraphes <p>, cohérent avec ce que TipTap attend dans nœud.texte.
function texteVersHTML(texte) {
  return texte
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function IncorporerMatiere({ projet, onTerminé, onFermer }) {
  const [texteBrut, setTexteBrut] = useState("");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [insertionEnCours, setInsertionEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [segments, setSegments] = useState(null); // null = pas encore analysé

  const nœudsPlats = aplatirStructure(projet.structure || []);
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
        ...s,
        clé: `seg-${i}`,
        inclus: true,
        fidèle: segmentEstFidèle(s.texte, texteBrut),
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

  const insérerTout = async () => {
    setInsertionEnCours(true);
    setErreur(null);
    const àInsérer = segments.filter((s) => s.inclus);

    for (const segment of àInsérer) {
      try {
        if (segment.typeDestination === "existant") {
          const nœudCible = nœudsPlats.find((n) => n.id === segment.idCible);
          if (!nœudCible) continue;
          const htmlCombiné = (nœudCible.texte || "") + texteVersHTML(segment.texte);
          const { error } = await nœudsAPI.sauvegarderTexte(segment.idCible, htmlCombiné);
          if (error) throw error;
        } else {
          const parent = nœudsPlats.find((n) => n.id === segment.idCible);
          if (!parent) continue;
          const typeNouveau = TYPE_ENFANT[parent.type] || "scene";
          const parentComplet = trouverNœudParId(projet.structure || [], parent.id);
          const ordre = (parentComplet?.enfants?.length || 0) + 1;
          const { data, error } = await nœudsAPI.créer({
            type: typeNouveau,
            titre: segment.titreSuggere || "Sans titre",
            ordre,
            parentId: parent.id,
            texte: "",
          }, projet.id);
          if (error || !data) throw error || new Error("Échec de création");
          const { error: erreurTexte } = await nœudsAPI.sauvegarderTexte(data.id, texteVersHTML(segment.texte));
          if (erreurTexte) throw erreurTexte;
        }
      } catch (err) {
        journaliserErreur("IncorporerMatiere:insérerTout", err.message || String(err), projet.id);
        setErreur(`L'insertion d'un segment a échoué ("${segment.justification?.slice(0, 40)}…"). Les segments précédents ont bien été insérés. Réessayez pour celui-ci séparément si besoin.`);
        setInsertionEnCours(false);
        return;
      }
    }

    setInsertionEnCours(false);
    onTerminé?.();
  };

  // Trouve un nœud complet par son id dans l'arbre (avec ses enfants), pour
  // calculer le bon ordre d'insertion d'un nouveau nœud parmi ses futurs frères.
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

  const texteTropVolumineux = texteBrut.length > SEUIL_CARACTÈRES;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "min(720px, 92vw)",
        maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* En-tête */}
        <div style={{
          padding: "16px 20px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>📥 Incorporer de la matière</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>×</button>
        </div>

        {/* Corps */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {segments === null ? (
            <>
              <p style={{ fontSize: 12.5, color: "#777", marginBottom: 10, lineHeight: 1.5 }}>
                Collez un texte brut (notes, brouillon, transcription). Le co-pilote proposera un découpage
                en segments et une destination pour chacun dans la structure du manuscrit — rien ne sera
                inséré sans votre validation explicite, segment par segment.
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
                Vérifiez chaque destination, décochez ce que vous ne voulez pas insérer maintenant.
              </p>
              {segments.map((s) => (
                <div key={s.clé} style={{
                  border: "0.5px solid #e5e5e5", borderRadius: 8, padding: 12, marginBottom: 10,
                  background: s.inclus ? "#fff" : "#f7f7f7", opacity: s.inclus ? 1 : 0.6,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={s.inclus}
                      onChange={(e) => modifierSegment(s.clé, { inclus: e.target.checked })}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, color: "#333", lineHeight: 1.5, maxHeight: 80, overflowY: "auto",
                        background: "#fafafa", borderRadius: 6, padding: 8, marginBottom: 6,
                        fontFamily: "Georgia, serif",
                      }}>
                        {s.texte}
                      </div>
                      {!s.fidèle && (
                        <div style={{ fontSize: 10.5, color: "#BA7517", marginBottom: 6 }}>
                          ⚠️ Ce passage ne correspond pas exactement au texte collé — vérifiez avant d'insérer.
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
                  </div>
                </div>
              ))}
              {erreur && (
                <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginTop: 10 }}>
                  {erreur}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pied */}
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
              <button onClick={() => setSegments(null)} style={{ fontSize: 13, color: "#777", background: "none", border: "0.5px solid #ddd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                Recommencer
              </button>
              <button
                onClick={insérerTout}
                disabled={insertionEnCours || !segments.some((s) => s.inclus)}
                style={{
                  fontSize: 13, color: "#fff", background: "#1D9E75", border: "none", borderRadius: 8,
                  padding: "8px 16px", cursor: insertionEnCours ? "default" : "pointer",
                  fontFamily: "inherit", opacity: insertionEnCours ? 0.6 : 1,
                }}
              >
                {insertionEnCours ? "Insertion en cours…" : `Insérer ${segments.filter((s) => s.inclus).length} segment(s)`}
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
