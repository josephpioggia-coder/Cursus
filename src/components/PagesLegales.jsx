/**
 * CURSUS — Pages légales (mentions légales, CGV, politique de confidentialité)
 * ======================================================================
 * Ajoutées le 14-15/09/2026 en réponse à un vrai manque identifié lors de
 * l'audit de préparation à la commercialisation : AUCUNE page légale
 * n'existait nulle part dans l'application, un point bloquant pour toute
 * vente réelle en Belgique/UE.
 *
 * RÉFÉRENCES LÉGALES VÉRIFIÉES (15/09/2026, suite à une question directe
 * de l'auteur du projet — "donne-moi les références légales") :
 *  - Identification du prestataire en ligne (nom, forme juridique, adresse
 *    du siège, numéro d'entreprise, coordonnées de contact) : Code de
 *    droit économique, Livre XII ("Droit de l'économie électronique"),
 *    Titre 1er, Chapitre 3 "Information et transparence", article XII.6 —
 *    codification actuelle (depuis la loi du 15/12/2013) de l'ancienne loi
 *    du 11 mars 2003, elle-même transposant la directive européenne
 *    2000/31/CE ("directive e-commerce").
 *  - Information du consommateur avant/après une vente à distance (CGV) :
 *    Code de droit économique, Livre VI ("Pratiques du marché et
 *    protection du consommateur"), notamment les art. VI.45 et suivants,
 *    et le droit de rétractation/ses exceptions à l'art. VI.53.
 *  - Mention "RPM + tribunal compétent" à côté du numéro d'entreprise :
 *    exigée pour tout document émanant d'une personne morale (Code des
 *    sociétés et des associations).
 *  - Protection des données : RGPD (règlement UE 2016/679).
 * CE QUE CES TEXTES N'EXIGENT PAS explicitement, contrairement à une
 * première version de cette page : nommer un individu précis comme
 * "directeur de la publication" — c'est une notion du droit FRANÇAIS
 * (LCEN, loi du 21/06/2004, art. 6-III, héritée de la loi de 1881 sur la
 * presse), pas une exigence du droit belge. Corrigé : la page identifie
 * désormais l'entreprise elle-même comme éditeur, avec son représentant
 * légal cité à titre d'information, pas comme une case juridique obligée.
 *
 * IDENTITÉ UTILISÉE — mise à jour le 18/10/2026, fournie explicitement par
 * l'auteur du projet : HMS-i SA (identité précédente, voir git log pour le
 * détail) n'a STRICTEMENT AUCUN lien avec Cursus — projet personnel de
 * l'auteur, financé et construit par lui seul, sans aucun outil ni
 * ressource de HMS-i. Le vendeur réel est désormais "CURSUS Entre-Prises.be"
 * (société en commandite en cours de constitution — commandité : l'auteur
 * du projet ; commanditaire : sa sœur ; capital 3 000 €), dont les
 * documents sont prêts mais pas encore déposés au moment de ce correctif.
 *
 * ANONYMAT EXPLICITEMENT DEMANDÉ : l'auteur du projet a demandé que son nom
 * personnel n'apparaisse NULLE PART sur le site — seule l'identité de la
 * société (raison sociale, adresse, contact) doit figurer. Possible en
 * droit belge (voir plus haut : contrairement au droit français, rien
 * n'exige de nommer un gérant/administrateur sur des mentions légales) —
 * le champ `administrateur` qui existait ici pour HMS-i SA n'est
 * d'ailleurs JAMAIS rendu dans le JSX plus bas (vérifié), retiré par
 * cohérence plutôt que laissé mort dans IDENTITE_EDITEUR. Limite
 * explicitement signalée à l'auteur, qu'il a acceptée en connaissance de
 * cause : pour une société en commandite spécifiquement, le commandité
 * (responsabilité illimitée) fait généralement partie des informations
 * publiées à la BCE/au Moniteur belge lors de la constitution — un
 * registre public que Cursus ne contrôle pas, distinct de ce que ses
 * propres pages affichent.
 *
 * `numéroEntreprise` reste volontairement "en cours d'attribution" :
 * l'auteur a confirmé qu'aucune vente immédiate n'est prévue et que ce
 * numéro n'est nécessaire qu'au moment d'établir une facture — À COMPLÉTER
 * ici dès qu'il est attribué, avant toute vente réelle (l'article XII.6 du
 * Code de droit économique l'exige). `raisonSociale` ne porte pour l'instant
 * aucune forme juridique explicite (ex. "SC") — à ajouter dès que l'auteur
 * confirme l'abréviation exacte à utiliser pour la société en commandite,
 * toujours pour la même raison (XII.6 exige la forme juridique, pas
 * seulement le nom). À METTRE À JOUR dans IDENTITE_EDITEUR ci-dessous, seul
 * endroit à modifier si l'identité change encore.
 *
 * LIMITE ASSUMÉE : ces références ont été vérifiées via des sources
 * secondaires fiables (cabinets juridiques, fédérations professionnelles
 * belges), pas en relisant le texte codifié primaire mot pour mot — à
 * confirmer sur economie.fgov.be ou ejustice.just.fgov.be pour une
 * certitude absolue avant une mise en ligne publique définitive. Rédigé à
 * partir de ces trames adaptées aux fonctionnalités réelles de Cursus
 * (vérifiées dans le code : Stripe pour le paiement, Supabase pour
 * l'hébergement/l'authentification, Claude/Anthropic et GPT-4o/OpenAI pour
 * l'analyse IA, aucun cookie de suivi publicitaire trouvé dans le code).
 * Ce n'est PAS une relecture par un avocat — recommandé avant toute mise
 * en ligne publique définitive, surtout une fois la structure définitive
 * choisie.
 */

const IDENTITE_EDITEUR = {
  // 18/10/2026 — voir la note d'en-tête : plus aucun lien avec HMS-i SA.
  // Nom exact repris de l'acte constitutif (société en commandite) : article
  // 1, "ENTRE-PRISES.PRO SComm" — correspond aussi au nom de domaine acheté
  // le même jour (entre-prises.pro). Ne pas modifier sans revérifier l'acte
  // constitutif (ou les statuts définitivement déposés, une fois la société
  // inscrite à la BCE) : c'est ce document qui fait foi, pas une
  // reformulation orale.
  raisonSociale: "ENTRE-PRISES.PRO SComm",
  adresse: "Rue Dony 77, 4000 Liège, Belgique",
  // Pas encore attribué (société en cours de constitution) — aucune vente
  // immédiate prévue, nécessaire seulement au moment d'établir une
  // facture. À COMPLÉTER ici avant toute vente réelle.
  numéroEntreprise: "en cours d'attribution",
  // Adresse de contact dédiée (15/09/2026, fournie par l'auteur du
  // projet) — remplace l'email personnel utilisé en placeholder le temps
  // de la rédaction initiale.
  email: "infocursus.proia@gmail.com",
};

// Bouton "Retour" toujours visible (24/09/2026) — voir BoutonRetourFixe.jsx.
import BoutonRetourFixe from "./BoutonRetourFixe.jsx";

function Page({ titre, misÀJour, children, onRetour, onNaviguer }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#f8f8f8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 20px",
    }}>
      {onRetour && <BoutonRetourFixe onClick={onRetour} couleur="#7F77DD" label="Retour" />}
      <div style={{
        maxWidth: 720, margin: "0 auto", background: "#fff",
        border: "0.5px solid #e5e5e5", borderRadius: 16, padding: "36px 40px",
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{titre}</h1>
        <p style={{ fontSize: 11.5, color: "#999", marginBottom: 28 }}>Dernière mise à jour : {misÀJour}</p>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>
          {children}
        </div>
        {/* Navigation entre les 3 pages légales (15/09/2026) — pour qu'une
            seule entrée dans l'app (ou le lien pré-connexion) suffise à
            atteindre les deux autres, sans dupliquer 3 points d'entrée
            partout dans l'application. */}
        {onNaviguer && (
          <p style={{ fontSize: 11, color: "#999", textAlign: "center", marginTop: 32, paddingTop: 16, borderTop: "0.5px solid #eee" }}>
            <button onClick={() => onNaviguer("mentions")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#999", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>Mentions légales</button>
            {" · "}
            <button onClick={() => onNaviguer("cgv")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#999", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>CGV</button>
            {" · "}
            <button onClick={() => onNaviguer("confidentialite")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#999", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>Confidentialité</button>
          </p>
        )}
      </div>
    </div>
  );
}

function H2({ children }) {
  return <h2 style={{ fontSize: 15.5, fontWeight: 600, color: "#1a1a1a", marginTop: 28, marginBottom: 10 }}>{children}</h2>;
}
function P({ children }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>;
}
function Ul({ children }) {
  return <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>;
}

export function MentionsLegales({ onRetour, onNaviguer }) {
  const id = IDENTITE_EDITEUR;
  return (
    <Page titre="Mentions légales" misÀJour="18 octobre 2026" onRetour={onRetour} onNaviguer={onNaviguer}>
      <H2>Éditeur du site</H2>
      <P>
        {id.raisonSociale}<br />
        {id.adresse}<br />
        Numéro d'entreprise : {id.numéroEntreprise} — RPM Liège<br />
        Contact : {id.email}
      </P>

      <H2>Hébergement</H2>
      <P>
        Le site et l'application web sont hébergés par <strong>Vercel Inc.</strong> (infrastructure frontend) et{" "}
        <strong>Supabase Inc.</strong> (base de données, authentification, fonctions serveur). Les coordonnées
        complètes de ces hébergeurs sont disponibles sur leurs sites respectifs (vercel.com, supabase.com).
      </P>

      <H2>Propriété intellectuelle</H2>
      <P>
        La structure du site, son code, sa marque et son identité visuelle sont la propriété de {id.raisonSociale},
        sauf mention contraire. Les textes, manuscrits et contenus que vous créez ou importez dans Cursus restent
        votre propriété exclusive — voir la Politique de confidentialité pour le détail de leur traitement.
      </P>

      <H2>Litiges</H2>
      <P>
        Le présent site est soumis au droit belge. À défaut de résolution amiable, les tribunaux de l'arrondissement
        judiciaire de Liège sont seuls compétents.
      </P>
    </Page>
  );
}

export function PolitiqueConfidentialite({ onRetour, onNaviguer }) {
  const id = IDENTITE_EDITEUR;
  return (
    <Page titre="Politique de confidentialité" misÀJour="18 octobre 2026" onRetour={onRetour} onNaviguer={onNaviguer}>
      <P>
        Cette politique décrit comment {id.raisonSociale} ("Cursus", "nous") traite vos données personnelles,
        conformément au Règlement Général sur la Protection des Données (RGPD).
      </P>

      <H2>Responsable du traitement</H2>
      <P>{id.raisonSociale}, {id.adresse} — contact : {id.email}.</P>

      <H2>Données que nous collectons</H2>
      <Ul>
        <li>Données de compte : adresse email, mot de passe (jamais stocké en clair, géré par Supabase Auth).</li>
        <li>Contenus que vous créez ou importez : manuscrits, chapitres, textes soumis à l'analyse (CursAudit, CursEdit).</li>
        <li>Données de facturation : gérées directement par Stripe, notre prestataire de paiement — nous ne stockons jamais votre numéro de carte bancaire.</li>
        <li>Données d'usage technique : journaux de connexion, volume de tokens IA consommés (pour le suivi de votre quota).</li>
      </Ul>

      <H2>Pourquoi nous les traitons</H2>
      <Ul>
        <li>Fournir le service : générer les analyses et suggestions IA que vous demandez.</li>
        <li>Facturer les services payants (audits, abonnements).</li>
        <li>Assurer la sécurité et le bon fonctionnement du service.</li>
        <li>Améliorer le service et établir des statistiques d'usage agrégées (répartition par type de produit, tendances générales) — uniquement sous une forme agrégée, jamais nominative.</li>
      </Ul>

      <H2>Qui reçoit ces données</H2>
      <P>Vos données ne sont jamais vendues. Elles peuvent être transmises, dans la stricte mesure nécessaire au fonctionnement du service, à :</P>
      <Ul>
        <li><strong>Supabase Inc.</strong> — hébergement de la base de données et authentification.</li>
        <li><strong>Anthropic (Claude)</strong> et <strong>OpenAI (GPT-4o)</strong> — pour générer les analyses IA que vous demandez : le texte que vous soumettez à une analyse leur est transmis le temps du traitement.</li>
        <li><strong>Stripe</strong> — traitement des paiements.</li>
        <li><strong>Vercel Inc.</strong> — hébergement de l'application.</li>
      </Ul>
      <P>
        Certains de ces prestataires sont établis hors de l'Union européenne (États-Unis). Le transfert de données
        vers eux repose sur les garanties prévues par le RGPD (clauses contractuelles types ou mécanisme équivalent
        propre à chaque prestataire).
      </P>

      <H2>Durée de conservation</H2>
      <P>
        Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données
        personnelles et vos contenus sont supprimés dans un délai raisonnable, sauf obligation légale de conservation
        plus longue (ex. données de facturation).
      </P>

      <H2>Vos droits</H2>
      <P>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition sur vos données. Pour exercer ces droits, contactez {id.email}.</P>

      <H2>Cookies</H2>
      <P>
        Cursus n'utilise que des cookies strictement techniques, nécessaires au maintien de votre session de
        connexion (gérés par Supabase Auth). Aucun cookie de suivi publicitaire ou d'analyse comportementale n'est
        utilisé.
      </P>

      <H2>Sécurité</H2>
      <P>Des mesures techniques raisonnables sont mises en œuvre pour protéger vos données contre l'accès non autorisé, la perte ou l'altération.</P>
    </Page>
  );
}

export function CGV({ onRetour, onNaviguer }) {
  const id = IDENTITE_EDITEUR;
  return (
    <Page titre="Conditions générales de vente" misÀJour="18 octobre 2026" onRetour={onRetour} onNaviguer={onNaviguer}>
      <H2>1. Objet</H2>
      <P>
        Les présentes conditions générales de vente ("CGV") régissent la vente des services proposés par{" "}
        {id.raisonSociale} sur la plateforme Cursus : abonnements CursEdit (assistant d'écriture), audits CursAudit
        (analyse de manuscrit à l'unité), et tout autre service payant proposé sur la plateforme.
      </P>

      <H2>2. Vendeur</H2>
      <P>
        {id.raisonSociale}, {id.adresse}, numéro d'entreprise {id.numéroEntreprise}. Contact : {id.email}.
      </P>

      <H2>3. Description des services</H2>
      <P>
        <strong>CursEdit</strong> est proposé sous forme d'abonnement récurrent (mensuel ou annuel), selon le palier
        choisi. <strong>CursAudit</strong> est proposé au paiement unique, par audit, dont le prix dépend du volume
        du texte soumis et des options choisies (mode d'analyse, palier de profondeur). Le prix exact est toujours
        affiché avant tout engagement de paiement.
      </P>

      <H2>4. Prix et paiement</H2>
      <P>
        Les prix sont indiqués en euros, toutes taxes comprises (TVA belge à 21 % incluse), sauf mention contraire.
        Le paiement est traité de façon sécurisée par notre prestataire Stripe. Aucune donnée bancaire n'est
        conservée par {id.raisonSociale}.
      </P>

      <H2>5. Droit de rétractation</H2>
      <P>
        Conformément à l'article VI.53 du Code de droit économique belge, le droit de rétractation de 14 jours ne
        s'applique pas aux contenus numériques et services dont l'exécution a commencé avec votre accord exprès
        avant la fin de ce délai (ex. un audit CursAudit dont l'analyse a été lancée). Pour un abonnement CursEdit,
        vous pouvez demander l'annulation à tout moment ; celle-ci prend effet à la fin de la période déjà payée.
      </P>

      <H2>6. Annulation d'un abonnement</H2>
      <P>
        La résiliation d'un abonnement CursEdit se fait actuellement sur simple demande écrite à {id.email}. Un
        outil de gestion autonome de l'abonnement sera proposé directement dans l'application à terme.
      </P>
      <P>
        Après annulation, l'accès aux fonctionnalités d'intelligence artificielle (co-pilote, suggestions, audits)
        est immédiatement suspendu. Vos textes et projets restent en revanche consultables — vous pouvez continuer
        à les ouvrir, les lire et les exporter — pendant une durée de <strong>3 mois</strong> après la fin de
        l'abonnement, mais en <strong>lecture seule</strong> : aucune modification, aucun nouvel import ni aucune
        création de contenu n'est possible sans réabonnement. Cette limite existe pour que Cursus reste un service
        payant d'assistance à l'écriture, et non un simple espace de stockage de texte gratuit une fois
        l'abonnement arrêté.
      </P>

      <H2>7. Nature du service — limites de l'intelligence artificielle</H2>
      <P>
        Les analyses, suggestions et audits produits par Cursus reposent sur des modèles d'intelligence artificielle
        (Claude d'Anthropic, GPT-4o d'OpenAI). Ces analyses constituent une aide à la décision éditoriale, jamais un
        avis professionnel engageant ni une garantie de résultat. L'auteur·ice reste seul·e responsable des choix
        éditoriaux, littéraires ou de publication qu'il ou elle prend.
      </P>

      <H2>8. Propriété intellectuelle</H2>
      <P>
        Les textes, manuscrits et contenus que vous soumettez à Cursus restent votre propriété exclusive.{" "}
        {id.raisonSociale} ne revendique aucun droit sur ces contenus et ne les utilise que pour vous fournir le
        service demandé.
      </P>

      <H2>9. Responsabilité</H2>
      <P>
        {id.raisonSociale} met tout en œuvre pour assurer la disponibilité et la fiabilité du service, sans pouvoir
        garantir une disponibilité continue. La responsabilité de {id.raisonSociale} ne saurait être engagée pour un
        dommage indirect résultant de l'usage du service.
      </P>

      <H2>10. Droit applicable</H2>
      <P>
        Les présentes CGV sont soumises au droit belge. Tout litige relève de la compétence exclusive des tribunaux
        de l'arrondissement judiciaire de Liège, sous réserve des dispositions impératives protectrices du
        consommateur.
      </P>
    </Page>
  );
}
