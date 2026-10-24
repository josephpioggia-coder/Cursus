/**
 * CURSUS — Mouvements doux de la pause « bouger » (24/10/2026). Textes écrits pour Cursus, mouvements classiques et sans risque
 * (respiration, mobilité du cou, des épaules, du buste, des poignets, des chevilles). Inspirés du tai chi sur chaise pour deux d'entre
 * eux ; Joseph doit fournir ou valider sa propre liste (elle est sur son ordinateur). Les figures sont dessinées par FigureChaise.jsx
 * à partir des `pose` ci-dessous : aucune image externe, aucun droit à régler.
 *
 * `pose` = images clés jouées en boucle (la dernière revient à la première). Paramètres (tous facultatifs) :
 *   tete   inclinaison de la tête en radians (+ = vers la droite de l'écran)
 *   epaules  0 à 1, épaules haussées
 *   torsion  -1 à 1, buste tourné
 *   g, d   bras gauche / droit de l'écran : [angle du bras, angle de l'avant-bras], 0 = vers le bas, 90 = à l'horizontale vers l'extérieur,
 *          180 = vers le haut (angles négatifs = vers l'intérieur)
 *   pg, pd  0 à 1, pied soulevé
 *   poignet  radians, petit cercle des mains
 *   debout   figure debout (sans chaise)
 */

export const BASE_POSE = { tete: 0, epaules: 0, torsion: 0, g: [8, 4], d: [8, 4], pg: 0, pd: 0, poignet: 0, debout: false };

export const EXERCICES = [
  { id: "ciel", famille: "souffle", titre: "Le souffle du ciel", duree: 45, pas: 2.6,
    consigne: "Assis bien droit, pieds à plat. En inspirant, lève lentement les bras sur les côtés jusqu'au-dessus de la tête ; en soufflant, redescends-les doucement. Cinq fois, au rythme de ta respiration.",
    pose: [{ g: [8, 4], d: [8, 4] }, { g: [170, 176], d: [170, 176] }] },
  { id: "ballon", famille: "souffle", titre: "Ouvrir les bras (inspiré du tai chi)", duree: 45, pas: 2.6,
    consigne: "Mains devant la poitrine, comme si tu tenais un gros ballon. En inspirant, ouvre les bras largement ; en soufflant, ramène les mains devant toi. Six fois, sans forcer.",
    pose: [{ g: [30, -140], d: [30, -140] }, { g: [95, 95], d: [95, 95] }] },
  { id: "epaules", famille: "haut", titre: "Les épaules", duree: 30, pas: 1.6,
    consigne: "Monte les épaules vers les oreilles en inspirant, laisse-les retomber en soufflant par la bouche. Puis fais cinq grands cercles lents vers l'arrière.",
    pose: [{ epaules: 0 }, { epaules: 1 }] },
  { id: "cou", famille: "haut", titre: "Le cou", duree: 35, pas: 2.2,
    consigne: "Incline doucement l'oreille vers l'épaule, reste trois respirations, reviens au centre, puis de l'autre côté. Garde les épaules basses et ne force jamais.",
    pose: [{ tete: 0 }, { tete: 0.4 }, { tete: 0 }, { tete: -0.4 }] },
  { id: "torsion", famille: "haut", titre: "La torsion douce", duree: 40, pas: 2.4,
    consigne: "Pose les mains sur les cuisses. En soufflant, tourne lentement le buste et le regard vers un côté sans bouger les hanches, reviens au centre, puis de l'autre côté. Quatre fois de chaque côté.",
    pose: [{ torsion: 0, g: [22, -25], d: [22, -25] }, { torsion: 1, g: [22, -25], d: [22, -25] }, { torsion: 0, g: [22, -25], d: [22, -25] }, { torsion: -1, g: [22, -25], d: [22, -25] }] },
  { id: "poignets", famille: "bas", titre: "Les mains et les poignets", duree: 35, pas: 1.8,
    consigne: "Lève les avant-bras devant toi. Ouvre et ferme les mains dix fois, puis fais des cercles lents avec les poignets dans un sens, puis dans l'autre.",
    pose: [{ g: [40, -165], d: [40, -165], poignet: 0 }, { g: [40, -165], d: [40, -165], poignet: 3.14 }, { g: [40, -165], d: [40, -165], poignet: 6.28 }] },
  { id: "chevilles", famille: "bas", titre: "Les chevilles et les jambes", duree: 35, pas: 1.8,
    consigne: "Soulève un pied et dessine huit petits cercles avec la cheville, puis change de pied. Ensuite, tends doucement chaque jambe devant toi et repose-la.",
    pose: [{ pg: 0, pd: 0 }, { pg: 1, pd: 0 }, { pg: 0, pd: 0 }, { pg: 0, pd: 1 }] },
  { id: "debout", famille: "bas", titre: "Se lever et marcher", duree: 60, pas: 1.4,
    consigne: "Lève-toi, marche jusqu'à la fenêtre ou la cuisine, bois un verre d'eau et regarde au loin quelques instants. Étire-toi comme tu en as envie.",
    pose: [{ debout: true, g: [22, 14], d: [-12, -8] }, { debout: true, g: [-12, -8], d: [22, 14] }] },
];

export const exercice = (id) => EXERCICES.find((e) => e.id === id);

/** Pause express (≈ 2 minutes) : un mouvement de souffle, un pour le haut du corps, un pour le bas ou se lever. */
export function pauseExpress(rng = Math.random) {
  const tire = (fam) => { const l = EXERCICES.filter((e) => e.famille === fam); return l[Math.floor(rng() * l.length)]; };
  return [tire("souffle"), tire("haut"), tire("bas")];
}

export const AVERTISSEMENT = "Des mouvements doux, à faire sur une chaise stable, sans forcer : arrête-toi au moindre inconfort. Ils ne remplacent pas l'avis d'un médecin ou d'un kinésithérapeute.";
