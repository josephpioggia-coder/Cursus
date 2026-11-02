/**
 * CURSUS — Hook : une fenêtre de l'éditeur (Correction rapide, Vérifier les faits…) retrouve le résultat d'une demande lancée AVANT sa fermeture
 * (03/11/2026). Voir copiloteConserve.js. `rappels` : { surEnCours(), surResultat(valeur), surFin(issue) } — lus à chaque événement (toujours à jour).
 */
import { useEffect, useRef } from "react";
import { lireResultat } from "./copiloteConserve.js";

export function useReprise(noeudId, clé, rappels) {
  const ref = useRef(rappels);
  ref.current = rappels;
  useEffect(() => {
    if (!noeudId) return undefined;
    const f = (ev) => {
      const d = ev.detail || {};
      if (d.nœudId !== noeudId || d.clé !== clé) return;
      if (d.enCours) ref.current.surEnCours?.();
      else if (d.issue === "ok") { const v = lireResultat(noeudId, clé); if (v) ref.current.surResultat?.(v); else ref.current.surFin?.("echec"); }
      else ref.current.surFin?.(d.issue);
    };
    window.addEventListener("cursus-copilote-etat", f);
    return () => window.removeEventListener("cursus-copilote-etat", f);
  }, [noeudId, clé]);
}
