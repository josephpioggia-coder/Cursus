/**
 * CURSUS — Salle des jeux de mots (30/09/2026)
 * ======================================================================
 * Demande de Joseph : avant d'ouvrir le jeu à plusieurs (invitation d'un ami, mode invité,
 * abonnement), étoffer le catalogue pour que les gens aient envie de rester. Cette page
 * regroupe les jeux. Le premier est le module Scrabble existant (solveur de grille, outils de
 * mots, partie contre l'ordinateur — ScrabbleSolveur.jsx, ouvert tel quel) ; les autres sont
 * dans src/components/jeux/ et partagent leurs données (dictionnaire + mots courants), chargées
 * une seule fois à l'ouverture du premier jeu qui en a besoin.
 *
 * Pour AJOUTER un jeu : un composant `{ donnees }` dans src/components/jeux/, son moteur dans
 * src/lib/jeuxDeMots.js, et une ligne dans JEUX ci-dessous.
 */

import { useState, useEffect } from "react";
import ScrabbleSolveur from "./ScrabbleSolveur.jsx";
import Motus from "./jeux/Motus.jsx";
import Pendu from "./jeux/Pendu.jsx";
import Boggle from "./jeux/Boggle.jsx";
import MotLePlusLong from "./jeux/MotLePlusLong.jsx";
import EchelleDeMots from "./jeux/EchelleDeMots.jsx";
import MotsMeles from "./jeux/MotsMeles.jsx";
import MotsCroises from "./jeux/MotsCroises.jsx";
import MotsFleches from "./jeux/MotsFleches.jsx";
import MotsCodes from "./jeux/MotsCodes.jsx";
import MotsEnCercle from "./jeux/MotsEnCercle.jsx";
import AuPalmares from "./jeux/AuPalmares.jsx";
import DevineLeLivre from "./jeux/DevineLeLivre.jsx";
import QuelLecteur from "./jeux/QuelLecteur.jsx";
import { chargerLivres } from "../lib/jeuLivres.js";
import { chargerPalmares } from "../lib/jeuPalmares.js";
import { chargerMotsCroises } from "../lib/grillesMots.js";
import { chargerMoteur } from "../lib/jeuMots.js";
import { chargerListe, chargerMotsCourants } from "../lib/jeuxDeMots.js";

const JEUX = [
  { id: "grille", icone: "🔤", titre: "Jeu de mots sur grille", resume: "Solveur de grille à partir d'une capture, outils de mots, et partie contre l'ordinateur.", propre: true },
  { id: "motus", icone: "🟥", titre: "Motus", resume: "Trouve le mot en 6 essais, la première lettre est donnée.", Composant: Motus },
  { id: "boggle", icone: "🎲", titre: "Boggle 4×4", resume: "Un maximum de mots dans une grille de 16 lettres, en 3 minutes.", Composant: Boggle },
  { id: "long", icone: "📏", titre: "Le mot le plus long", resume: "Dix lettres, une minute : le plus long mot gagne.", Composant: MotLePlusLong },
  { id: "pendu", icone: "🪢", titre: "Pendu", resume: "Devine le mot lettre par lettre avant la dernière erreur.", Composant: Pendu },
  { id: "echelle", icone: "🪜", titre: "Échelle de mots", resume: "Change une lettre à la fois pour passer d'un mot à un autre.", Composant: EchelleDeMots },
  { id: "meles", icone: "🔎", titre: "Mots mêlés", resume: "Retrouve les mots cachés dans la grille.", Composant: MotsMeles },
  { id: "cercle", icone: "⭕", titre: "Mots en cercle", resume: "Relie les lettres du cercle du bout du doigt pour trouver tous les mots cachés.", Composant: MotsEnCercle },
  { id: "croises", icone: "✏️", titre: "Mots croisés", resume: "Une grille, des définitions : trois niveaux.", Composant: MotsCroises },
  { id: "fleches", icone: "➡️", titre: "Mots fléchés", resume: "Les définitions sont dans la grille, les flèches montrent le sens.", Composant: MotsFleches },
  { id: "codes", icone: "🔢", titre: "Mots codés", resume: "Chaque numéro cache une lettre : déchiffre la grille.", Composant: MotsCodes },
  { id: "livre", icone: "📚", titre: "Devine le livre", resume: "Cinq indices, un best-seller de France ou de Belgique : trouve-le le plus vite possible.", Composant: DevineLeLivre, leger: true },
  { id: "palmares", icone: "📊", titre: "Au palmarès", resume: "Les vrais chiffres du Top 200 des ventes de livres : devine qui est devant.", Composant: AuPalmares, leger: true },
  { id: "lecteur", icone: "🔖", titre: "Quel lecteur es-tu ?", resume: "Huit questions sur tes goûts, trois livres faits pour toi.", Composant: QuelLecteur, leger: true },
];

let donneesEnCache = null;
async function chargerDonnees() {
  if (donneesEnCache) return donneesEnCache;
  const [moteur, liste, courants, croises] = await Promise.all([chargerMoteur(), chargerListe(), chargerMotsCourants(), chargerMotsCroises()]);
  donneesEnCache = { trie: moteur.trie, ensemble: moteur.ensemble, mots: liste.mots, courants, croises };
  return donneesEnCache;
}

const carte = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--color-text-primary)" };

export default function SalleDesJeux({ jeuInitial = null }) {
  const [jeu, setJeu] = useState(null);
  const [donnees, setDonnees] = useState(donneesEnCache);
  const [etat, setEtat] = useState(""); // "" | "chargement" | message d'erreur
  const [livres, setLivres] = useState(null); // jeux « légers » (livres) : pas besoin du dictionnaire de 411 000 mots

  const ouvrir = async (j) => {
    if (j.leger) {
      if (livres) { setJeu(j.id); return; }
      setEtat("chargement");
      try { const [lv, pa] = await Promise.all([chargerLivres(), chargerPalmares()]); setLivres({ livres: lv, palmares: pa }); setEtat(""); setJeu(j.id); } catch (e) { setEtat(e.message || String(e)); }
      return;
    }
    if (j.propre || donnees) { setJeu(j.id); return; }
    setEtat("chargement");
    try { setDonnees(await chargerDonnees()); setEtat(""); setJeu(j.id); }
    catch (e) { setEtat(e.message || String(e)); }
  };
  const courant = JEUX.find((j) => j.id === jeu);
  // Lien direct (« ?jeu=croises ») : ouvre ce jeu dès l'arrivée ; un id inconnu ou « salle » laisse la liste.
  useEffect(() => { const j = JEUX.find((x) => x.id === jeuInitial); if (j) ouvrir(j); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (courant?.propre) {
    return (
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 20px 0" }}><button onClick={() => setJeu(null)} style={{ background: "transparent", border: "none", color: "#1D9E75", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>← Tous les jeux</button></div>
        <ScrabbleSolveur />
      </div>
    );
  }
  if (courant) {
    const { Composant } = courant;
    return (
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", padding: "16px 20px 60px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <button onClick={() => setJeu(null)} style={{ background: "transparent", border: "none", color: "#1D9E75", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 12 }}>← Tous les jeux</button>
          <Composant donnees={courant.leger ? livres : donnees} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <img src="/aencre-icone.png" alt="Æncre" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Jeux de mots</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: "0 0 18px" }}>
          Une pause entre deux chapitres : joue avec les lettres et les mots. Le dictionnaire est une liste libre proche du Scrabble, pas l'ODS officiel.
        </p>
        {etat === "chargement" && <div style={{ fontSize: 13, color: "#BA7517", marginBottom: 10 }}>⏳ Chargement des dictionnaires (quelques secondes la première fois)…</div>}
        {etat && etat !== "chargement" && <div style={{ fontSize: 13, color: "#c0392b", marginBottom: 10 }}>{etat}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
          {JEUX.map((j) => (
            <button key={j.id} onClick={() => ouvrir(j)} disabled={etat === "chargement"} style={carte}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{j.icone}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{j.titre}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{j.resume}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
