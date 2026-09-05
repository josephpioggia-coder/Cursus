/**
 * CURSUS — Écran de choix d'espace (CursEdit / CursAudit)
 * ======================================================================
 * Chantier 2 de docs/cursaudit-cartographie-technique.md ("Navigation/UX —
 * CursEdit et CursAudit à l'accueil"), conçu et validé en maquette le
 * 09/08/2026, codé le 16/08/2026. S'affiche une fois après connexion
 * (choix mémorisé pour la session du navigateur, pas de façon permanente —
 * voir sessionStorage dans App.jsx), avant d'entrer dans l'un ou l'autre
 * produit.
 *
 * TEXTES du 22/08/2026 : rédigés intégralement par l'auteur du projet
 * (en-tête, accroches, contenu des fenêtres "Voir les fonctionnalités").
 * Certains éléments décrits pour CursAudit (questionnaire de qualification
 * du texte, "degré d'intervention" jusqu'à la réécriture) correspondent à
 * la conception déjà figée du produit mais ne sont PAS ENCORE câblés dans
 * l'écran de création actuel (CursAudit.jsx, qui ne propose que
 * titre/texte/palier/mode/format) — écart connu, assumé, à résorber quand
 * ces briques seront construites.
 *
 * PONT BIDIRECTIONNEL — pas encore construit ici : la maquette prévoit de
 * pouvoir passer d'un projet CursEdit à son audit sans réimporter, avec un
 * badge "Audit partiel" sur le projet en cours d'audit. Cet écran ne fait
 * que le choix initial d'espace ; le pont lui-même (lien projet ↔ audit,
 * badge) reste à construire séparément.
 */

import { useState } from "react";
import CursDecisionPage from "./CursDecisionPage.jsx";

const ESPACES = [
  {
    id: "cursedit",
    nom: "CursEdit",
    accroche: "Écrire, structurer, être accompagné·e par l'IA pendant la rédaction.",
    couleur: "#7F77DD",
    logo: "/logo-cursedit.png",
    info: {
      sousTitre: "Votre espace d'écriture accompagné par IA",
      intro: [
        "CursEdit vous aide à transformer une idée, un fragment, un chapitre ou un projet complet en texte structuré, cohérent et fidèle à votre intention.",
        "Il ne remplace pas l'auteur. Il l'accompagne.",
      ],
      differenciation: "Vous pouvez suivre une formation pour apprendre à écrire. Avec CursEdit, vous travaillez directement dans votre manuscrit, avec un copilote qui connaît votre projet, votre intention, vos personnages, vos scènes, vos faiblesses et vos versions successives.",
      permet: [
        "Structurer un livre, un essai, un récit ou un document long en parties, chapitres et sections.",
        "Clarifier l'intention du projet : public visé, ton, niveau de profondeur, limites, promesse faite au lecteur.",
        "Organiser les idées, citations, notes, scènes, personnages ou références.",
        "Développer un plan progressif sans perdre la vision d'ensemble.",
        "Être accompagné pendant la rédaction par une IA qui tient compte du contexte du projet.",
        "Reformuler, alléger, enrichir ou resserrer un passage selon le degré d'intervention choisi.",
        "Préserver la voix de l'auteur au lieu de lisser le texte.",
        "Préparer l'export d'un manuscrit ou d'un document structuré.",
      ],
      usagesIntro: "CursEdit peut accompagner :",
      usages: [
        "l'écriture d'un livre",
        "la construction d'un essai",
        "la rédaction d'un mémoire ou d'un travail long",
        "la préparation d'articles",
        "l'organisation de notes personnelles",
        "la transformation de fragments en chapitre",
        "la réécriture progressive d'un manuscrit",
      ],
      esprit: [
        "CursEdit n'est pas un générateur automatique de texte.",
        "C'est un atelier d'écriture augmenté.",
        "L'IA aide à clarifier, structurer, questionner, proposer.",
        "L'auteur garde la direction, le sens et la responsabilité du texte.",
      ],
    },
  },
  {
    id: "cursaudit",
    nom: "CursAudit",
    accroche: "Auditer un texte déjà écrit : preuve, cohérence, risques, sur une grille de critères.",
    couleur: "#1D9E75",
    logo: "/logo-cursaudit.png",
    info: {
      sousTitre: "Votre espace d'audit critique des textes",
      intro: [
        "CursAudit analyse un texte déjà écrit pour en vérifier la cohérence, la solidité, le niveau de preuve, les risques de glissement et la clarté argumentative.",
        "Il ne cherche pas d'abord à réécrire.",
        "Il commence par comprendre ce que le texte prétend faire.",
      ],
      differenciation: "Là où une formation vous apprend les principes, CursAudit audite votre texte réel : contrat de lecture, personnages, preuves, cohérence, risques, répétitions, promesse faite au lecteur et chantiers de réécriture.",
      permet: [
        "Identifier le type de texte : mémoire, essai, manuscrit, article, rapport, témoignage, correspondance ou document personnel.",
        "Clarifier le statut du texte : brouillon, version avancée, texte déjà envoyé, version publiée ou document à retravailler.",
        "Définir la question d'audit avant toute analyse.",
        "Choisir le degré d'intervention : observation, signalement, pistes, reformulation limitée ou réécriture plus libre.",
        "Évaluer le type d'énoncé : fait, hypothèse, interprétation, témoignage, jugement, métaphore, prescription.",
        "Mesurer le niveau de preuve nécessaire et le niveau de preuve disponible.",
        "Repérer les affirmations insuffisamment sourcées.",
        "Identifier les généralisations abusives ou les glissements de registre.",
        "Vérifier la cohérence interne d'un passage, d'un chapitre ou d'un manuscrit.",
        "Distinguer récit personnel, analyse, pédagogie, théorie, spiritualité, argumentation et promesse faite au lecteur.",
        "Signaler les zones sensibles : médicales, thérapeutiques, académiques, juridiques, relationnelles ou éthiques.",
        "Préserver la voix de l'auteur sans produire un texte artificiellement lissé.",
        "Produire un diagnostic clair : recevable, à nuancer, à sourcer, à reformuler ou à expertiser.",
      ],
      niveaux: [
        { titre: "Audit essentiel — 8 critères", texte: "Pour obtenir rapidement un diagnostic clair sur la cohérence, le statut des affirmations et les principaux risques." },
        { titre: "Audit approfondi — 15 critères", texte: "Pour examiner plus finement les preuves, les sources, la structure argumentative, les effets de style et la portée des affirmations." },
        { titre: "Audit expert — 30 critères", texte: "Pour une analyse complète : niveau de preuve, contrat de lecture, promesse au lecteur, risques éthiques, glissements de registre, cohérence longitudinale et recommandations d'action." },
      ],
      usagesIntro: "CursAudit peut être utilisé pour :",
      usages: [
        "relire un mémoire ou un TFE sans l'écrire à la place de l'étudiant",
        "vérifier la cohérence d'un chapitre de livre",
        "auditer un texte thérapeutique, spirituel ou pédagogique",
        "repérer les passages trop affirmatifs ou insuffisamment prouvés",
        "analyser un texte généré ou retravaillé avec IA",
        "préserver la voix d'un auteur",
        "préparer une réédition ou une version plus fluide d'un manuscrit",
        "produire une grille d'audit exploitable",
      ],
      esprit: [
        "CursAudit ne juge pas l'auteur.",
        "Il examine le texte.",
        "Il distingue ce qui est vécu, affirmé, interprété, démontré ou simplement suggéré.",
        "Son rôle est d'aider à voir plus clair avant de corriger.",
      ],
    },
  },
  {
    // 04/09/2026 — troisième espace, conçu et rédigé par l'auteur du projet.
    // Contrairement à CursEdit/CursAudit, pas de fenêtre "Voir les
    // fonctionnalités" (pas de champ `info`) : le détail va dans une page
    // dédiée (CursDecisionPage.jsx), pas une modale — demande explicite.
    // Logo en public/logo-cursdecision-v2.png — renommé le 05/09/2026 pour
    // casser le cache CDN/navigateur sur l'ancienne version (le dossier
    // public/ n'est pas hashé automatiquement comme les bundles JS).
    id: "cursdecision",
    nom: "CursDecision",
    accroche: "Transformer une situation complexe ou floue en décision claire, argumentée et suivable.",
    description: "Clarifier les faits, explorer les options, mesurer les risques et préparer une décision.",
    couleur: "#0E7256",
    logo: "/logo-cursdecision-v2.png",
    libelléLien: "Découvrir CursDecision",
  },
];

function Rubrique({ titre, couleur, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: couleur, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {titre}
      </div>
      {children}
    </div>
  );
}

function FenêtreInfo({ espace, onFermer }) {
  const i = espace.info;
  return (
    <div
      onClick={onFermer}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, padding: "28px 30px", maxWidth: 500, width: "100%",
          maxHeight: "84vh", overflowY: "auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <img src={espace.logo} alt={espace.nom} style={{ width: 40, height: "auto" }} />
          <button onClick={onFermer} style={{
            background: "none", border: "none", fontSize: 18, color: "#999", cursor: "pointer", lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 18 }}>{i.sousTitre}</div>

        {i.intro.map((p, idx) => (
          <p key={idx} style={{ fontSize: 13.5, color: "#333", lineHeight: 1.6, margin: "0 0 8px" }}>{p}</p>
        ))}

        {i.differenciation && (
          <p style={{
            fontSize: 13.5, color: espace.couleur, lineHeight: 1.6, fontWeight: 500,
            margin: "10px 0 0", padding: "10px 12px", borderLeft: `2.5px solid ${espace.couleur}`,
            background: `${espace.couleur}0d`, borderRadius: "0 6px 6px 0",
          }}>
            {i.differenciation}
          </p>
        )}
        <div style={{ height: 12 }} />

        <Rubrique titre={`Ce que ${espace.nom} permet`} couleur={espace.couleur}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#333", lineHeight: 1.8 }}>
            {i.permet.map((ligne, idx) => <li key={idx}>{ligne}</li>)}
          </ul>
        </Rubrique>

        {i.niveaux && (
          <Rubrique titre="Trois niveaux d'audit" couleur={espace.couleur}>
            <div style={{ display: "grid", gap: 10 }}>
              {i.niveaux.map((n, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{n.titre}</div>
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{n.texte}</div>
                </div>
              ))}
            </div>
          </Rubrique>
        )}

        <Rubrique titre="Pour quels usages ?" couleur={espace.couleur}>
          <p style={{ fontSize: 13.5, color: "#333", margin: "0 0 6px" }}>{i.usagesIntro}</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#333", lineHeight: 1.8 }}>
            {i.usages.map((ligne, idx) => <li key={idx}>{ligne}</li>)}
          </ul>
        </Rubrique>

        <Rubrique titre={`L'esprit de ${espace.nom}`} couleur={espace.couleur}>
          {i.esprit.map((p, idx) => (
            <p key={idx} style={{ fontSize: 13.5, color: "#333", lineHeight: 1.6, margin: "0 0 4px" }}>{p}</p>
          ))}
        </Rubrique>

        <button onClick={onFermer} style={{
          width: "100%", padding: "9px 0", borderRadius: 8, border: `0.5px solid ${espace.couleur}50`,
          background: "transparent", color: espace.couleur, fontSize: 13, fontWeight: 500, cursor: "pointer",
          fontFamily: "inherit", marginTop: 4,
        }}>
          Retour au choix
        </button>
      </div>
    </div>
  );
}

export default function EcranChoixEspace({ onChoisir, onVoirTarification }) {
  const [infoOuverte, setInfoOuverte] = useState(null);
  // CursDecision n'a pas encore d'espace de travail réel (voir note dans
  // CursDecisionPage.jsx) : "Ouvrir" et "Découvrir" mènent tous les deux
  // ici pour l'instant, au lieu d'un vrai `onChoisir("cursdecision")`.
  const [pageDécisionOuverte, setPageDécisionOuverte] = useState(false);

  if (pageDécisionOuverte) {
    return <CursDecisionPage onRetour={() => setPageDécisionOuverte(false)} />;
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
    }}>
      {/* 22/08/2026, v3 — largeur = exactement celle des deux cartes
          CursEdit/CursAudit réunies (300 + 20 de gap + 300 = 620px), ratio
          732:280, liseré doré #C4973A, logo centré au-dessus du titre.
          04/09/2026 — repositionné autour de "Cursus Essentiel" : l'offre
          d'accès global remplace la simple accroche produit. */}
      <div id="offre-cursus-essentiel" style={{
        width: 620, boxSizing: "border-box",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "22px 24px", borderRadius: 14,
        border: "0.5px solid #C4973A80", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 36,
      }}>
        {/* Logo agrandi ×1,75 (56→98px), demandé après premier retour */}
        <img src="/logo-cursus.png" alt="Cursus" style={{ height: 98, width: 98, borderRadius: 16, marginBottom: 6 }} />
        <div style={{ fontSize: 24, fontWeight: 600, color: "#8B2635", marginBottom: 6, letterSpacing: "0.01em" }}>Cursus</div>
        <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, textAlign: "center", maxWidth: 460, marginBottom: 4 }}>
          Une suite assistée par l'intelligence artificielle pour écrire, auditer et décider avec méthode.
        </div>
        <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5, textAlign: "center", maxWidth: 460, marginBottom: 16 }}>
          Activez Cursus Essentiel et accédez aux trois espaces de travail : CursEdit, CursAudit et CursDecision.
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center",
          padding: "10px 18px", borderRadius: 10, background: "#8B263508", marginBottom: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#8B2635", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Offre de lancement
          </span>
          <span style={{ fontSize: 13.5, color: "#333" }}>
            Cursus Essentiel — 60€ pour la première année
          </span>
        </div>
        {/* 05/09/2026 — mène à la page Tarification existante (paliers
            CursEdit) plutôt qu'à un mailto : pas encore de palier "Cursus
            Essentiel" séparé côté Stripe, donc on montre la tarification
            actuelle en attendant la migration. */}
        <button
          onClick={onVoirTarification}
          style={{
            padding: "9px 22px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "#8B2635", color: "#fff", fontSize: 13.5, fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Rejoindre l'offre de lancement
        </button>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Trois espaces inclus dans Cursus Essentiel</div>
      <div style={{ fontSize: 13, color: "#999", marginBottom: 36, textAlign: "center", maxWidth: 420 }}>
        Découvrez ce que chaque espace permet — l'ouverture est réservée aux membres de Cursus Essentiel.
      </div>

      {/* 05/09/2026 — maxWidth élargi de 680 (dimensionné pour 2 cartes) à
          960 : 3 cartes de 300px + 2 gaps de 20px = 940px, sinon la
          troisième (CursDecision) passe à la ligne. */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 960 }}>
        {ESPACES.map((e) => (
          <div
            key={e.id}
            style={{
              width: 300, textAlign: "left", padding: "28px 24px", borderRadius: 14,
              border: `0.5px solid ${e.couleur}30`, background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column",
            }}
          >
            <img src={e.logo} alt={e.nom} style={{ width: 110, height: "auto", display: "block", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6, marginBottom: e.description ? 6 : 18, flex: e.description ? "none" : 1 }}>{e.accroche}</div>
            {e.description && (
              <div style={{ fontSize: 12, color: "#999", lineHeight: 1.6, marginBottom: 18, flex: 1 }}>{e.description}</div>
            )}
            {/* 04/09/2026 — "Ouvrir X" n'est plus un accès libre : seul
                "Voir les fonctionnalités" / "Découvrir CursDecision" reste
                gratuit à l'ouverture (décision explicite). L'ouverture réelle
                est réservée aux membres Cursus Essentiel — pas encore de
                vérification d'abonnement câblée (couche suivante), donc pas
                de bouton qui prétend ouvrir l'espace : renvoi vers l'offre. */}
            <a
              href="#offre-cursus-essentiel"
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8, cursor: "pointer",
                background: "#f3f3f3", color: "#999", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                marginBottom: 10, textAlign: "center", textDecoration: "none", boxSizing: "border-box",
                border: "0.5px dashed #ccc",
              }}
            >
              Nécessite Cursus Essentiel
            </a>
            <button
              onClick={() => (e.info ? setInfoOuverte(e) : setPageDécisionOuverte(true))}
              style={{
                width: "100%", padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: "transparent", color: e.couleur, fontSize: 12.5, fontWeight: 500, fontFamily: "inherit",
              }}
            >
              {e.libelléLien || "Voir les fonctionnalités"}
            </button>
          </div>
        ))}
      </div>

      {infoOuverte && <FenêtreInfo espace={infoOuverte} onFermer={() => setInfoOuverte(null)} />}
    </div>
  );
}
