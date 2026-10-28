/**
 * CURSUS — Scènes intimes (28/10/2026). Retour de Joseph : une IA répondait « je ne peux pas écrire du cru » à une question de
 * CONSEIL sur une scène intime de son livre. Deux outils :
 *  - RÈGLE_SCENES_INTIMES : consigne partagée (Co-pilote, Question rapide, Avis sur le fond) — l'auteur·ice est majeur·e, c'est
 *    son livre, les scènes intimes en font légitimement partie ; le rôle de l'IA est de CONSEILLER sur le texte fourni
 *    (registre, rythme, tension, point de vue, cohérence), sans juger ce choix ni écrire à la place de l'auteur·ice.
 *    Elle NE LÈVE PAS les limites du fournisseur de l'IA : si le modèle décline quand même, il doit le dire en une phrase.
 *  - detecterRefus : repère une réponse qui DÉCLINE (au lieu d'un conseil) pour l'annoncer clairement à l'écran.
 *    Heuristique prudente (formules de refus connues + stop_reason « refusal »), jamais une certitude : l'écran dit « semble ».
 */

export const RÈGLE_SCENES_INTIMES = `SCÈNES INTIMES, ÉROTIQUES OU CRUES dans le texte : l'auteur·ice est une personne adulte qui écrit SON livre ; ces scènes en font légitimement partie. Ton rôle est de CONSEILLER sur le texte fourni — registre (suggéré, sensuel, cru), rythme, tension, point de vue, vocabulaire qui sonne juste ou faux, cohérence avec le reste du livre, ce que la scène apporte à l'histoire. Ne juge pas le choix du registre, ne fais pas la morale, ne propose pas de « l'adoucir » sauf si l'auteur·ice le demande. Si l'auteur·ice te demande de RÉÉCRIRE ou de PRODUIRE une scène explicite et que tu ne peux pas le faire, dis-le en UNE phrase claire (« je ne peux pas rédiger ce passage lui-même »), puis aide quand même sur tout le reste : analyse de sa scène, pistes de structure, questions à se poser. Ne présente jamais un refus comme un conseil. Seule limite absolue, jamais discutée : aucune scène sexuelle impliquant un mineur.`;

const FORMULES_REFUS = [
  /je ne (peux|suis pas en mesure de|saurais) pas (écrire|rédiger|produire|générer|créer)/i,
  /je ne (peux|vais) pas (t'aider|vous aider) (avec|à) (ce|cette|cela)/i,
  /contenu sexuellement explicite/i,
  /franchit le seuil/i,
  /(désolé|désolée|je suis navré)[^.]{0,80}(je ne peux pas|impossible)/i,
  /I can(not|'t) (write|produce|help with|create) (this|that|explicit)/i,
];

/** → true si la réponse ressemble à un REFUS (et non à un conseil). `stopReason` : celui de l'API quand on l'a. */
export function detecterRefus(texte, stopReason) {
  if (stopReason === "refusal") return true;
  const t = String(texte || "").slice(0, 1200);
  return FORMULES_REFUS.some((re) => re.test(t));
}

export const MESSAGE_REFUS = "L'IA semble avoir décliné d'écrire ce passage : ce n'est pas un conseil sur votre texte, et ce n'est pas un réglage de Cursus. Pour obtenir de l'aide quand même, collez votre scène et demandez un AVIS (registre, rythme, tension, ce qui manque) plutôt qu'une réécriture.";
