// Test du moteur « Interroger le livre » (src/lib/interrogerLivre.js) sur un MINI-LIVRE inventé — aucun texte réel, aucun réseau.
// Lancer : node scripts/tester-interroger-livre.mjs   (code de sortie 1 si un contrôle échoue)
import * as M from "../src/lib/interrogerLivre.js";

let échecs = 0;
const ok = (c, m) => { console.log((c ? "OK     " : "ÉCHEC  ") + m); if (!c) échecs++; };

const livre = [
  { id: "c1", titre: "Chapitre 1", zone: "corps", texte: ["Elle aimait la mer. Son amour de la lecture ne la quittait pas.", "Un paragraphe sans rapport.", "J'aime dire que tout va bien."] },
  { id: "c2", titre: "Chapitre 2", zone: "corps", texte: ["Préface : « L'amour est une pratique », écrit un tiers.", "Mon mari m'a donné de la tendresse."] },
  { id: "brouillon", titre: "Brouillon", zone: "reserve", texte: ["Un amour jamais publié."] },
];
const nœuds = livre.map((n) => ({ ...n, texte: JSON.stringify(n.texte) }));
const blocs = (h) => JSON.parse(h).map((texte) => ({ texte }));

const passages = M.passagesDuLivre(nœuds, { blocs });
ok(passages.length === 5, "passages du corps seulement (5), brouillon exclu");
ok(M.passagesDuLivre(nœuds, { blocs, horsCorps: true }).length === 6, "brouillon inclus sur demande");

const termes = M.analyserTermes("amour, aim, tendresse, affection, =aime");
const { candidats, parTerme } = M.repérer(passages, termes);
ok(parTerme.amour === 2 && parTerme.aim === 2 && parTerme.tendresse === 1 && parTerme.affection === 0, "comptes par mot (affection = 0)");
ok(parTerme["=aime"] === 1 && candidats.length === 4, "« =aime » exact trouve « j'aime » mais pas « aimait » ; 4 passages repérés");
ok(M.analyserTermes("Aim, aim, =Aim").length === 2, "mots dédoublonnés, casse ignorée");

const d = M.devis(candidats);
ok(d.passages === 4 && d.tokensTotal > 0 && d.analyses > 0 && d.lots === 1, "devis cohérent");

ok(M.citationPrésente("Son amour de la lecture", candidats[0].texte), "citation exacte acceptée");
ok(!M.citationPrésente("Son amour de la danse", candidats[0].texte), "citation inventée refusée");
ok(M.citationPrésente("Elle aimait […] la lecture", candidats[0].texte), "morceaux séparés par […] acceptés");
ok(!M.citationPrésente("amour", candidats[0].texte), "citation trop courte refusée");

const lignes = M.analyserClassement("[P1] Amour de la lecture | NOMMÉ | « Son amour de la lecture » | AUTEUR\n- [P2] HORS_SUJET\nP3 Amour pratique | DÉDUIT | « L'amour est une pratique » | AUTRE : préface\nbruit");
ok(lignes.length === 3 && lignes[2].voix === "préface" && lignes[1].horsSujet, "lecture des lignes de l'IA");

// IA simulée avec pièges : fausse citation (P2) et ligne manquante (P4)
const catégories = M.analyserCatégories("Amour de la lecture : goût des livres\nAmour pratique : l'amour comme exercice");
let appels = 0;
const appel = async (_s, user) => {
  appels++;
  const n = user.split(/\n\n(?=\[P\d+\] )/).length;
  const L = ["[P1] Amour de la lecture | NOMMÉ | « Son amour de la lecture » | AUTEUR",
    "[P2] Amour pratique | NOMMÉ | « une phrase qui n'existe pas dans le livre » | AUTEUR",
    "[P3] HORS_SUJET"];
  return { texte: L.slice(0, Math.min(n, 3)).join("\n"), tronque: false };
};
const r = await M.lancerRelevé({ question: "q", catégories, candidats, appel });
ok(r.items.length === 1 && r.items[0].catégories[0] === "Amour de la lecture", "une citation vérifiée retenue");
ok(r.écartées.length === 1, "citation inventée écartée et comptée");
ok(r.nonTraités.length === 1, "passage sans ligne signalé non traité");
ok(r.horsSujet === 1, "hors sujet compté");

// Réponse tronquée : le lot est coupé en deux et refait
let n2 = 0;
const appelTronque = async (_s, user) => { n2++; const n = user.split(/\n\n(?=\[P\d+\] )/).length; return { texte: "", tronque: n2 === 1 && n > 1 }; };
await M.lancerRelevé({ question: "q", catégories, candidats, appel: appelTronque });
ok(n2 >= 3, "réponse tronquée : lot scindé et relancé");

// Refus de l'IA
const rr = await M.lancerRelevé({ question: "q", catégories, candidats, appel: async () => ({ texte: "Je ne peux pas.", tronque: false }), detecterRefus: () => true });
ok(rr.erreurs.length === 1 && rr.nonTraités.length === 4, "refus de l'IA signalé, aucun passage perdu en silence");

const s = M.synthétiser({ catégories, items: r.items, candidats: 4, horsSujet: r.horsSujet, écartées: r.écartées, nonTraités: r.nonTraités, erreurs: r.erreurs });
ok(s.parCatégorie.length === 2 && s.parCatégorie[0].n === 1 && s.pertinents === 1, "synthèse par catégorie");
ok(M.versMarkdown({ titreProjet: "Test", question: "q", termes: "amour", relevé: s }).includes("« Son amour de la lecture »"), "export Markdown");

console.log(échecs ? `\n${échecs} contrôle(s) en échec` : "\nTous les contrôles passent.");
process.exit(échecs ? 1 : 0);
