/**
 * PLAN DU LIVRE pour le Co-pilote (25/10/2026) — fonctions PURES.
 *
 * Retour de Joseph : « eux tu à présent me proposer une intro qui tienne compte
 * des chapitres précédents et introduise celui-ci » → le Co-pilote répondait
 * (à juste titre) qu'il n'avait accès qu'au chapitre ouvert : ni sommaire, ni
 * titres des autres chapitres, ni leur contenu.
 *
 * Deux sorties, toutes deux calculées à partir de l'arbre `projetActif.structure`
 * (voir construireArbre, App.jsx — chaque nœud porte `titre`, `type`, `zone`,
 * `texte` HTML mis à jour pendant la frappe, `enfants`) :
 *  - `plan`  : le sommaire en texte (titres dans l'ordre, indentés par niveau,
 *              chapitre ouvert marqué). Gratuit, léger, exact. Aucun contenu.
 *  - `précédent` : le nœud de TEXTE qui précède le chapitre ouvert dans l'ordre
 *              de lecture (titre + HTML), pour l'option « joindre le chapitre
 *              précédent ». Jamais joint sans choix explicite de l'auteur·ice.
 *
 * Seules les notes de corps comptent : les nœuds d'une autre zone (ex. « methodo »,
 * note de cadrage) sont ignorés, comme dans l'éditeur.
 */

const estCorps = (n) => (n.zone || "corps") === "corps";

/** Aplatit l'arbre en ordre de lecture (profondeur d'abord). */
export function aplatirPlan(structure, niveau = 0, sortie = []) {
  for (const n of structure || []) {
    if (!estCorps(n)) continue;
    sortie.push({ id: n.id, titre: n.titre || "", type: n.type || "chapitre", niveau, texte: n.texte || "" });
    if (n.enfants?.length) aplatirPlan(n.enfants, niveau + 1, sortie);
  }
  return sortie;
}

const texteBrut = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Chemin (racine → nœud) vers `id` dans l'arbre COMPLET, toutes zones confondues ; null si absent. */
function cheminVers(structure, id, chemin = []) {
  for (const n of structure || []) {
    if (n.id === id) return [...chemin, n];
    const trouvé = cheminVers(n.enfants, id, [...chemin, n]);
    if (trouvé) return trouvé;
  }
  return null;
}

/**
 * @returns {{ plan: string|null, précédent: {id: string, titre: string, texte: string}|null }}
 */
export function construirePlan(structure, idActif, { maxLignes = 150 } = {}) {
  const liste = aplatirPlan(structure);
  let position = liste.findIndex((n) => n.id === idActif);
  // Le nœud ouvert peut être une NOTE d'une autre zone (ex. « note de cadrage », zone « methodo », enfant d'un
  // chapitre) : elle n'est pas dans la liste du corps. On la situe alors par son chapitre PARENT (l'ancêtre le plus
  // proche qui figure dans le plan) — sans quoi le Co-pilote n'avait NI sommaire NI chapitre précédent (cas réel,
  // 25/10/2026 : « je n'ai ni le sommaire du livre, ni le texte du chapitre précédent »).
  let noteOuverte = null;
  if (position === -1) {
    const chemin = cheminVers(structure, idActif);
    if (chemin) {
      for (let k = chemin.length - 2; k >= 0 && position === -1; k--) {
        position = liste.findIndex((n) => n.id === chemin[k].id);
      }
      if (position !== -1) noteOuverte = chemin[chemin.length - 1];
    }
  }
  if (liste.length === 0 || position === -1) return { plan: null, précédent: null };

  const libellé = { partie: "Partie", chapitre: "Chapitre", scene: "Scène", section: "Section" };
  let lignes = liste.map((n, i) => {
    const titre = n.titre.trim() || "(sans titre)";
    const marque = i === position ? (noteOuverte ? "   ← CHAPITRE OUVERT (la note ouverte, « " + (noteOuverte.titre || "note").trim() + " », est rattachée à ce chapitre)" : "   ← CHAPITRE OUVERT") : "";
    return `${"  ".repeat(n.niveau)}- ${libellé[n.type] || "Chapitre"} : ${titre}${marque}`;
  });
  // Plan très long : on garde une fenêtre autour du chapitre ouvert.
  if (lignes.length > maxLignes) {
    const début = Math.max(0, Math.min(position - Math.floor(maxLignes / 2), lignes.length - maxLignes));
    const fenêtre = lignes.slice(début, début + maxLignes);
    lignes = [
      ...(début > 0 ? [`(… ${début} entrées précédentes non listées)`] : []),
      ...fenêtre,
      ...(début + maxLignes < lignes.length ? [`(… ${lignes.length - début - maxLignes} entrées suivantes non listées)`] : []),
    ];
  }

  let précédent = null;
  for (let i = position - 1; i >= 0; i--) {
    const n = liste[i];
    if (n.type === "partie") continue;
    if (texteBrut(n.texte).length > 0) {
      précédent = { id: n.id, titre: n.titre.trim() || "(sans titre)", texte: n.texte };
      break;
    }
  }
  return { plan: lignes.join("\n"), précédent };
}

/**
 * Texte brut du chapitre précédent à joindre, selon le choix de l'auteur·ice :
 * "fin" = les ~3 000 derniers caractères (de quoi assurer la continuité),
 * "tout" = le chapitre entier, plafonné à 12 000 caractères (le DÉBUT est alors
 * coupé et le dit). Renvoie null si rien à joindre.
 */
export function extraitPourJoindre(texteBrutChapitre, mode) {
  const t = String(texteBrutChapitre || "").trim();
  if (!t || (mode !== "fin" && mode !== "tout")) return null;
  const limite = mode === "fin" ? 3000 : 12000;
  if (t.length <= limite) return t;
  let coupe = t.slice(t.length - limite);
  const espace = coupe.indexOf(" ");
  if (espace > 0 && espace < 200) coupe = coupe.slice(espace + 1);
  return `[… début du chapitre non joint …]\n${coupe}`;
}
