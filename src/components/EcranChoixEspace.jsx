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

export default function EcranChoixEspace({ onChoisir }) {
  const [infoOuverte, setInfoOuverte] = useState(null);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
    }}>
      {/* 22/08/2026, v2 — rectangle HORIZONTAL demandé pour l'équilibre
          visuel : recouvre la largeur des deux cartes CursEdit/CursAudit
          réunies (même maxWidth que leur rangée, 680px) plutôt qu'une
          carte verticale de même largeur qu'une seule d'entre elles.
          Logo à gauche, titre + tagline empilés à droite. */}
      <div style={{
        width: "100%", maxWidth: 680, display: "flex", alignItems: "center", gap: 24,
        padding: "24px 32px", borderRadius: 14,
        border: "0.5px solid #8B263540", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 36, boxSizing: "border-box",
      }}>
        <img src="/logo-cursus.png" alt="Cursus" style={{ height: 68, width: 68, borderRadius: 14, flexShrink: 0 }} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#8B2635", marginBottom: 4, letterSpacing: "0.01em" }}>Cursus</div>
          <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5 }}>
            Une suite d'écriture et d'audit assistée par IA.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Choisissez votre espace de travail</div>
      <div style={{ fontSize: 13, color: "#999", marginBottom: 36, textAlign: "center", maxWidth: 420 }}>
        Écrivez, structurez, relisez ou auditez vos textes selon votre besoin du moment.
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 680 }}>
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
            <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6, marginBottom: 18, flex: 1 }}>{e.accroche}</div>
            <button
              onClick={() => onChoisir(e.id)}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: e.couleur, color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", marginBottom: 10,
              }}
            >
              Ouvrir {e.nom}
            </button>
            <button
              onClick={() => setInfoOuverte(e)}
              style={{
                width: "100%", padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: "transparent", color: e.couleur, fontSize: 12.5, fontWeight: 500, fontFamily: "inherit",
              }}
            >
              Voir les fonctionnalités
            </button>
          </div>
        ))}
      </div>

      {infoOuverte && <FenêtreInfo espace={infoOuverte} onFermer={() => setInfoOuverte(null)} />}
    </div>
  );
}
