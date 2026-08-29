/**
 * CURSUS — Profil auteur (référence 60816-01, suite, 28/08/2026)
 * ======================================================================
 * Rempli une fois au niveau du compte (table profils_auteur, pas liée à un
 * audit précis), réutilisé partout — CursAudit aujourd'hui, CursEdit à
 * suivre. Entièrement optionnel, ne bloque jamais rien.
 *
 * Trois façons de le remplir, au choix de l'auteur·ice (demande explicite
 * du 28/08/2026, "on lui laisse l'opportunité") :
 *  - importer un CV et/ou un export LinkedIn (.docx/.pdf/.txt), ou coller
 *    du texte, puis "Fusionner les sources" (extraire-profil-cursus, une
 *    IA lit le texte accumulé — aucun accès API LinkedIn, aucun scraping,
 *    l'auteur·ice fournit lui-même le texte) ;
 *  - remplir les champs à la main ;
 *  - ne rien mettre.
 *
 * Plusieurs sources (CV + LinkedIn + ajouts manuels) s'AJOUTENT les unes
 * aux autres dans le même champ texte plutôt que de s'écraser (bug réel du
 * 28/08/2026, corrigé le même jour) — "Fusionner les sources" les combine
 * ensuite en un seul profil dédupliqué.
 *
 * Une fois enregistré, le profil s'affiche en résumé (lecture seule) — un
 * bouton "Modifier" rouvre le formulaire d'édition.
 *
 * POURQUOI CES CHAMPS (pas de la décoration) : la profession de
 * l'auteur·ice a une vraie valeur pour l'audit — un livre sur un métier
 * écrit par quelqu'un qui exerce réellement ce métier n'a pas le même
 * rapport à la crédibilité qu'un livre écrit par un tiers. L'identité de
 * genre compte notamment pour une autobiographie ou un livre professionnel,
 * où l'identité de l'auteur·ice fait partie du contrat de lecture.
 */

import { useState, useEffect } from "react";
import { profilAuteurAPI } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { analyserStructureDocx } from "../lib/segmenterCursAudit.js";
import { extraireTextePdf } from "../lib/extrairePdf.js";

const EXTRACTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/extraire-profil-cursus";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 6 };
const champStyle = { width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

async function extraireProfil(texte) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");
  const réponse = await fetch(EXTRACTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ texte }),
  });
  const données = await réponse.json();
  if (!réponse.ok) throw new Error(données?.message || données?.error || `HTTP ${réponse.status}`);
  return données.profil;
}

function ligneRésumé(étiquette, valeur) {
  if (!valeur) return null;
  return (
    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ color: "var(--texte-tertiaire)" }}>{étiquette} — </span>
      <span style={{ color: "var(--texte-primaire)" }}>{valeur}</span>
    </div>
  );
}

export default function ProfilAuteur() {
  const [profession, setProfession] = useState("");
  const [identiteGenre, setIdentiteGenre] = useState("");
  const [trancheAge, setTrancheAge] = useState("");
  const [niveauEtudes, setNiveauEtudes] = useState("");
  const [matieresEtudiees, setMatieresEtudiees] = useState("");
  const [texteSourceBrut, setTexteSourceBrut] = useState("");
  const [résuméParcours, setRésuméParcours] = useState("");
  const [chargé, setChargé] = useState(false);
  const [extractionEnCours, setExtractionEnCours] = useState(false);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [déplié, setDéplié] = useState(false);
  // Bascule résumé (lecture seule) / formulaire (édition) — réf.
  // 60816-01, suite, 28/08/2026 : une fois enregistré, montrer un résumé
  // plutôt que de laisser tous les champs éditables en permanence.
  const [enModification, setEnModification] = useState(false);
  const [déjàEnregistré, setDéjàEnregistré] = useState(false);

  useEffect(() => {
    profilAuteurAPI.récupérer().then(({ data }) => {
      if (data) {
        setProfession(data.profession || "");
        setIdentiteGenre(data.identite_genre || "");
        setTrancheAge(data.tranche_age || "");
        setNiveauEtudes(data.niveau_etudes || "");
        setMatieresEtudiees(data.matieres_etudiees || "");
        setTexteSourceBrut(data.texte_source_brut || "");
        setRésuméParcours(data.resume_parcours || "");
        setDéplié(true);
        setDéjàEnregistré(true);
      }
      setChargé(true);
    });
  }, []);

  const extraire = async () => {
    if (!texteSourceBrut.trim()) { setErreur("Importe ou colle d'abord un CV/profil LinkedIn dans le champ ci-dessous."); return; }
    setExtractionEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const profil = await extraireProfil(texteSourceBrut);
      setProfession(profil.profession || "");
      setNiveauEtudes(profil.niveau_etudes || "");
      setMatieresEtudiees(profil.matieres_etudiees || "");
      setRésuméParcours(profil.resume_parcours || "");
      setMessage("Champs préremplis à partir de toutes les sources ajoutées — vérifie et corrige avant d'enregistrer.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setExtractionEnCours(false);
    }
  };

  // Import de fichier — réf. 60816-01, suite, 28/08/2026, signalé par
  // l'auteur du projet : le copier-coller manuel n'est pas un "import"
  // suffisant. .docx, .pdf et .txt. Le .pdf réutilise PDF.js chargé
  // dynamiquement depuis un CDN (extrairePdf.js), même principe que
  // chargerJSZip() pour le .docx — aucune dépendance npm ajoutée. Le
  // .docx réutilise analyserStructureDocx() (segmenterCursAudit.js), déjà
  // éprouvée pour l'import du manuscrit.
  //
  // CORRECTIF (même jour, suite) — un second import (ex. profil LinkedIn
  // après un CV) écrasait le premier au lieu de s'y ajouter. Chaque
  // import s'AJOUTE désormais à la suite du texte déjà présent, avec un
  // séparateur nommant la source, pour pouvoir accumuler CV + LinkedIn +
  // ajouts manuels avant de "Fusionner les sources" en un seul profil.
  const ajouterAuTexteSource = (texte, nomSource) => {
    const bloc = `--- ${nomSource} ---\n${texte}`;
    setTexteSourceBrut((précédent) => précédent.trim() ? `${précédent}\n\n${bloc}` : bloc);
  };

  const importerFichier = async (fichier) => {
    if (!fichier) return;
    setErreur(null);
    setMessage(null);
    try {
      if (fichier.name.endsWith(".docx")) {
        const { infos } = await analyserStructureDocx(fichier);
        const texte = infos.map((i) => i.texte).filter(Boolean).join("\n");
        if (!texte) { setErreur("Aucun texte exploitable trouvé dans ce fichier."); return; }
        ajouterAuTexteSource(texte, fichier.name);
      } else if (fichier.name.endsWith(".pdf")) {
        const texte = await extraireTextePdf(fichier);
        if (!texte) { setErreur("Aucun texte exploitable trouvé dans ce PDF (peut-être un PDF scanné/image, sans texte réel)."); return; }
        ajouterAuTexteSource(texte, fichier.name);
      } else if (fichier.name.endsWith(".txt")) {
        ajouterAuTexteSource(await fichier.text(), fichier.name);
      } else {
        setErreur("Format non pris en charge — utilise un .docx, un .pdf ou un .txt.");
        return;
      }
      setMessage("Fichier ajouté à la suite du texte déjà présent — importe d'autres sources si besoin, puis clique \"Fusionner les sources\".");
    } catch (e) {
      setErreur("Impossible de lire ce fichier : " + e.message);
    }
  };

  const enregistrer = async () => {
    setEnregistrementEnCours(true);
    setErreur(null);
    setMessage(null);
    const { error } = await profilAuteurAPI.enregistrer({
      profession, identiteGenre, trancheAge, niveauEtudes, matieresEtudiees,
      texteSourceBrut, resumeParcours: résuméParcours,
    });
    setEnregistrementEnCours(false);
    if (error) { setErreur(error.message); return; }
    setMessage("Profil enregistré — réutilisé automatiquement partout dans Cursus.");
    setDéjàEnregistré(true);
    setEnModification(false);
  };

  if (!chargé) return null;

  const modeLectureSeule = déjàEnregistré && !enModification;

  return (
    <div style={{ background: "#F7F4EF", border: "0.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "grid", gap: déplié ? 14 : 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setDéplié((d) => !d)}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--texte-primaire)" }}>
            {déplié ? "▼" : "▶"} Mon profil (facultatif, rempli une fois pour tout Cursus)
          </div>
          {!déplié && (
            <div style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", marginTop: 2 }}>
              CV, profil LinkedIn ou champs à la main — ou rien du tout.
            </div>
          )}
        </div>
      </div>

      {déplié && modeLectureSeule && (
        <>
          <div>
            {ligneRésumé("Profession", profession)}
            {ligneRésumé("Identité de genre", identiteGenre)}
            {ligneRésumé("Tranche d'âge", trancheAge)}
            {ligneRésumé("Niveau d'études", niveauEtudes)}
            {ligneRésumé("Matières étudiées", matieresEtudiees)}
            {résuméParcours && (
              <div style={{ fontSize: 12.5, color: "var(--texte-primaire)", marginTop: 8, lineHeight: 1.6 }}>{résuméParcours}</div>
            )}
          </div>
          <button type="button" onClick={() => setEnModification(true)} style={{
            background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
            padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", justifySelf: "start",
          }}>
            Modifier mon profil
          </button>
        </>
      )}

      {déplié && !modeLectureSeule && (
        <>
          <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: 0 }}>
            Utile surtout pour une autobiographie ou un livre professionnel : savoir que l'auteur·ice d'un
            livre sur son métier exerce réellement ce métier, par exemple, compte pour l'audit.
          </p>

          <div>
            <label style={labelStyle}>Importer un ou plusieurs fichiers (.docx, .pdf ou .txt) — CV, export LinkedIn…</label>
            <label style={{
              display: "inline-block", background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginBottom: 12,
            }}>
              Choisir un fichier
              <input type="file" accept=".docx,.pdf,.txt" style={{ display: "none" }} onChange={(e) => { importerFichier(e.target.files[0]); e.target.value = ""; }} />
            </label>
            <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", marginTop: -8, marginBottom: 8 }}>
              Chaque fichier importé s'ajoute à la suite des précédents — importe ton CV puis ton export LinkedIn, par exemple, avant de fusionner.
            </div>
          </div>

          <div>
            <label style={labelStyle}>...ou coller du texte à la suite</label>
            <textarea
              style={{ ...champStyle, minHeight: 90, resize: "vertical" }}
              value={texteSourceBrut}
              onChange={(e) => setTexteSourceBrut(e.target.value)}
              placeholder="Colle ici le texte de ton CV ou de ton profil LinkedIn…"
            />
            <button type="button" onClick={extraire} disabled={extractionEnCours} style={{
              marginTop: 8, background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: extractionEnCours ? "default" : "pointer", fontFamily: "inherit",
            }}>
              {extractionEnCours ? "Fusion en cours…" : "Fusionner les sources"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Profession</label>
              <input style={champStyle} value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Ex. : psychologue" />
            </div>
            <div>
              <label style={labelStyle}>Identité de genre</label>
              <select style={champStyle} value={identiteGenre} onChange={(e) => setIdentiteGenre(e.target.value)}>
                <option value="">— Préfère ne pas préciser —</option>
                <option value="Femme">Femme</option>
                <option value="Homme">Homme</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tranche d'âge</label>
              <select style={champStyle} value={trancheAge} onChange={(e) => setTrancheAge(e.target.value)}>
                <option value="">— Préfère ne pas préciser —</option>
                <option value="Moins de 25 ans">Moins de 25 ans</option>
                <option value="25-34 ans">25-34 ans</option>
                <option value="35-44 ans">35-44 ans</option>
                <option value="45-54 ans">45-54 ans</option>
                <option value="55-64 ans">55-64 ans</option>
                <option value="65 ans et plus">65 ans et plus</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Niveau d'études</label>
              <input style={champStyle} value={niveauEtudes} onChange={(e) => setNiveauEtudes(e.target.value)} placeholder="Ex. : Master" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Matières / domaines étudiés</label>
              <input style={champStyle} value={matieresEtudiees} onChange={(e) => setMatieresEtudiees(e.target.value)} placeholder="Ex. : psychologie clinique, sciences de l'éducation" />
            </div>
            {résuméParcours && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Résumé du parcours</label>
                <textarea style={{ ...champStyle, minHeight: 60, resize: "vertical" }} value={résuméParcours} onChange={(e) => setRésuméParcours(e.target.value)} />
              </div>
            )}
          </div>

          {erreur && <div style={{ fontSize: 12, color: "#A32D2D" }}>{erreur}</div>}
          {message && <div style={{ fontSize: 12, color: "#1D9E75" }}>{message}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={enregistrer} disabled={enregistrementEnCours} style={{
              background: "#1D9E75", color: "#fff", border: "none", borderRadius: 6,
              padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: enregistrementEnCours ? "default" : "pointer",
              fontFamily: "inherit",
            }}>
              {enregistrementEnCours ? "Enregistrement…" : déjàEnregistré ? "Enregistrer les modifications" : "Enregistrer mon profil"}
            </button>
            {déjàEnregistré && (
              <button type="button" onClick={() => { setEnModification(false); setErreur(null); setMessage(null); }} style={{
                background: "none", color: "var(--texte-tertiaire)", border: "none",
                fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
              }}>
                Annuler
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
