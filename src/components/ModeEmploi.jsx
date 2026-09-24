/**
 * CURSUS — Mode d'emploi (liste d'attente #3, construit le 24/09/2026)
 * ======================================================================
 * Guide complet à l'usage de l'auteur·ice, sur ce que Cursus fait
 * RÉELLEMENT aujourd'hui — pas ce qui est prévu. Source de vérité
 * partagée avec docs/mode-emploi.md (dépôt) : les deux couvrent le même
 * contenu, adapté à leur format (Markdown technique vs page applicative).
 * Toute fonctionnalité ajoutée/retirée doit être répercutée aux deux
 * endroits, comme PagesLegales.jsx pour IDENTITE_EDITEUR.
 *
 * Même structure de composants que PagesLegales.jsx (Page/H2/P/Ul) —
 * dupliquée plutôt qu'importée : ce fichier n'a pas vocation à devenir
 * une page "légale", pas de raison de les coupler.
 *
 * Bouton "Retour" toujours visible (24/09/2026) — voir BoutonRetourFixe.jsx.
 *
 * SCROLL AUTONOME (24/09/2026, suite) — cette page est ouverte depuis
 * trois endroits différents (auth.jsx avant connexion, EcranChoixEspace,
 * et App.jsx une fois connecté·e), avec des parents très différents :
 * certains laissent la fenêtre défiler normalement, d'autres (App.jsx,
 * la grille principale en `height: 100dvh` + `overflow: hidden`) ne le
 * permettent pas. Or Æncre (AencreGuide) doit suivre CE scroll pour que
 * l'encrier reste immobile pendant que la plume seule voyage — si on
 * écoutait le scroll de la fenêtre et que ce n'est pas elle qui défile,
 * l'encrier "suit" le contenu au lieu de rester en place. On rend donc
 * cette page responsable de son propre défilement (`ref` + `overflowY:
 * auto` sur son propre conteneur, `flex`+`minHeight:0` pour bien
 * s'ajuster quand un parent flex l'y contraint), et on passe cette
 * référence à AencreGuide plutôt que de se fier à la fenêtre.
 */

import { useRef } from "react";
import BoutonRetourFixe from "./BoutonRetourFixe.jsx";
import AencreGuide from "./AencreGuide.jsx";

function Page({ titre, misÀJour, children, onRetour }) {
  const conteneurRef = useRef(null);
  return (
    <div ref={conteneurRef} style={{
      height: "100dvh", flex: "1 1 auto", minHeight: 0, overflowY: "auto",
      position: "relative", // ancre l'encrier (position: absolute dans AencreGuide) à CE
      // conteneur plutôt qu'à la page entière, pour qu'il défile avec son contenu.
      background: "#f8f8f8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 20px",
    }}>
      {onRetour && <BoutonRetourFixe onClick={onRetour} couleur="#7F77DD" label="Retour" />}
      <AencreGuide conteneurRef={conteneurRef} />
      <div style={{
        maxWidth: 760, margin: "0 auto", background: "#fff",
        border: "0.5px solid #e5e5e5", borderRadius: 16, padding: "36px 40px",
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{titre}</h1>
        <p style={{ fontSize: 11.5, color: "#999", marginBottom: 28 }}>Dernière mise à jour : {misÀJour}</p>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function H2({ children }) {
  return <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a", marginTop: 34, marginBottom: 4, paddingTop: 18, borderTop: "0.5px solid #eee" }}>{children}</h2>;
}
function H3({ children }) {
  return <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a1a", marginTop: 18, marginBottom: 8 }}>{children}</h3>;
}
function P({ children }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>;
}
function Ul({ children }) {
  return <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>;
}
function Encadré({ children, couleur = "#7F77DD" }) {
  return (
    <div style={{ background: `${couleur}0d`, border: `0.5px solid ${couleur}40`, borderRadius: 8, padding: "10px 14px", margin: "12px 0", fontSize: 13 }}>
      {children}
    </div>
  );
}
function Table({ lignes }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0 16px", fontSize: 13 }}>
      <tbody>
        {lignes.map(([a, b], i) => (
          <tr key={i} style={{ borderBottom: "0.5px solid #eee" }}>
            <td style={{ padding: "6px 10px 6px 0", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{a}</td>
            <td style={{ padding: "6px 0", color: "#555" }}>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ModeEmploi({ onRetour }) {
  return (
    <Page titre="Mode d'emploi" misÀJour="24 septembre 2026" onRetour={onRetour}>
      <P>
        Ce guide explique ce que fait <strong>réellement</strong> Cursus aujourd'hui — pas ce qui est prévu.
        Cursus s'articule autour de trois espaces, débloqués progressivement selon votre palier d'abonnement :{" "}
        <strong>CursEdit</strong> (écrire), <strong>CursAudit</strong> (auditer un texte déjà écrit) et{" "}
        <strong>CursDecision</strong> (pas encore construit — page de présentation seulement).
      </P>

      <H2>1. Premiers pas</H2>

      <H3>Créer un compte</H3>
      <P>
        Sur <code>cursus.pro</code>, l'écran d'accueil propose deux onglets : <strong>Connexion</strong> et{" "}
        <strong>Créer un compte</strong>. Pour un nouveau compte : email + mot de passe, puis un email de
        confirmation est envoyé — il faut cliquer sur le lien qu'il contient avant de pouvoir se connecter.
      </P>

      <H3>Choisir un espace</H3>
      <P>
        Une fois connecté·e, un écran présente les trois espaces : CursEdit, CursAudit, CursDecision. C'est le
        point de départ à chaque connexion tant qu'aucun espace n'a été choisi dans la session en cours.
      </P>

      <H3>S'abonner</H3>
      <P>
        CursEdit nécessite un abonnement payant ("Tarification" dans le menu de gauche une fois dans l'espace
        CursEdit) — cinq paliers cumulatifs. CursAudit se débloque à partir du palier Essentiel, puis se facture{" "}
        <strong>en plus</strong>, à l'acte, par audit réalisé — ce n'est pas inclus dans l'abonnement CursEdit.
      </P>

      <H3>Se repérer dans le menu de gauche</H3>
      <Table lignes={[
        ["Tableau de bord", "Vue d'ensemble : projets, mots écrits, sessions récentes"],
        ["Mes projets", "Liste de tous vos projets"],
        ["Éditeur", "Le dernier chapitre ouvert"],
        ["Bibliothèque", "Citations et références enregistrées"],
        ["Carnet d'idées", "Notes et fragments capturés hors chapitre"],
        ["Tarification (CursEdit)", "Les 5 paliers d'abonnement"],
        ["CursAudit", "Créer un nouvel audit"],
        ["Mes audits", "Vos audits en cours et terminés"],
      ]} />
      <P style={{ fontSize: 12, color: "#999" }}>
        Deux entrées supplémentaires (Administration, Supervision) n'apparaissent que sur le compte propriétaire
        du projet Cursus — pas destinées aux auteur·ice·s testeuses.
      </P>

      <H2>2. CursEdit — l'espace d'écriture</H2>

      <H3>Structurer un projet</H3>
      <P>
        Un projet se compose de <strong>parties</strong> et de <strong>chapitres</strong>, organisés dans la colonne
        de gauche. Chaque chapitre a son propre texte, sauvegardé automatiquement toutes les 30 secondes.
      </P>

      <H3>Mettre en forme le texte</H3>
      <Ul>
        <li>Titres (H1 à H6), gras, italique, souligné</li>
        <li><strong>Couleur du texte</strong> — bouton "A" à barre colorée : 5 teintes + retour par défaut</li>
        <li><strong>Surlignage</strong> — bouton crayon 🖍️ : 5 teintes + retrait</li>
        <li><strong>Surligneur pour analyses</strong> — bouton loupe 🔍, <em>distinct</em> du surlignage ci-dessus : marque un passage d'une couleur grise dédiée pour le Co-pilote (voir plus bas)</li>
        <li>Listes à puces et numérotées, citation, séparateur</li>
      </Ul>

      <H3>Insérer une image</H3>
      <P>Le bouton 🖼️ ouvre un sélecteur de fichier (JPG, PNG, GIF, WEBP, BMP, HEIC — 8 Mo max), l'image s'insère au curseur.</P>

      <H3>Importer un fichier Word</H3>
      <P>
        Lit un fichier <code>.docx</code> et recrée la structure de parties/chapitres à partir des styles de titre
        Word (Titre 1 = parties, Titre 2 = chapitres). Les images intégrées au document sont importées aussi.
      </P>
      <Encadré couleur="#BA7517">
        ⚠️ L'import se base sur le <strong>style</strong> Word réellement appliqué, pas sur l'apparence visuelle.
        Un titre mis en gras/italique à la main sans lui appliquer le style "Titre 1"/"Titre 2" ne sera pas reconnu.
        En cas de titre manquant, vérifiez dans Word le style exact du paragraphe (volet Styles).
      </Encadré>

      <H3>Dictée vocale</H3>
      <P>
        Le bouton 🎙 enregistre, transcrit, puis affiche un champ de relecture <strong>avant</strong> toute
        insertion — jamais automatique, pour corriger une éventuelle erreur de reconnaissance.
      </P>

      <H3>Mode focus, historique, objectifs</H3>
      <Ul>
        <li><strong>Mode focus</strong> (F11) — masque tout sauf le texte en cours</li>
        <li><strong>Historique des versions</strong> — chaque sauvegarde est conservée, datée, consultable</li>
        <li><strong>Objectifs de session</strong> — mots ou temps, avec minuteur</li>
      </Ul>

      <H2>3. Le Co-pilote IA</H2>
      <P>Le panneau à droite de l'éditeur, cinq onglets :</P>
      <Ul>
        <li><strong>Suggestions</strong> — propositions contextuelles sur le passage analysé</li>
        <li><strong>Personnages</strong> — repère les personnages, leur cohérence</li>
        <li><strong>Références</strong> — recherche et vérifie des références bibliographiques (recherche web réelle)</li>
        <li><strong>Cohérence</strong> — incohérences internes, répétitions, glissements</li>
        <li><strong>Vérification</strong> — vérifie une affirmation précise en croisant <strong>deux IA</strong> (Claude et GPT)</li>
      </Ul>

      <H3>Choisir ce qui est analysé</H3>
      <P>Trois sources possibles selon le contexte :</P>
      <Ul>
        <li><strong>Sélection</strong> — le texte surligné à la souris</li>
        <li><strong>Chapitre entier</strong> — tout le chapitre ouvert</li>
        <li><strong>🔍 Surligné</strong> — uniquement les passages marqués du surligneur gris dédié, pour trier ce qui doit être analysé dans un texte long</li>
      </Ul>

      <H3>Aide-moi à avancer</H3>
      <P>
        Toujours disponible. Pose un diagnostic sur un blocage d'écriture, puis propose 5 formes d'aide au choix :
        Questionne-moi, Donne-moi des pistes, Construis la scène avec moi, Propose-moi un exemple, Surprends-moi.
        Aucune n'écrit à votre place sans que vous l'ayez demandé.
      </P>

      <H3>Conseils de recomposition, Mode Auto, Mémoire narrative</H3>
      <Ul>
        <li><strong>Conseils de recomposition</strong> — analyse le chapitre entier par tranches, même au-delà de 8000 caractères, sans jamais résumer</li>
        <li><strong>Mode Auto</strong> — relance l'onglet actif toutes les 10 minutes (sauf Vérification)</li>
        <li><strong>Mémoire narrative</strong> — "Mémoriser cette intention" garde une note réutilisée dans les analyses suivantes</li>
      </Ul>

      <H3>Les images</H3>
      <P>
        Le Co-pilote voit réellement le <strong>contenu</strong> des images du chapitre (pas seulement leur
        présence) — dans les 4 onglets principaux, "Aide-moi à avancer" et les fils de dialogue, jusqu'à 3 images
        par appel. Exception : "Conseils de recomposition" ne les distingue pas par tranche, et l'onglet
        Vérification ne les voit pas.
      </P>

      <Encadré>
        🔍 Malgré la double vérification, une erreur reste possible — vérifiez toujours une affirmation factuelle
        ou une référence citée avant usage. Rappel permanent affiché en bas du panneau Co-pilote.
      </Encadré>

      <H3>Le quota de tokens</H3>
      <P>
        Chaque palier inclut un quota mensuel de tokens IA (jauge en haut du panneau), renouvelé le 1er du mois.
        Au-delà, les analyses sont en pause jusqu'au renouvellement, ou un crédit ponctuel peut être ajouté.
      </P>

      <H2>4. CursAudit — l'espace d'audit critique</H2>
      <P>
        Différent du Co-pilote : CursAudit <strong>audite un texte déjà écrit</strong>, depuis un espace séparé,
        pas depuis l'éditeur.
      </P>
      <Ul>
        <li>Deux sources : coller le texte, ou importer un <code>.docx</code> (pas de PDF pour l'instant)</li>
        <li>Un questionnaire précède l'analyse : type de texte, statut, question d'audit, degré d'intervention</li>
        <li>Grille de critères : cohérence interne, niveau de preuve, généralisations abusives, glissements de registre — seul le palier <strong>Essentiel</strong> (8 critères) est proposé aujourd'hui</li>
        <li>Mode "2 IA" : un second modèle (GPT) relit et signale ses désaccords, limité aux parties conclusives pour un coût maîtrisé</li>
      </Ul>
      <Encadré couleur="#BA7517">
        ⚠️ <strong>CursAudit ne voit aucune image.</strong> Le texte est segmenté en unités brutes avant analyse —
        contrairement au Co-pilote de CursEdit, aucune image n'est transmise à l'IA ici. Pour une analyse qui tient
        compte d'images, utilisez le Co-pilote dans CursEdit.
      </Encadré>

      <H2>5. Abonnement et accès</H2>
      <P>
        Cinq paliers CursEdit, cumulatifs : chaque palier supérieur débloque progressivement CursAudit (dès
        Essentiel) puis CursDecision (dès Initié).
      </P>
      <P>
        En cas d'annulation (CGV art. 6) : l'accès IA s'arrête immédiatement, mais vos textes restent consultables
        en <strong>lecture seule pendant 3 mois</strong> — aucune modification, import ni création sans
        réabonnement. Passé ce délai, l'accès est totalement suspendu.
      </P>

      <H2>Besoin d'aide ?</H2>
      <P>
        Les pages Mentions légales, CGV et Politique de confidentialité sont accessibles depuis l'écran de
        connexion. Pour toute autre question, contactez le support via l'adresse indiquée sur ces pages.
      </P>
    </Page>
  );
}
