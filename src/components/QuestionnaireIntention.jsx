/**
 * CURSUS — Questionnaire d'intention de projet (v2 complète)
 * ================================================================
 * 11 sections, conçues par Joseph le 30/06/2026.
 * Capture le cap profond du livre — intention, lecteur, ton, limites,
 * personnes, fils conducteurs, gestion des digressions, et surtout
 * le "pacte" entre l'auteur et l'IA (section 11) qui définit comment
 * le co-pilote doit se comporter tout au long de l'écriture.
 *
 * Deux notes calculées :
 *  - Note de complétude (ce fichier) : pondérée, recalculée à chaque sauvegarde
 *  - Note de cohérence texte/intention : calculée séparément par CopiloteIA.jsx
 */

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  texte: "#2C1810",
  texteClair: "#6B5D52",
  fond: "#F7F4EF",
  vert: "#1D9E75",
};

// Poids de chaque section pour le calcul de la note de complétude
// (incontournable / moyen / optionnel — décision actée le 30/06/2026)
const POIDS = {
  pourquoi: 3,
  quoi_pousse_aujourdhui: 1,
  idee_unique: 2,
  pourquoi_bonne_personne: 1,
  pour_qui: 2,
  qui_ne_devrait_pas_lire: 1,
  ressenti_souhaite: 1,
  comprehension_souhaitee: 1,
  action_souhaitee: 1,
  type_recit: 3,
  tons_multiples: 3,
  personnes: 1, // poids global pour la présence d'au moins une fiche personne
  sujets_refuses: 2,
  limites_juridiques: 2,
  emotions_principales: 2,
  fils_conducteurs: 1,
  digressions_naturelles: 1,
  digressions_comportement_ia: 1,
  pacte_ia: 3,
};

const POIDS_TOTAL = Object.values(POIDS).reduce((a, b) => a + b, 0);

const ÉTAT_INITIAL = {
  pourquoi: "",
  quoi_pousse_aujourdhui: "",
  idee_unique: "",
  pourquoi_bonne_personne: "",
  pour_qui: "",
  qui_ne_devrait_pas_lire: "",
  ressenti_souhaite: "",
  comprehension_souhaitee: "",
  action_souhaitee: "",
  type_recit: "",
  tons_multiples: [],
  sujets_refuses: "",
  sujets_pas_prets: "",
  sujets_autrement: "",
  sujets_autre_livre: "",
  limites_juridiques: [],
  emotions_principales: [],
  fils_conducteurs: [],
  digressions_naturelles: "",
  digressions_comportement_ia: "",
  pacte_ia: [],
};

const OPTIONS_TON = ["intime", "pédagogique", "philosophique", "scientifique", "poétique", "humoristique", "militant", "analytique", "spirituel", "journalistique", "autre"];
const OPTIONS_LIMITES_JURIDIQUES = ["Diffamation", "Vie privée", "Secret professionnel", "Secret médical", "Copyright", "Citations", "Photographies", "Courriers", "Messages privés"];
const OPTIONS_EMOTIONS = ["catharsis", "réparation", "hommage", "transmission", "acte militant", "enquête", "réflexion", "avertissement", "quête de sens", "autre"];
const OPTIONS_PACTE_IA = [
  "Corrige mes fautes, mais jamais mon style.",
  "Challenge mes idées si elles sont incohérentes.",
  "N'édulcore jamais mes émotions.",
  "Aide-moi à rester fidèle à mon intention initiale.",
  "Rappelle-moi mes objectifs lorsque je m'en éloigne.",
  "Autorise les digressions créatives.",
  "Ne coupe jamais un passage uniquement parce qu'il paraît atypique.",
  "Demande-moi avant toute suppression importante.",
  "Privilégie les questions aux affirmations.",
];

// Calcule la note de complétude (0-100) à partir des réponses et des personnes
function calculerComplétude(réponses, personnes) {
  let score = 0;
  for (const [champ, poids] of Object.entries(POIDS)) {
    if (champ === "personnes") {
      if (personnes.length > 0) score += poids;
      continue;
    }
    const valeur = réponses[champ];
    const rempli = Array.isArray(valeur) ? valeur.length > 0 : Boolean(valeur && valeur.trim?.());
    if (rempli) score += poids;
  }
  return Math.round((score / POIDS_TOTAL) * 100);
}

function ToggleMultiple({ options, sélection, onChange }) {
  const basculer = (opt) => {
    onChange(sélection.includes(opt) ? sélection.filter((o) => o !== opt) : [...sélection, opt]);
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const actif = sélection.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => basculer(opt)}
            style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 20,
              border: `1px solid ${actif ? COULEURS.bordeaux : "#e5ddd0"}`,
              background: actif ? `${COULEURS.bordeaux}10` : "#fff",
              color: actif ? COULEURS.bordeaux : COULEURS.texte,
              cursor: "pointer", fontFamily: "inherit", fontWeight: actif ? 500 : 400,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Champ({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#2C1810", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ numéro, titre, enfants }) {
  return (
    <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "0.5px solid #ece5d8" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: COULEURS.or }}>{numéro}</span>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: COULEURS.bordeaux, margin: 0 }}>{titre}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{enfants}</div>
    </div>
  );
}

const styleTextarea = {
  width: "100%", padding: "8px 10px", border: "1px solid #e5ddd0", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
  outline: "none", color: "#2C1810",
};
const styleSelect = { ...styleTextarea, background: "#fff" };
const styleInput = { ...styleTextarea };

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  const [réponses, setRéponses] = useState(ÉTAT_INITIAL);
  const [personnes, setPersonnes] = useState([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [filsConducteurInput, setFilsConducteurInput] = useState("");

  const màj = (champ, valeur) => setRéponses((r) => ({ ...r, [champ]: valeur }));

  const complétude = calculerComplétude(réponses, personnes);

  const ajouterPersonne = () => {
    setPersonnes((p) => [...p, {
      nom_reel: "", pseudonyme: "", fusion_plusieurs_personnes: false,
      autorisation_obtenue: false, risque_juridique: "", preserver_anonymat: false,
    }]);
  };
  const màjPersonne = (index, champ, valeur) => {
    setPersonnes((p) => p.map((pers, i) => i === index ? { ...pers, [champ]: valeur } : pers));
  };
  const supprimerPersonne = (index) => {
    setPersonnes((p) => p.filter((_, i) => i !== index));
  };

  const ajouterFilConducteur = () => {
    if (filsConducteurInput.trim() === "") return;
    màj("fils_conducteurs", [...réponses.fils_conducteurs, filsConducteurInput.trim()]);
    setFilsConducteurInput("");
  };
  const retirerFilConducteur = (mot) => {
    màj("fils_conducteurs", réponses.fils_conducteurs.filter((m) => m !== mot));
  };

  const peutValider = réponses.pourquoi.trim() !== "" && réponses.type_recit !== "" && réponses.tons_multiples.length > 0;

  const enregistrer = async (fermerApres) => {
    setEnregistrement(true);
    setErreur(null);

    const { error: errIntention } = await supabase.from("intention_projet").upsert({
      projet_id: projetId,
      ...réponses,
      score_completude: complétude,
      updated_at: new Date().toISOString(),
    }, { onConflict: "projet_id" });

    if (errIntention) {
      setEnregistrement(false);
      setErreur("Erreur lors de l'enregistrement : " + errIntention.message);
      return;
    }

    // Supprime les anciennes fiches personnes et réinsère les actuelles
    // (plus simple et sûr que de gérer un diff complexe ici)
    await supabase.from("intention_personnes").delete().eq("projet_id", projetId);
    if (personnes.length > 0) {
      await supabase.from("intention_personnes").insert(
        personnes.map((p) => ({ ...p, projet_id: projetId }))
      );
    }

    setEnregistrement(false);
    if (fermerApres) {
      onTerminé?.({ réponses, personnes, complétude });
    } else {
      onFermer?.();
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(44, 24, 16, 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: "2rem",
        maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* En-tête avec note de complétude */}
        <div style={{ marginBottom: 24, position: "sticky", top: -32, background: "#fff", paddingTop: 4, zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: COULEURS.or, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {projetTitre}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: COULEURS.bordeaux, margin: 0 }}>
              Le cap de ce livre
            </h2>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: complétude >= 70 ? COULEURS.vert : COULEURS.or }}>
                {complétude}%
              </div>
              <div style={{ fontSize: 10, color: COULEURS.texteClair }}>complétude</div>
            </div>
          </div>
          <div style={{ height: 4, background: "#ece5d8", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${complétude}%`, height: "100%", background: complétude >= 70 ? COULEURS.vert : COULEURS.or, borderRadius: 4, transition: "width 0.4s" }} />
          </div>
          <p style={{ fontSize: 12, color: COULEURS.texteClair, lineHeight: 1.6, margin: "10px 0 0" }}>
            Ce questionnaire guide le co-pilote IA tout au long de l'écriture. Modifiable à tout moment — répondez à votre rythme, les champs essentiels sont marqués *.
          </p>
        </div>

        <Section numéro="1" titre="L'intention profonde" enfants={<>
          <Champ label="Pourquoi écrivez-vous ce livre ? *">
            <textarea rows={2} value={réponses.pourquoi} onChange={(e) => màj("pourquoi", e.target.value)} style={styleTextarea} placeholder="Ex : pour transformer une épreuve en témoignage utile à d'autres" />
          </Champ>
          <Champ label="Qu'est-ce qui vous pousse à l'écrire aujourd'hui ?">
            <textarea rows={2} value={réponses.quoi_pousse_aujourdhui} onChange={(e) => màj("quoi_pousse_aujourdhui", e.target.value)} style={styleTextarea} />
          </Champ>
          <Champ label="Si vous ne pouviez transmettre qu'une seule idée, laquelle serait-elle ?">
            <input type="text" value={réponses.idee_unique} onChange={(e) => màj("idee_unique", e.target.value)} style={styleInput} />
          </Champ>
          <Champ label="Pourquoi êtes-vous la bonne personne pour raconter cette histoire ?">
            <textarea rows={2} value={réponses.pourquoi_bonne_personne} onChange={(e) => màj("pourquoi_bonne_personne", e.target.value)} style={styleTextarea} />
          </Champ>
        </>} />

        <Section numéro="2" titre="Le lecteur" enfants={<>
          <Champ label="À qui s'adresse ce livre ?">
            <input type="text" value={réponses.pour_qui} onChange={(e) => màj("pour_qui", e.target.value)} style={styleInput} />
          </Champ>
          <Champ label="Qui ne devrait probablement pas le lire ?">
            <input type="text" value={réponses.qui_ne_devrait_pas_lire} onChange={(e) => màj("qui_ne_devrait_pas_lire", e.target.value)} style={styleInput} />
          </Champ>
          <Champ label="Que souhaitez-vous que le lecteur ressente ?">
            <input type="text" value={réponses.ressenti_souhaite} onChange={(e) => màj("ressenti_souhaite", e.target.value)} style={styleInput} />
          </Champ>
          <Champ label="Que souhaitez-vous qu'il comprenne ?">
            <input type="text" value={réponses.comprehension_souhaitee} onChange={(e) => màj("comprehension_souhaitee", e.target.value)} style={styleInput} />
          </Champ>
          <Champ label="Que souhaitez-vous qu'il fasse après la lecture ?">
            <input type="text" value={réponses.action_souhaitee} onChange={(e) => màj("action_souhaitee", e.target.value)} style={styleInput} />
          </Champ>
        </>} />

        <Section numéro="3" titre="Le récit" enfants={
          <Champ label="Type de récit *">
            <select value={réponses.type_recit} onChange={(e) => màj("type_recit", e.target.value)} style={styleSelect}>
              <option value="">Choisir…</option>
              <option value="autobiographie">Autobiographie</option>
              <option value="temoignage">Témoignage</option>
              <option value="essai">Essai</option>
              <option value="recit-initiatique">Récit initiatique</option>
              <option value="developpement-personnel">Livre de développement personnel</option>
              <option value="manifeste">Manifeste</option>
              <option value="roman-faits-reels">Roman inspiré de faits réels</option>
              <option value="melange">Mélange de plusieurs genres</option>
            </select>
          </Champ>
        } />

        <Section numéro="4" titre="Le ton" enfants={
          <Champ label="Le livre sera principalement (plusieurs choix possibles) *">
            <ToggleMultiple options={OPTIONS_TON} sélection={réponses.tons_multiples} onChange={(v) => màj("tons_multiples", v)} />
          </Champ>
        } />

        <Section numéro="5" titre="Les personnes" enfants={<>
          {personnes.map((pers, i) => (
            <div key={i} style={{ border: "1px solid #ece5d8", borderRadius: 10, padding: 12, position: "relative" }}>
              <button onClick={() => supprimerPersonne(i)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 13 }}>✕</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <input type="text" placeholder="Nom réel" value={pers.nom_reel} onChange={(e) => màjPersonne(i, "nom_reel", e.target.value)} style={styleInput} />
                <input type="text" placeholder="Pseudonyme" value={pers.pseudonyme} onChange={(e) => màjPersonne(i, "pseudonyme", e.target.value)} style={styleInput} />
              </div>
              <input type="text" placeholder="Risque juridique éventuel" value={pers.risque_juridique} onChange={(e) => màjPersonne(i, "risque_juridique", e.target.value)} style={{ ...styleInput, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: COULEURS.texteClair }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={pers.fusion_plusieurs_personnes} onChange={(e) => màjPersonne(i, "fusion_plusieurs_personnes", e.target.checked)} /> Fusion de personnes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={pers.autorisation_obtenue} onChange={(e) => màjPersonne(i, "autorisation_obtenue", e.target.checked)} /> Autorisation obtenue
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={pers.preserver_anonymat} onChange={(e) => màjPersonne(i, "preserver_anonymat", e.target.checked)} /> Préserver l'anonymat
                </label>
              </div>
            </div>
          ))}
          <button onClick={ajouterPersonne} style={{ fontSize: 12, color: COULEURS.bordeaux, background: `${COULEURS.bordeaux}08`, border: `1px solid ${COULEURS.bordeaux}30`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            + Ajouter une personne importante
          </button>
        </>} />

        <Section numéro="6" titre="Les limites personnelles" enfants={<>
          <Champ label="Sujets que vous refusez d'aborder">
            <textarea rows={2} value={réponses.sujets_refuses} onChange={(e) => màj("sujets_refuses", e.target.value)} style={styleTextarea} />
          </Champ>
          <Champ label="Sujets que vous n'êtes pas encore prêt à raconter">
            <textarea rows={2} value={réponses.sujets_pas_prets} onChange={(e) => màj("sujets_pas_prets", e.target.value)} style={styleTextarea} />
          </Champ>
          <Champ label="Sujets que vous souhaitez raconter mais autrement">
            <textarea rows={2} value={réponses.sujets_autrement} onChange={(e) => màj("sujets_autrement", e.target.value)} style={styleTextarea} />
          </Champ>
          <Champ label="Sujets réservés pour un autre livre">
            <textarea rows={2} value={réponses.sujets_autre_livre} onChange={(e) => màj("sujets_autre_livre", e.target.value)} style={styleTextarea} />
          </Champ>
        </>} />

        <Section numéro="7" titre="Les limites juridiques" enfants={
          <Champ label="Points de vigilance à garder en tête">
            <ToggleMultiple options={OPTIONS_LIMITES_JURIDIQUES} sélection={réponses.limites_juridiques} onChange={(v) => màj("limites_juridiques", v)} />
          </Champ>
        } />

        <Section numéro="8" titre="Les émotions" enfants={
          <Champ label="Ce livre est-il principalement…">
            <ToggleMultiple options={OPTIONS_EMOTIONS} sélection={réponses.emotions_principales} onChange={(v) => màj("emotions_principales", v)} />
          </Champ>
        } />

        <Section numéro="9" titre="Les fils conducteurs" enfants={
          <Champ label="Quels thèmes doivent apparaître tout au long du livre ?">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="text" value={filsConducteurInput}
                onChange={(e) => setFilsConducteurInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterFilConducteur(); } }}
                placeholder="Ex : résilience" style={{ ...styleInput, flex: 1 }}
              />
              <button onClick={ajouterFilConducteur} style={{ fontSize: 12, color: "#fff", background: COULEURS.bordeaux, border: "none", borderRadius: 8, padding: "0 16px", cursor: "pointer", fontFamily: "inherit" }}>
                Ajouter
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {réponses.fils_conducteurs.map((mot) => (
                <span key={mot} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: `${COULEURS.or}15`, color: "#7A5A10", display: "flex", alignItems: "center", gap: 6 }}>
                  {mot} <span onClick={() => retirerFilConducteur(mot)} style={{ cursor: "pointer", fontWeight: 600 }}>✕</span>
                </span>
              ))}
            </div>
          </Champ>
        } />

        <Section numéro="10" titre="Les digressions" enfants={<>
          <Champ label="Les détours font-ils partie de votre manière naturelle de raconter ?">
            <select value={réponses.digressions_naturelles} onChange={(e) => màj("digressions_naturelles", e.target.value)} style={styleSelect}>
              <option value="">Choisir…</option>
              <option value="oui-essentiel">Oui, ils sont essentiels</option>
              <option value="oui-retour">Oui, mais ils doivent revenir vers le sujet principal</option>
              <option value="non-lineaire">Non, je préfère un récit linéaire</option>
            </select>
          </Champ>
          <Champ label="Lorsque vous semblez vous éloigner du sujet, que souhaitez-vous que l'IA fasse ?">
            <select value={réponses.digressions_comportement_ia} onChange={(e) => màj("digressions_comportement_ia", e.target.value)} style={styleSelect}>
              <option value="">Choisir…</option>
              <option value="ne-rien-dire">Ne rien dire</option>
              <option value="signaler">Simplement me signaler qu'il s'agit d'un détour</option>
              <option value="verifier">Vérifier avec moi que ce détour sert bien le propos</option>
              <option value="proposer-emplacement">Proposer un meilleur emplacement dans le livre</option>
              <option value="proposer-fiche">Proposer de créer une nouvelle fiche reliée</option>
            </select>
          </Champ>
        </>} />

        <Section numéro="11" titre="Le pacte entre l'auteur et l'IA" enfants={
          <Champ label="Ce que vous attendez du co-pilote — plusieurs choix possibles *">
            <ToggleMultiple options={OPTIONS_PACTE_IA} sélection={réponses.pacte_ia} onChange={(v) => màj("pacte_ia", v)} />
          </Champ>
        } />

        {erreur && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 12, color: "#A32D2D" }}>
            {erreur}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button onClick={() => enregistrer(false)} disabled={enregistrement} style={{ fontSize: 12, color: COULEURS.texteClair, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Enregistrer et continuer plus tard
          </button>
          <button
            onClick={() => enregistrer(true)}
            disabled={!peutValider || enregistrement}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: peutValider ? COULEURS.bordeaux : "#ccc",
              color: "#fff", fontSize: 13, fontWeight: 500,
              cursor: peutValider && !enregistrement ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {enregistrement ? "Enregistrement…" : "Valider et commencer à écrire"}
          </button>
        </div>
      </div>
    </div>
  );
}
