/**
 * CURSAUDIT — Questionnaire de qualification (réf. 60816-01, suite, 22/08/2026)
 * ======================================================================
 * Reprend questionnaire-cursaudit-v1-specification.md (figé le 15/08/2026,
 * jamais câblé jusqu'ici — écart signalé par l'auteur du projet en relisant
 * les textes de l'écran de choix d'espace, qui décrivaient cette porte
 * d'entrée comme existante). Porte d'entrée obligatoire avant le texte à
 * auditer : "l'IA analyse un texte sans savoir ce qu'il est censé être,
 * pour qui il est écrit, ni jusqu'où elle a le droit d'intervenir" sans ce
 * cadrage (citation du document d'origine).
 *
 * FUSION AVEC LE CONTRAT D'INTENTION (réf. 60816-01, suite, 28/08/2026) —
 * signalé par l'auteur du projet : les questions "quel type de document"
 * et "ce texte est-il..." faisaient doublon avec "Nature du projet" et "Où
 * en êtes-vous" du bloc contrat d'intention. Fusionnées : la taxonomie du
 * contrat d'intention (famille/sous-catégorie) est désormais LA SEULE
 * classification du document, envoyée telle quelle comme `type_document`
 * au moteur d'analyse (qui ne fait qu'injecter cette chaîne dans son
 * prompt, aucune comparaison stricte côté serveur — vérifié). Ce qui
 * dépendait de valeurs exactes de l'ancienne liste plate a été réexprimé
 * sur la nouvelle taxonomie :
 *  - Poésie (bloque la validation, moteur non prêt) → sousCategorie === "Poésie".
 *  - Format non linéaire (message informatif, pas de blocage) → un
 *    ensemble de sous-catégories désormais plus précis que l'ancien
 *    "Format alternatif" fourre-tout (voir SOUS_CATEGORIES_NON_LINEAIRES).
 *  - Mémoire/TFE académique (bloc "établissement autorise l'IA ?") →
 *    n'existe dans AUCUNE branche de la nouvelle taxonomie (un TFE peut
 *    être un essai, un rapport, un témoignage...) : devient une case à
 *    cocher indépendante, transversale à la nature du projet.
 *  - "Autre (à préciser)" → déjà géré nativement par la taxonomie à deux
 *    niveaux (famille ET sous-catégorie peuvent valoir "Autre").
 * "Ce texte est-il..." (statut_texte) a été vérifié comme jamais lu par
 * aucune Edge Function (grep sur tout supabase/functions) — supprimé sans
 * remplacement fonctionnel, sa valeur est désormais directement celle de
 * "Où en êtes-vous" (ouEnEtesVous), plus riche et déjà présente.
 *
 * CE QUI N'EST PAS ICI (limites assumées) :
 *  - Section 6 ("préserver ma voix", comparaison à des pages de référence)
 *    — le document d'origine la marque lui-même hors périmètre, nécessite
 *    son propre stockage et sa propre logique de comparaison stylistique.
 *  - Sections 8 (niveau de preuve) et 9 (sortie attendue) — pas dupliquées
 *    ici, la note technique du document d'origine les fait correspondre
 *    directement au palier/mode et au format de rapport déjà présents dans
 *    l'écran de création (CursAudit.jsx), affichés juste après ce
 *    questionnaire.
 *
 * RESTRUCTURATION EN "BLOC DE CADRAGE ÉDITORIAL" (réf. 60816-01, suite,
 * 29/08/2026) — demande explicite de l'auteur du projet : la première
 * partie du questionnaire n'est pas une formalité avant l'audit, c'est la
 * boussole de l'audit. Un seul bloc cohérent, dans cet ordre : (1) Profil
 * de l'auteur, (2) Pourquoi/pour qui écrivez-vous, (3) Qu'attendez-vous de
 * cet audit, (4) À quoi reconnaîtrez-vous que ce projet est réussi, (5)
 * Qu'espérez-vous découvrir que vous ignorez encore, (6) la question
 * précise posée à CursAudit. "Qu'attendez-vous de cet audit ?" (FINALITES)
 * vivait auparavant HORS du bloc "Contrat d'intention" — déplacé dedans,
 * entre "Pour qui écrivez-vous" et "À quoi reconnaîtrez-vous...", pour
 * suivre cet ordre. La mention "(plusieurs choix possibles)", répétée sur
 * chaque question, remplacée par une seule ligne en tête de bloc.
 *
 * CORRECTIF, MÊME JOUR — la question précise (6) restait physiquement HORS
 * du bloc violet et, surtout, hors de `contratIntentionActuel()` : exporter
 * puis réimporter un contrat perdait cette question, pourtant la pièce la
 * plus centrale du cadrage ("si je veux exporter, j'ai besoin de cette
 * information aussi", demande explicite de l'auteur du projet). Déplacée
 * dans le bloc, juste avant les boutons Exporter/Importer, et ajoutée à
 * `contratIntentionActuel()`/`appliquerContrat()`. Garde délibérément la
 * forme d'un champ texte plutôt que de cases à cocher — les exemples
 * affichés au-dessus (formulation exacte proposée par l'auteur du projet)
 * servent d'inspiration sans "enfermer l'utilisateur" dans une liste fermée.
 *
 * Repère (question → fonction dans l'audit → type de réponse), pour
 * mémoire plutôt que pour l'UI :
 *   Profil de l'auteur          → crédibilité/contexte de l'auteur·ice   → texte libre + champs
 *   Pourquoi/pour qui écrivez   → intention + lecteur visé              → cases à cocher + "Autre"
 *   Qu'attendez-vous de l'audit → attentes vis-à-vis de CursAudit       → cases à cocher + "Autre"
 *   Critère de réussite         → ce que "réussi" veut dire pour vous   → cases à cocher + "Autre"
 *   Ce que vous espérez découvrir → angle d'analyse à explorer          → cases à cocher + "Autre"
 *   Question précise à CursAudit → question centrale posée à l'audit   → texte libre (obligatoire)
 *
 * PAS ENCORE FAIT (chantier distinct, plus large) — demande explicite de
 * l'auteur du projet : faire remonter un encadré "Cadre de lecture retenu
 * par CursAudit" (profil auteur utilisé, intention principale, lecteur
 * visé, attente principale, critère de réussite, question centrale,
 * conséquence sur l'analyse) DANS la sortie de l'audit lui-même (pré-audit
 * et/ou rapport consolidé), pas seulement dans ce formulaire. Cela suppose
 * que les Edge Functions de génération (au moins
 * preaudit-approfondi-cursaudit, potentiellement orchestrer-audit-cursaudit
 * / analyser-unite-cursaudit) lisent `contrat_intention` (actuellement
 * seul `profils_auteur` est câblé côté prompt) et produisent un champ
 * structuré dédié en sortie — portée nettement plus large qu'un
 * réagencement de formulaire, à traiter comme un chantier à part.
 *
 * CE QUE LES RÉPONSES CHANGENT RÉELLEMENT côté moteur d'analyse
 * (analyser-unite-cursaudit / orchestrer-audit-cursaudit) : la question
 * libre et le degré d'intervention sont injectés dans le prompt système
 * envoyé à l'IA pour CHAQUE unité. Mais le moteur ne produit aujourd'hui
 * qu'un diagnostic (valeur + commentaire) par critère, jamais un texte
 * réécrit séparé — les degrés "reformulation ponctuelle" et "réécriture"
 * influencent donc le CONTENU du commentaire (l'IA peut y glisser une
 * suggestion), pas une sortie dédiée. Écrire réellement à la place de
 * l'auteur⋅ice n'est pas implémenté.
 */

import { useState, useEffect } from "react";
import { auditsAPI } from "../lib/api.js";
import { nomDeFichierSûr } from "../lib/exportWord.js";
import ProfilAuteur from "./ProfilAuteur.jsx";
import {
  NATURE_PROJET, OU_EN_ETES_VOUS, OBJECTIFS, DESTINATAIRES,
  CRITERES_REUSSITE, CE_QUE_VOUS_ESPEREZ_DECOUVRIR,
} from "../lib/taxonomieContratIntentionCursAudit.js";

// Sous-catégories de la nouvelle taxonomie faites d'entrées courtes et
// autonomes plutôt que d'un fil narratif continu — remplace l'ancien
// "Format alternatif (oracle, livret de cartes, posts réseaux sociaux…)",
// plus précis puisque directement rattaché aux sous-catégories réelles
// plutôt qu'à une case fourre-tout.
const SOUS_CATEGORIES_NON_LINEAIRES = new Set([
  "Post réseaux sociaux", "Série de publications", "Livre-jeu", "Jeu narratif",
  "Jeu de rôle", "Cartes pédagogiques", "Fiction interactive",
]);

// Fusionne l'ancienne FINALITES avec ATTENTES_CURSUS du contrat d'intention
// (réf. 60816-01, suite, 28/08/2026) — signalé par l'auteur du projet :
// "structurer mes idées"/"Améliorer la structure", "rendre mon texte plus
// fluide"/"Fluidifier sans réécrire à la place", "trouver mes
// incohérences"/"Vérifier la cohérence générale", "préparer la
// publication"/"Préparer une nouvelle version" faisaient doublon.
// Dédupliqué en gardant une seule formulation par idée ; les items sans
// équivalent des deux côtés sont tous conservés (vérifications techniques
// d'audit d'un côté, objectifs plus larges/existentiels de l'autre — pas
// redondants entre eux). Alimente à la fois `finaliteAudit` (obligatoire,
// injecté dans le prompt du moteur d'analyse) et
// `contratIntention.attentesCursus` (mêmes valeurs, un seul état — voir
// `finalites` plus bas).
const FINALITES = [
  "Structurer mes idées",
  "Mieux écrire",
  "Améliorer le style",
  "Fluidifier le texte sans réécrire à ma place",
  "Vérifier la cohérence générale",
  "Vérifier mes arguments",
  "Repérer les répétitions",
  "Repérer les passages faibles",
  "Vérifier le niveau de preuve",
  "Vérifier les sources",
  "Préserver ma voix d'auteur",
  "Identifier les risques éthiques, académiques ou éditoriaux",
  "Approfondir ma réflexion",
  "Comprendre ce que j'écris",
  "Comprendre ce que je vis",
  "Mieux toucher mon lecteur",
  "Préparer la publication",
  "Tout analyser",
];

const DEGRES_INTERVENTION = [
  { id: "observer",                 label: "Observer seulement" },
  { id: "signaler",                 label: "Signaler les problèmes" },
  { id: "pistes",                   label: "Proposer des pistes" },
  { id: "reformulations_ponctuelles", label: "Proposer des reformulations ponctuelles" },
  { id: "reecrire_legerement",      label: "Réécrire légèrement" },
  { id: "reecrire_librement",       label: "Réécrire librement" },
];

const CONDITIONS_IA_ACADEMIQUE = [
  "Correction linguistique",
  "Aide à la structure",
  "Aide bibliographique",
  "Reformulation limitée",
  "Interdiction de rédaction",
  "Obligation de déclaration",
];

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 6 };
const champStyle = { width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--texte-primaire)", padding: "3px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

// Groupe de cases à cocher réutilisable — Bloc A/B du contrat d'intention
// (réf. 60816-01, suite, 28/08/2026), 6 listes différentes, même motif.
function GroupeCases({ options, valeurs, onBasculer }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
      {options.map((o) => (
        <Checkbox key={o} checked={valeurs.includes(o)} onChange={() => onBasculer(o)} label={o} />
      ))}
    </div>
  );
}

export default function CursAuditQuestionnaire({ onValider }) {
  // Contrat d'intention — réf. 60816-01, suite, 28/08/2026. Voir
  // docs/PAQUET-DE-REPRISE-2026-08-27.md, [CHANTIER-CONTRAT-INTENTION].
  // Porte désormais SEULE la classification du document (fusion du
  // 28/08/2026, voir docblock en tête de fichier) — plus de doublon avec
  // une ancienne liste plate de types de documents.
  const [ouEnEtesVous, setOuEnEtesVous] = useState("");
  const [famille, setFamille] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");
  const [natureAutre, setNatureAutre] = useState("");
  const [objectifs, setObjectifs] = useState([]);
  const [destinataires, setDestinataires] = useState([]);
  const [criteresReussite, setCriteresReussite] = useState([]);
  const [ceQueVousEspérezDécouvrir, setCeQueVousEspérezDécouvrir] = useState([]);
  const [contratsPrécédents, setContratsPrécédents] = useState(null);
  const [contratChoisi, setContratChoisi] = useState("");

  useEffect(() => {
    auditsAPI.listerContratsIntention().then(({ data }) => setContratsPrécédents(data || []));
  }, []);

  const sousCategoriesDisponibles = NATURE_PROJET.find((f) => f.famille === famille)?.sousCategories ?? [];

  const appliquerContrat = (c) => {
    if (!c) return;
    setOuEnEtesVous(c.ouEnEtesVous || "");
    setFamille(c.natureProjet?.famille || "");
    setSousCategorie(c.natureProjet?.sousCategorie || "");
    setNatureAutre(c.natureProjet?.autre || "");
    setObjectifs(c.objectifs || []);
    setDestinataires(c.destinataires || []);
    // attentesCursus fusionné dans finalites le 28/08/2026 — un contrat
    // exporté avant cette date peut encore avoir attentesCursus séparé,
    // on le récupère quand même plutôt que de perdre l'info.
    if (c.attentesCursus?.length > 0) setFinalites((f) => [...new Set([...f, ...c.attentesCursus])]);
    setCriteresReussite(c.criteresReussite || []);
    setCeQueVousEspérezDécouvrir(c.ceQueVousEspérezDécouvrir || []);
    // Réf. 60816-01, suite, 29/08/2026 — signalé par l'auteur du projet :
    // exporter un contrat sans la question précise fait perdre l'information
    // la plus centrale ("boussole de l'audit") en cas de réimport. Ajoutée
    // au contrat lui-même plutôt que de rester un champ isolé, à part.
    setQuestionLibre(c.questionLibre || "");
  };

  const choisirContratPrécédent = (id) => {
    setContratChoisi(id);
    const trouvé = contratsPrécédents?.find((a) => a.id === id);
    if (trouvé) appliquerContrat(trouvé.contrat_intention);
  };

  const contratIntentionActuel = () => ({
    ouEnEtesVous,
    natureProjet: { famille, sousCategorie, autre: famille === "Autre" ? natureAutre : "" },
    objectifs, destinataires,
    // Fusionné avec "Que veux-tu obtenir ?" le 28/08/2026 (doublon signalé
    // par l'auteur du projet) — mêmes valeurs que `finalites`, pas un
    // second état séparé.
    attentesCursus: finalites,
    criteresReussite,
    ceQueVousEspérezDécouvrir,
    // Ajouté le 29/08/2026 (voir appliquerContrat) — sans ce champ, exporter
    // puis réimporter un contrat perdait la question précise posée à
    // CursAudit, pourtant la pièce la plus centrale du cadrage.
    questionLibre: questionLibre.trim(),
  });

  const exporterContratJSON = () => {
    const blob = new Blob([JSON.stringify(contratIntentionActuel(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `contrat_intention_${nomDeFichierSûr(famille || "brouillon")}.json`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const importerContratJSON = (fichier) => {
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        appliquerContrat(JSON.parse(lecteur.result));
      } catch {
        setErreur("Fichier JSON invalide — impossible de lire ce contrat d'intention.");
      }
    };
    lecteur.readAsText(fichier);
  };

  const [finalites, setFinalites] = useState([]);
  const [questionLibre, setQuestionLibre] = useState("");
  const [degreIntervention, setDegreIntervention] = useState("");
  // Travail académique — réf. 60816-01, suite, 28/08/2026. Devenu une case
  // à cocher indépendante lors de la fusion avec le contrat d'intention :
  // un mémoire/TFE peut relever de n'importe quelle famille de la
  // taxonomie (essai, témoignage, rapport...), ce n'est pas une nature de
  // projet en soi mais une contrainte transversale.
  const [estTravailAcademique, setEstTravailAcademique] = useState(false);
  const [autorisationIA, setAutorisationIA] = useState("");
  const [conditionsIA, setConditionsIA] = useState([]);
  const [adresse, setAdresse] = useState("tu");
  const [ton, setTon] = useState("direct");
  const [posture, setPosture] = useState("accompagnant");
  const [longueur, setLongueur] = useState("détaillé");
  const [role, setRole] = useState("lecteur expert");
  const [erreur, setErreur] = useState(null);

  // Poésie et format non linéaire — réexprimés sur la nouvelle taxonomie
  // (voir docblock en tête de fichier) au lieu de l'ancienne liste plate.
  const estPoésie = sousCategorie === "Poésie";
  const estFormatNonLinéaire = SOUS_CATEGORIES_NON_LINEAIRES.has(sousCategorie);
  const natureRenseignée = famille === "Autre" ? !!natureAutre.trim() : !!(famille && (sousCategorie || sousCategoriesDisponibles.length === 0));

  const basculerFinalité = (f) => setFinalites((liste) => liste.includes(f) ? liste.filter((x) => x !== f) : [...liste, f]);
  const basculerCondition = (c) => setConditionsIA((liste) => liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);
  // Bloc du contrat d'intention : un seul générateur de bascule pour les 5
  // listes à cases multiples, plutôt que 5 fonctions identiques.
  const basculeur = (setListe) => (valeur) => setListe((l) => l.includes(valeur) ? l.filter((x) => x !== valeur) : [...l, valeur]);

  const valider = () => {
    if (estPoésie) {
      setErreur("La poésie est un type de projet à l'étude chez Cursus, pas encore disponible — voir le message dans \"Nature du projet\".");
      return;
    }
    if (!natureRenseignée || !ouEnEtesVous || finalites.length === 0 || !questionLibre.trim() || !degreIntervention) {
      setErreur("Merci de compléter la nature du projet, où vous en êtes, ce que vous voulez obtenir et la question libre avant de continuer.");
      return;
    }
    const typeDocument = famille === "Autre" ? natureAutre.trim() : (sousCategorie ? `${sousCategorie} (${famille})` : famille);
    onValider({
      typeDocument,
      statutTexte: ouEnEtesVous,
      finaliteAudit: finalites,
      questionLibre: questionLibre.trim(),
      degreIntervention,
      contraintesAcademiques: estTravailAcademique ? { autorisationIA, conditions: conditionsIA } : null,
      relationIA: { adresse, ton, posture, longueur, role },
      contratIntention: contratIntentionActuel(),
    });
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--texte-primaire)", marginBottom: 4 }}>
          Avant de commencer — quelques questions sur votre audit
        </div>
        <p style={{ fontSize: 12.5, color: "var(--texte-tertiaire)", lineHeight: 1.6 }}>
          Sans ce cadrage, l'IA analyse un texte sans savoir ce qu'il est censé être,
          pour qui il est écrit, ni jusqu'où elle a le droit d'intervenir.
        </p>
      </div>

      {/* Note de continuité profil/projet — réf. 60816-01, suite,
          29/08/2026, demande explicite de l'auteur du projet : présentée
          comme une continuité d'accompagnement, jamais comme une
          obligation. Explique la portée réelle des deux blocs qui suivent
          (ProfilAuteur = niveau compte, réutilisable dans CursAudit ET
          CursEdit ; contrat d'intention = niveau projet, associé à CE
          texte, repris plus tard dans CursEdit pour ce même manuscrit —
          bridge CursAudit↔CursEdit pas encore construit à ce jour, mais
          cette note fixe l'intention produit dès maintenant). */}
      <div style={{ background: "var(--fond, #F7F4EF)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--texte-secondaire)", lineHeight: 1.7, margin: 0 }}>
          Ces informations servent de cadre de travail.
          <br /><br />
          Votre profil auteur pourra être réutilisé dans vos futurs projets Cursus.
          <br /><br />
          Les informations propres à ce projet resteront associées à ce texte et pourront être reprises
          plus tard dans CursEdit pour accompagner l'écriture, la réécriture ou la structuration du
          manuscrit.
          <br /><br />
          Vous pourrez les modifier à tout moment.
        </p>
      </div>

      <ProfilAuteur />

      {/* Contrat d'intention — réf. 60816-01, suite, 28/08/2026, fusionné
          avec l'ancienne classification "type de document" le même jour
          (voir docblock en tête de fichier). Seul bloc qui classe le
          document désormais. */}
      <div style={{ background: "#F7F6FD", border: "0.5px solid #7F77DD80", borderRadius: 10, padding: "16px 18px", display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#5B52C4", marginBottom: 4 }}>
            Contrat d'intention
          </div>
          <p style={{ fontSize: 12, color: "var(--texte-tertiaire)", lineHeight: 1.6 }}>
            Pas "quel genre de livre", mais "quelle transformation cherchez-vous". Sert de brief déclaré
            à l'audit, en plus de ce que l'IA déduit du texte lui-même.
          </p>
          <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", fontStyle: "italic", marginTop: 6 }}>
            Certaines questions ci-dessous permettent plusieurs réponses. Vous pouvez aussi choisir
            « Autre » et préciser librement.
          </p>
        </div>

        {contratsPrécédents && contratsPrécédents.length > 0 && (
          <div>
            <label style={labelStyle}>Réutiliser les réponses d'un audit précédent</label>
            <select style={champStyle} value={contratChoisi} onChange={(e) => choisirContratPrécédent(e.target.value)}>
              <option value="">— Ne pas réutiliser —</option>
              {contratsPrécédents.map((c) => (
                <option key={c.id} value={c.id}>{c.titre} ({new Date(c.cree_le).toLocaleDateString("fr-FR")})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>Où en êtes-vous dans ce projet ? *</label>
          <select style={champStyle} value={ouEnEtesVous} onChange={(e) => setOuEnEtesVous(e.target.value)}>
            <option value="">— Choisir —</option>
            {OU_EN_ETES_VOUS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Nature du projet *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select style={champStyle} value={famille} onChange={(e) => { setFamille(e.target.value); setSousCategorie(""); }}>
              <option value="">— Famille —</option>
              {NATURE_PROJET.map((f) => <option key={f.famille} value={f.famille}>{f.famille}</option>)}
              <option value="Autre">Autre</option>
            </select>
            {famille && famille !== "Autre" && (
              <select style={champStyle} value={sousCategorie} onChange={(e) => setSousCategorie(e.target.value)}>
                <option value="">— Sous-catégorie —</option>
                {sousCategoriesDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Autre">Autre</option>
              </select>
            )}
            {famille === "Autre" && (
              <input style={champStyle} value={natureAutre} onChange={(e) => setNatureAutre(e.target.value)} placeholder="Précisez" />
            )}
          </div>
          {estPoésie && (
            <div style={{ background: "#FBE9E9", border: "0.5px solid #A32D2D50", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#A32D2D", marginBottom: 4 }}>
                Type de projet à l'étude — pas encore disponible
              </div>
              <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6 }}>
                Auditer un poème correctement demande de respecter sa forme — rimé ou non, structuré
                selon un mètre ou une forme connue (sonnet, haïku, alexandrins…) ou délibérément
                destructuré. CursAudit ne sait pas encore faire cette distinction : plutôt que de
                lancer un audit générique de prose sur un poème et risquer de juger une rupture de
                rythme voulue comme une erreur, ce type de projet reste à l'étude chez nous pour
                l'instant. Choisissez une autre sous-catégorie ci-dessus, ou revenez plus tard.
              </div>
            </div>
          )}
          {estFormatNonLinéaire && (
            <div style={{ background: "var(--fond, #F7F4EF)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
              <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6 }}>
                Un contenu de ce type est fait d'entrées courtes et autonomes plutôt que d'un fil
                narratif continu — CursAudit en tient compte et ne signalera pas l'absence d'arc
                narratif comme un défaut.
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Pourquoi écrivez-vous ?</label>
          <GroupeCases options={OBJECTIFS} valeurs={objectifs} onBasculer={basculeur(setObjectifs)} />
        </div>

        <div>
          <label style={labelStyle}>Pour qui écrivez-vous ?</label>
          <GroupeCases options={DESTINATAIRES} valeurs={destinataires} onBasculer={basculeur(setDestinataires)} />
        </div>

        <div>
          <label style={labelStyle}>Qu'attendez-vous de cet audit ? *</label>
          <GroupeCases options={FINALITES} valeurs={finalites} onBasculer={basculerFinalité} />
        </div>

        <div>
          <label style={labelStyle}>À quoi reconnaîtrez-vous que ce projet est réussi ?</label>
          <GroupeCases options={CRITERES_REUSSITE} valeurs={criteresReussite} onBasculer={basculeur(setCriteresReussite)} />
        </div>

        <div>
          <label style={labelStyle}>Qu'espérez-vous découvrir que vous ignorez encore ?</label>
          <GroupeCases options={CE_QUE_VOUS_ESPEREZ_DECOUVRIR} valeurs={ceQueVousEspérezDécouvrir} onBasculer={basculeur(setCeQueVousEspérezDécouvrir)} />
        </div>

        <div>
          <label style={labelStyle}>Quelle est la question précise que vous voulez poser à CursAudit ? *</label>
          <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: "0 0 8px" }}>
            Formulez votre question principale à CursAudit. Exemples :
          </p>
          <ul style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.8, margin: "0 0 10px", paddingLeft: 18 }}>
            <li>Mon texte tient-il sa promesse ?</li>
            <li>À quel genre appartient-il réellement ?</li>
            <li>Où perd-il le lecteur ?</li>
            <li>Que dois-je retravailler en priorité ?</li>
            <li>Le texte est-il publiable en l'état ?</li>
            <li>Ce que je veux transmettre est-il compréhensible ?</li>
            <li>Le niveau d'intime, de preuve ou de pédagogie est-il juste ?</li>
          </ul>
          <label style={{ ...labelStyle, fontWeight: 600 }}>Ma question principale :</label>
          <textarea
            style={{ ...champStyle, minHeight: 70, resize: "vertical" }}
            value={questionLibre}
            onChange={(e) => setQuestionLibre(e.target.value)}
            placeholder="Ex. : Est-ce que mon mémoire répond bien à ma problématique ?"
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={exporterContratJSON} style={{
            background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            Exporter ce contrat (JSON)
          </button>
          <label style={{
            background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            Importer un contrat (JSON)
            <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => importerContratJSON(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Que peut faire CursAudit ? *</label>
        <select style={champStyle} value={degreIntervention} onChange={(e) => setDegreIntervention(e.target.value)}>
          <option value="">— Choisir —</option>
          {DEGRES_INTERVENTION.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>

      <div>
        <Checkbox
          checked={estTravailAcademique}
          onChange={() => setEstTravailAcademique((v) => !v)}
          label="Ce texte est un mémoire, un TFE ou un autre travail académique soumis aux règles d'un établissement"
        />
        {estTravailAcademique && (
          <p style={{ fontSize: 11.5, color: "#8A6116", marginTop: 6, lineHeight: 1.5 }}>
            Limite pour un travail académique : CursAudit peut diagnostiquer, questionner, structurer,
            signaler — il ne doit pas écrire le travail à la place de l'étudiant⋅e.
          </p>
        )}
      </div>

      {estTravailAcademique && (
        <div style={{ background: "var(--fond, #F7F4EF)", padding: "14px 16px", borderRadius: 8 }}>
          <label style={labelStyle}>Votre établissement autorise-t-il l'usage de l'IA ?</label>
          <select style={{ ...champStyle, marginBottom: conditionsIA.length >= 0 && autorisationIA === "Oui" ? 12 : 0 }} value={autorisationIA} onChange={(e) => setAutorisationIA(e.target.value)}>
            <option value="">— Choisir —</option>
            <option value="Oui">Oui</option>
            <option value="Non">Non</option>
            <option value="Je ne sais pas">Je ne sais pas</option>
          </select>
          {(autorisationIA === "Non" || autorisationIA === "Je ne sais pas") && (
            <p style={{ fontSize: 11.5, color: "#8A6116", marginTop: 8, lineHeight: 1.5 }}>
              CursAudit restera strictement au diagnostic sur ce texte : aucune proposition ni reformulation,
              quel que soit le degré d'intervention choisi plus haut — cette limite est appliquée
              automatiquement par le moteur d'analyse, pas seulement affichée ici.
            </p>
          )}
          {autorisationIA === "Oui" && (
            <div>
              <label style={{ ...labelStyle, marginTop: 12 }}>À quelles conditions ?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {CONDITIONS_IA_ACADEMIQUE.map((c) => (
                  <Checkbox key={c} checked={conditionsIA.includes(c)} onChange={() => basculerCondition(c)} label={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle}>Comment voulez-vous que l'IA vous parle ?</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={champStyle} value={adresse} onChange={(e) => setAdresse(e.target.value)}>
            <option value="tu">Tutoiement</option>
            <option value="vous">Vouvoiement</option>
          </select>
          <select style={champStyle} value={ton} onChange={(e) => setTon(e.target.value)}>
            <option value="direct">Ton direct</option>
            <option value="diplomatique">Ton diplomatique</option>
          </select>
          <select style={champStyle} value={posture} onChange={(e) => setPosture(e.target.value)}>
            <option value="critique">Critique</option>
            <option value="accompagnant">Accompagnant</option>
            <option value="contradicteur">Contradicteur</option>
          </select>
          <select style={champStyle} value={longueur} onChange={(e) => setLongueur(e.target.value)}>
            <option value="court">Réponses courtes</option>
            <option value="détaillé">Réponses détaillées</option>
          </select>
          <select style={champStyle} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="éditeur">Plutôt éditeur</option>
            <option value="auditeur">Plutôt auditeur</option>
            <option value="coach">Plutôt coach</option>
            <option value="lecteur expert">Plutôt lecteur expert</option>
          </select>
        </div>
      </div>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>{erreur}</div>
      )}

      <button onClick={valider} disabled={estPoésie} style={{
        background: estPoésie ? "#ccc" : "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
        padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: estPoésie ? "default" : "pointer", fontFamily: "inherit",
      }}>
        Continuer
      </button>
    </div>
  );
}
