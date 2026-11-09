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
function Ol({ children }) {
  return <ol style={{ margin: "0 0 12px", paddingLeft: 22 }}>{children}</ol>;
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
    <Page titre="Mode d'emploi" misÀJour="9 novembre 2026" onRetour={onRetour}>
      <P>
        Ce guide explique ce que fait <strong>réellement</strong> Cursus aujourd'hui — pas ce qui est prévu.
        Cursus s'articule autour de trois espaces, débloqués progressivement selon votre palier d'abonnement :{" "}
        <strong>CursEdit</strong> (écrire), <strong>CursAudit</strong> (auditer un texte déjà écrit) et{" "}
        <strong>CursDecision</strong> (pas encore construit — page de présentation seulement).
      </P>

      <H2>Démarrer en 5 minutes</H2>
      <P>Vous découvrez Cursus ? Voici le chemin le plus court pour écrire votre première page.</P>
      <Ol>
        <li style={{ marginBottom: 8 }}>
          <strong>Créez votre compte.</strong> Sur <code>cursus.pro</code>, onglet « Créer un compte » : adresse e-mail et mot de passe.
          Un e-mail de confirmation arrive : cliquez sur le lien (regardez aussi les courriers indésirables). Si rien n'arrive ou si le lien ne
          s'ouvre pas, revenez sur cursus.pro : le lien « Renvoyer l'e-mail de confirmation » apparaît quand il sert.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Choisissez votre espace.</strong> Pour écrire, c'est <strong>CursEdit</strong>.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Activez votre accès.</strong> CursEdit demande un abonnement ou un <strong>code promotionnel</strong> (ou code cadeau). Sur la
          page d'accès, saisissez le code dans la case « Code promotionnel » <em>avant</em> de cliquer sur « Choisir ». Avec un code à 100 %, il n'y a rien à payer.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Créez votre projet.</strong> Menu « Mes projets », puis « + Nouveau projet ». Un questionnaire de démarrage peut s'ouvrir
          (une dizaine de questions sur votre livre) : y répondre aide le Co-pilote ; « Plus tard » le ferme sans rien perdre.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Ajoutez une partie, puis un chapitre, et écrivez.</strong> Votre texte est enregistré automatiquement. Le témoin à côté du titre
          du chapitre affiche « Sauvegardé » quand l'enregistrement est confirmé. S'il affiche « NON ENREGISTRÉ » en rouge, ne rechargez pas la page.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Demandez un coup de main.</strong> Le Co-pilote (panneau de droite) donne des avis ; « Aide-moi à avancer » est toujours disponible.
          Pour une simple question, <strong>Ctrl+K</strong> (ou le bouton « Aide ») ouvre la Question rapide.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Un doute ?</strong> Le bouton « Aide » répond ; sur la page de connexion, Æncre propose aussi ce mode d'emploi.
        </li>
      </Ol>
      <Encadré couleur="#1D9E75">
        Trois choses à savoir dès le départ : (1) les assistants IA relisent, signalent et conseillent, ils n'ont pas pour vocation d'écrire à votre place ;
        (2) une IA peut se tromper : vérifiez toujours un fait ou une référence avant de les utiliser ; (3) Cursus n'utilise pas vos contenus pour entraîner
        des modèles d'IA (voir la Politique de confidentialité).
      </Encadré>

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
        CursEdit nécessite un abonnement payant ou un code promotionnel ("Tarification" dans le menu de gauche une fois dans l'espace
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
        de gauche. Chaque chapitre a son propre texte, enregistré automatiquement.
      </P>

      <H3>Mettre en forme le texte</H3>
      <Ul>
        <li>Styles (Normal, Titres 1 à 6, Citation), police, taille, interligne, gras, italique, souligné, barré</li>
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
        ℹ️ <strong>Les images dans CursAudit.</strong> Pour un fichier Word importé, les images intégrées au document sont lues avec le texte de
        l'unité analysée (jusqu'à 3 par unité). Pour un texte collé, aucune image n'est possible.
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

      <H2>6. Fonctions utiles à connaître</H2>
      <P style={{ fontSize: 12, color: "#999" }}>
        Ces fonctions ont été ajoutées après la première version de ce guide. Les menus et boutons peuvent évoluer : en cas d'écart, le bouton « Aide » est là.
      </P>

      <H3>Écrire et mettre en forme (bureau)</H3>
      <Ul>
        <li><strong>Ruban à onglets</strong> (Accueil, Insertion, Mise en page, Références, Révision, Affichage, Aide) : le 📌 d'un bouton l'épingle sur l'Accueil ; les fonctions grisées arrivent plus tard.</li>
        <li><strong>🎨 Styles</strong> : régler une fois la police, la taille et l'interligne de « Normal » ou « Titre 1 » pour tout le livre (repris à l'export Word).</li>
        <li><strong>📄 Vue page et règle</strong> : la feuille avec ses marges ; glisser les bords de la règle pour les marges, les repères pour les retraits, la première ligne et les taquets de tabulation (touche Tab).</li>
        <li><strong>Saut de page</strong> (Ctrl+Entrée) et <strong>en-têtes et numéros de page</strong> (ruban Mise en page) : appliqués à l'export Word.</li>
        <li><strong>Statistiques</strong> (ruban Révision) : mots, caractères, phrases, temps de lecture, sur la sélection, le chapitre ou le livre.</li>
      </Ul>

      <H3>Retrouver et remplacer</H3>
      <Ul>
        <li><strong>Rechercher / remplacer</strong> (Ctrl+F, Ctrl+H) : dans le chapitre ou « Tout le livre », titres et notes de bas de page compris. « Plus &gt;&gt; » : mot entier, début ou fin de mot, mise en forme, ignorer la ponctuation ou les espaces, caractères spéciaux (« Spécial ▾ »). Les pages indiquées sont des estimations.</li>
        <li><strong>Atteindre</strong> (Ctrl+G) : un chapitre, un intertitre, une ligne, un paragraphe, une page, une note ou une image.</li>
        <li>Chaque chapitre modifié par « Tout remplacer » est d'abord sauvegardé dans l'historique, sauf les titres (pas d'historique pour eux).</li>
      </Ul>

      <H3>Ne rien perdre</H3>
      <Ul>
        <li><strong>↺ Historique</strong> : des instantanés réguliers du chapitre ; « Restaurer » garde d'abord le texte actuel.</li>
        <li>Une copie de sécurité du chapitre est aussi gardée sur l'appareil : si la page est rechargée avant l'enregistrement, Cursus propose de la récupérer.</li>
        <li>Si un chapitre est modifié depuis un autre appareil ou onglet, Cursus n'écrase plus rien : il charge la version la plus récente ou vous laisse choisir entre les deux versions.</li>
        <li>Les résultats du Co-pilote et des fenêtres IA sont conservés quand on change de chapitre ou qu'on ferme la fenêtre.</li>
      </Ul>

      <H3>Les assistants IA</H3>
      <Ul>
        <li><strong>💬 Question rapide</strong> (Ctrl+K ou « Aide ») : une question sans quitter le texte ; choix du modèle, de l'effort et du style ; « De mémoire » (à vérifier) ou « Avec sources ». Le chapitre n'est pas envoyé, seulement la sélection si vous le cochez.</li>
        <li><strong>✨ Correction rapide</strong> : fautes seulement, ou fautes et fluidité légère ; revue carte par carte, un seul Ctrl+Z pour tout annuler ; un bilan de relecture signale sans trancher.</li>
        <li><strong>🔎 Vérifier le fond</strong> : un avis de lecture (« est-ce que ça tient la route ? »), qui ne modifie jamais le texte ; <strong>Vérifier les faits</strong> : recherche web, sources et calculs refaits (« confirmé » veut dire qu'une source réelle existe, à lire vous-même).</li>
        <li><strong>📊 Profil de lisibilité</strong> : lecture seule ; en dessous de 5 paragraphes, pas d'orientation.</li>
        <li><strong>🧭 Guide directif</strong> (Co-pilote) : une directive visible et modifiable avant envoi. Le Co-pilote reçoit aussi le plan du livre, peut recevoir le chapitre précédent, cite les numéros de ligne et tient compte du passage marqué en gris.</li>
        <li><strong>« + » du Co-pilote</strong> : joindre une image (JPG, PNG, WebP, GIF, ou collée avec Ctrl+V) ou un texte (.txt, .md, .csv, .docx) à une question : 3 images et 2 textes au plus ; la pièce ne vaut que pour ce message.</li>
        <li><strong>📷 Lire une photo</strong> : photographier une page papier ; la transcription est fidèle (rien n'est corrigé) et à relire avant insertion ; la photo n'est pas conservée.</li>
        <li><strong>Dictée vocale</strong> et <strong>lecture à voix haute</strong> (voix et vitesse au choix) : la lecture a un quota mensuel de caractères selon le palier, dont le solde est affiché.</li>
        <li>Sur une scène intime, l'IA conseille sans moraliser ; si elle décline d'écrire une scène explicite, un bandeau le signale : demandez plutôt un avis qu'une réécriture.</li>
      </Ul>

      <H3>Sur téléphone</H3>
      <P>
        L'en-tête tient sur une ligne, le menu « ⋯ » regroupe les actions, la barre d'outils est réduite avec un bouton « Plus ▾ », et le Co-pilote
        s'ouvre en plein écran par le bouton flottant. Le bouton « Installer Cursus » (écran de choix d'espace) ajoute l'application à l'écran d'accueil.
      </P>

      <H3>Détente et découverte</H3>
      <Ul>
        <li><strong>Jeux de mots</strong> (menu de gauche) : Scrabble (solveur, outils, partie contre l'ordinateur), Motus, Pendu, Boggle, mots croisés, fléchés et codés, mots en cercle, échelle de mots, mots mêlés, « Devine le livre », « Quel lecteur es-tu ? » et « Lire pour traverser ».</li>
        <li><strong>🧘 Pauses bien-être</strong> : un rappel discret après un long moment d'écriture ; réglable et désactivable ; des mouvements doux, sans valeur d'avis médical.</li>
        <li><strong>Dossier thématique et auteurs partenaires</strong> : sur la page de connexion, le dossier « Lire pour traverser » (lectures sur la maladie, la fin de vie et le deuil) et un encadré pour les auteurs qui ont publié un livre : un mois d'accès Initié offert en bêta aux 30 premiers nouveaux auteurs dont le livre est présenté.</li>
      </Ul>

      <H2>Besoin d'aide ?</H2>
      <P>
        Les pages Mentions légales, CGV et Politique de confidentialité sont accessibles depuis l'écran de
        connexion. Pour toute autre question, contactez le support via l'adresse indiquée sur ces pages.
      </P>
    </Page>
  );
}
