/**
 * CURSUS — Page dédiée CursDecision (référence 60816-01, suite, 04/09/2026)
 * ======================================================================
 * Contenu et plan intégralement rédigés par l'auteur du projet. Page à
 * part entière (pas une modale) accessible depuis EcranChoixEspace.jsx via
 * "Ouvrir CursDecision" ou "Découvrir CursDecision".
 *
 * ÉCART CONNU, ASSUMÉ : CursDecision n'a pour l'instant que cette page de
 * présentation — le pipeline réel (dépôt de situation → clarification →
 * note de décision) n'est pas encore construit. Les deux boutons de la
 * carte d'accueil pointent donc tous les deux ici pour le moment (voir
 * EcranChoixEspace.jsx). Le jour où le vrai outil existera, "Ouvrir"
 * devra rediriger vers l'espace de travail réel et seul "Découvrir"
 * restera sur cette page.
 */

const COULEUR = "#0E7256";

function Section({ titre, children }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COULEUR, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
        {titre}
      </div>
      {children}
    </div>
  );
}

const p = { fontSize: 14, color: "#333", lineHeight: 1.7, margin: "0 0 10px" };
const li = { fontSize: 14, color: "#333", lineHeight: 1.8 };
const ul = { margin: 0, paddingLeft: 20 };

export default function CursDecisionPage({ onRetour }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#f8f8f8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 24px 80px",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onRetour} style={{
          background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer",
          fontFamily: "inherit", padding: 0, marginBottom: 28,
        }}>
          ← Retour au choix de l'espace
        </button>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: COULEUR, marginBottom: 6 }}>CursDecision</div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 22 }}>
            Aide à la décision assistée par l'intelligence artificielle
          </div>
          <div style={{ fontSize: 17, color: "#1a1a1a", lineHeight: 1.5, fontWeight: 500 }}>
            Transformer une situation complexe ou floue<br />
            en décision claire, argumentée et suivable.
          </div>
        </div>

        <p style={{ ...p, fontSize: 14.5, marginBottom: 40 }}>
          CursDecision vous aide à passer d'une situation confuse — problème professionnel, choix
          stratégique, tension d'équipe, projet incertain, arbitrage personnel ou organisationnel —
          à une note de décision structurée.
        </p>

        <Section titre="Ce que fait CursDecision">
          <p style={{ ...p, fontWeight: 500 }}>CursDecision ne décide pas à votre place.</p>
          <p style={p}>Il vous aide à :</p>
          <ul style={ul}>
            <li style={li}>clarifier la situation ;</li>
            <li style={li}>distinguer les faits, les ressentis, les hypothèses et les informations manquantes ;</li>
            <li style={li}>formuler la vraie question à trancher ;</li>
            <li style={li}>explorer plusieurs options ;</li>
            <li style={li}>évaluer les risques, coûts, délais et impacts humains ;</li>
            <li style={li}>préparer une décision argumentée ;</li>
            <li style={li}>transformer cette décision en plan d'action suivable.</li>
          </ul>
        </Section>

        <Section titre="À partir de quoi CursDecision travaille">
          <p style={p}>Vous pouvez partir de matériaux très simples :</p>
          <ul style={ul}>
            <li style={li}>une description libre de la situation ;</li>
            <li style={li}>des notes personnelles ;</li>
            <li style={li}>un compte rendu de réunion ;</li>
            <li style={li}>des chiffres ou indicateurs ;</li>
            <li style={li}>un problème d'équipe ;</li>
            <li style={li}>une tension avec un client, un collaborateur ou un associé ;</li>
            <li style={li}>une décision à prendre ;</li>
            <li style={li}>un projet à lancer, arrêter, modifier ou reporter ;</li>
            <li style={li}>plusieurs options entre lesquelles vous hésitez.</li>
          </ul>
        </Section>

        <Section titre="La méthode">
          <div style={{ display: "grid", gap: 18 }}>
            {[
              ["1. Déposer la situation", "Vous décrivez ce qui se passe, même de manière imparfaite."],
              ["2. Clarifier", "CursDecision sépare les faits observés, les interprétations, les ressentis, les hypothèses et ce qui manque encore."],
              ["3. Reformuler la vraie question", "L'outil aide à transformer une demande floue en question décisionnelle claire."],
              ["4. Explorer les options", "CursDecision identifie les choix possibles, y compris ceux que l'on oublie souvent : attendre, tester, renoncer, demander une information, décider partiellement."],
              ["5. Évaluer", "Chaque option est examinée selon ses conséquences possibles : coût, délai, risque, impact humain, cohérence, réversibilité."],
              ["6. Produire une note d'aide à la décision", "La situation devient un document clair, transmissible ou utilisable pour décider."],
              ["7. Suivre", "La décision peut être transformée en plan d'action : actions, responsables, échéances, indicateurs et points de contrôle."],
            ].map(([titre, texte]) => (
              <div key={titre}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 3 }}>{titre}</div>
                <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6 }}>{texte}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section titre="Les livrables possibles">
          <p style={p}>CursDecision peut produire :</p>
          <ul style={ul}>
            <li style={li}>une note d'aide à la décision ;</li>
            <li style={li}>une synthèse de situation ;</li>
            <li style={li}>une analyse d'options ;</li>
            <li style={li}>une matrice avantages / risques ;</li>
            <li style={li}>une préparation de réunion ou d'entretien ;</li>
            <li style={li}>un plan d'action ;</li>
            <li style={li}>un rapport de suivi ;</li>
            <li style={li}>une note de conseil pour dirigeant, manager ou indépendant.</li>
          </ul>
        </Section>

        <Section titre="Pour quels usages ?">
          <p style={p}>CursDecision peut aider à traiter par exemple :</p>
          <ul style={ul}>
            <li style={li}>Dois-je recruter, réorganiser ou prioriser autrement ?</li>
            <li style={li}>Faut-il poursuivre, arrêter ou transformer ce projet ?</li>
            <li style={li}>Comment préparer une discussion difficile ?</li>
            <li style={li}>Quelle décision prendre face à une surcharge d'équipe ?</li>
            <li style={li}>Ce problème vient-il des personnes, de l'organisation, des priorités ou des moyens ?</li>
            <li style={li}>Quelle option est la plus cohérente avec mes objectifs ?</li>
            <li style={li}>Que puis-je décider maintenant, et que dois-je encore vérifier ?</li>
          </ul>
        </Section>

        <Section titre="Garde-fou essentiel">
          <div style={{
            padding: "16px 18px", borderLeft: `2.5px solid ${COULEUR}`,
            background: `${COULEUR}0d`, borderRadius: "0 8px 8px 0",
          }}>
            <p style={{ ...p, fontWeight: 600, marginBottom: 10 }}>CursDecision n'est pas un pilote automatique.</p>
            <p style={p}>
              Il ne remplace ni votre jugement, ni votre responsabilité, ni l'analyse humaine.
              Il ne pose pas de diagnostic psychologique sur les personnes.
              Il ne transforme pas une intuition en certitude.
            </p>
            <p style={{ ...p, marginBottom: 0 }}>
              Il organise les conditions d'un meilleur jugement :
              plus clair, plus argumenté, plus prudent et plus suivable.
            </p>
          </div>
        </Section>

        <div style={{ textAlign: "center", padding: "8px 0 0", borderTop: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, margin: "24px 0 0" }}>
            CursDecision transforme le désordre d'une situation en éléments clairs pour décider :<br />
            ce que l'on sait, ce que l'on suppose, ce qui manque,<br />
            ce qui est possible, ce qui est risqué,<br />
            et ce qu'il est raisonnable de faire ensuite.
          </p>
        </div>

        <button onClick={onRetour} style={{
          display: "block", margin: "40px auto 0", padding: "10px 28px", borderRadius: 8,
          border: `0.5px solid ${COULEUR}50`, background: "transparent", color: COULEUR,
          fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          Retour au choix de l'espace
        </button>
      </div>
    </div>
  );
}
