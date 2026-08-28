/**
 * CURSUS — Profil auteur (référence 60816-01, suite, 28/08/2026)
 * ======================================================================
 * Rempli une fois au niveau du compte (table profils_auteur, pas liée à un
 * audit précis), réutilisé partout — CursAudit aujourd'hui, CursEdit à
 * suivre. Entièrement optionnel, ne bloque jamais rien.
 *
 * Trois façons de le remplir, au choix de l'auteur·ice (demande explicite
 * du 28/08/2026, "on lui laisse l'opportunité") :
 *  - coller un CV ou un profil LinkedIn en texte brut puis "Extraire
 *    automatiquement" (extraire-profil-cursus, une IA lit le texte collé —
 *    aucun accès API LinkedIn, aucun scraping, l'auteur·ice colle lui-même) ;
 *  - remplir les champs à la main ;
 *  - ne rien mettre.
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
      }
      setChargé(true);
    });
  }, []);

  const extraire = async () => {
    if (!texteSourceBrut.trim()) { setErreur("Colle d'abord un CV ou un profil LinkedIn dans le champ ci-dessous."); return; }
    setExtractionEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const profil = await extraireProfil(texteSourceBrut);
      setProfession(profil.profession || "");
      setNiveauEtudes(profil.niveau_etudes || "");
      setMatieresEtudiees(profil.matieres_etudiees || "");
      setRésuméParcours(profil.resume_parcours || "");
      setMessage("Champs préremplis à partir du texte collé — vérifie et corrige avant d'enregistrer.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setExtractionEnCours(false);
    }
  };

  // Import de fichier — réf. 60816-01, suite, 28/08/2026, signalé par
  // l'auteur du projet : le copier-coller manuel n'est pas un "import"
  // suffisant. .docx et .txt seulement — PAS de .pdf : aucune bibliothèque
  // d'extraction PDF dans ce projet aujourd'hui, l'ajouter proprement est
  // un vrai chantier séparé, pas un ajustement rapide. Réutilise
  // analyserStructureDocx() (segmenterCursAudit.js), déjà éprouvée pour
  // l'import du manuscrit — ici on ne garde que le texte brut de chaque
  // paragraphe, la structure de chapitres ne sert à rien pour un CV.
  const importerFichier = async (fichier) => {
    if (!fichier) return;
    setErreur(null);
    setMessage(null);
    try {
      if (fichier.name.endsWith(".docx")) {
        const { infos } = await analyserStructureDocx(fichier);
        const texte = infos.map((i) => i.texte).filter(Boolean).join("\n");
        if (!texte) { setErreur("Aucun texte exploitable trouvé dans ce fichier."); return; }
        setTexteSourceBrut(texte);
      } else if (fichier.name.endsWith(".txt")) {
        setTexteSourceBrut(await fichier.text());
      } else {
        setErreur("Format non pris en charge — utilise un .docx ou un .txt. Le PDF n'est pas encore supporté : convertis-le en .docx, ou colle le texte directement dans le champ ci-dessous.");
        return;
      }
      setMessage("Fichier importé — clique \"Extraire automatiquement\" pour préremplir les champs.");
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
  };

  if (!chargé) return null;

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

      {déplié && (
        <>
          <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: 0 }}>
            Utile surtout pour une autobiographie ou un livre professionnel : savoir que l'auteur·ice d'un
            livre sur son métier exerce réellement ce métier, par exemple, compte pour l'audit.
          </p>

          <div>
            <label style={labelStyle}>Importer un fichier (.docx ou .txt — pas de .pdf pour l'instant)</label>
            <label style={{
              display: "inline-block", background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginBottom: 12,
            }}>
              Choisir un fichier (CV, export LinkedIn…)
              <input type="file" accept=".docx,.txt" style={{ display: "none" }} onChange={(e) => importerFichier(e.target.files[0])} />
            </label>
          </div>

          <div>
            <label style={labelStyle}>...ou coller un CV / un profil LinkedIn (texte)</label>
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
              {extractionEnCours ? "Extraction…" : "Extraire automatiquement"}
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

          <button type="button" onClick={enregistrer} disabled={enregistrementEnCours} style={{
            background: "#1D9E75", color: "#fff", border: "none", borderRadius: 6,
            padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: enregistrementEnCours ? "default" : "pointer",
            fontFamily: "inherit", justifySelf: "start",
          }}>
            {enregistrementEnCours ? "Enregistrement…" : "Enregistrer mon profil"}
          </button>
        </>
      )}
    </div>
  );
}
