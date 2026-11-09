/**
 * CURSUS — Fiche d'auteur : remplir en ligne ou télécharger (09/11/2026, retour de Joseph : « l'auteur n'a pas accès à la fiche »).
 * Affichée dans l'encadré « Vous avez publié un livre ? » (Vitrine.jsx). La fiche en ligne ne part sur AUCUN serveur : elle prépare un e-mail
 * adressé à Cursus (l'auteur l'envoie lui-même, avec sa couverture en pièce jointe). Moteur : src/lib/ficheAuteur.js.
 * Couleurs explicites (mode sombre forcé des navigateurs mobiles).
 */
import { useState } from "react";
import { CHAMPS, MODES_CREATION, AVERTISSEMENT_COUVERTURE, PHRASE_CONSENTEMENT, problemesFiche, texteFiche, lienMailto, telechargerFicheVierge } from "../lib/ficheAuteur.js";

const MAUVE = "#7F77DD";
const btn = (plein = true) => ({
  background: plein ? MAUVE : "#fff", color: plein ? "#fff" : MAUVE, border: plein ? "none" : "1px solid " + MAUVE,
  borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-block",
});
const champStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 16, fontFamily: "inherit", background: "#fff", color: "#1a1a1a" };

export default function FicheAuteur({ contact }) {
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState({ modeCreation: "aucun" });
  const [message, setMessage] = useState("");
  const [copie, setCopie] = useState(false);
  const [telechargement, setTelechargement] = useState("");
  const maj = (id, val) => { setV((x) => ({ ...x, [id]: val })); setMessage(""); };
  const problemes = problemesFiche(v);

  const telecharger = async () => {
    setTelechargement("Préparation du document…");
    try { await telechargerFicheVierge(contact); setTelechargement("Le document est téléchargé : remplissez-le puis renvoyez-le à " + contact + "."); }
    catch { setTelechargement("Le téléchargement a échoué. Vous pouvez remplir la fiche en ligne ou nous écrire."); }
  };
  const preparerEmail = () => {
    if (problemes.length) { setMessage(problemes.join(" ")); return; }
    setMessage("Votre messagerie s'ouvre avec la fiche. Ajoutez la couverture en pièce jointe, puis envoyez. Si rien ne s'ouvre ou si le texte est coupé, utilisez « Copier la fiche » et collez-la dans un e-mail à " + contact + ".");
    window.location.href = lienMailto(contact, v);
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(texteFiche(v)); setCopie(true); setTimeout(() => setCopie(false), 2500); }
    catch { setMessage("La copie automatique n'est pas possible ici : sélectionnez le texte à la main."); }
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setOuvert(!ouvert)} style={btn(true)}>{ouvert ? "Masquer le formulaire" : "✍️ Remplir la fiche en ligne"}</button>
        <button onClick={telecharger} style={btn(false)}>⬇️ Télécharger la fiche (Word)</button>
      </div>
      {telechargement && <p style={{ fontSize: 13, color: "#444", margin: "10px 0 0", lineHeight: 1.5 }}>{telechargement}</p>}

      {ouvert && (
        <div style={{ marginTop: 16, background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: "18px 16px" }}>
          <p style={{ fontSize: 13.5, color: "#444", margin: "0 0 14px", lineHeight: 1.6 }}>
            Remplissez ce que vous pouvez : seuls le titre, le nom, l'accroche et votre accord sont obligatoires. <strong>Rien n'est envoyé ni publié</strong> à ce stade :
            le bouton prépare un e-mail que vous envoyez vous-même, et nous vous montrons la fiche avant toute publication.
          </p>
          {CHAMPS.map((c) => (
            <label key={c.id} style={{ display: "block", marginBottom: 12 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{c.label}{c.obligatoire ? " *" : ""}</span>
              {c.aide && <span style={{ display: "block", fontSize: 12, color: "#777", marginBottom: 4 }}>{c.aide}</span>}
              {c.long
                ? <textarea rows={c.max >= 500 ? 5 : 3} value={v[c.id] || ""} onChange={(e) => maj(c.id, e.target.value)} style={{ ...champStyle, resize: "vertical" }} />
                : <input type={c.type === "url" ? "url" : "text"} value={v[c.id] || ""} onChange={(e) => maj(c.id, e.target.value)} style={champStyle} />}
              {c.max && <span style={{ display: "block", fontSize: 11.5, color: (v[c.id] || "").length > c.max ? "#c0392b" : "#888", marginTop: 2 }}>{(v[c.id] || "").length} / {c.max} caractères conseillés</span>}
            </label>
          ))}
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
            <legend style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Comment le livre a été écrit (c'est vous qui déclarez ; Cursus ne le vérifie pas)</legend>
            {MODES_CREATION.map((m) => (
              <label key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#333", marginBottom: 6, lineHeight: 1.4 }}>
                <input type="radio" name="modeCreation" checked={v.modeCreation === m.id} onChange={() => maj("modeCreation", m.id)} style={{ marginTop: 3 }} />
                <span>{m.label}</span>
              </label>
            ))}
          </fieldset>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Votre adresse e-mail pour la réponse (facultatif)</span>
            <input type="email" value={v.email || ""} onChange={(e) => maj("email", e.target.value)} style={champStyle} />
          </label>
          <p style={{ fontSize: 12.5, color: "#555", margin: "0 0 12px", lineHeight: 1.5 }}>{AVERTISSEMENT_COUVERTURE}</p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#1a1a1a", marginBottom: 14, lineHeight: 1.45 }}>
            <input type="checkbox" checked={!!v.consentement} onChange={(e) => maj("consentement", e.target.checked)} style={{ marginTop: 3 }} />
            <span><strong>Mon accord *</strong> — {PHRASE_CONSENTEMENT}</span>
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={preparerEmail} style={btn(true)}>Préparer mon e-mail</button>
            <button onClick={copier} style={btn(false)}>{copie ? "Fiche copiée ✔" : "Copier la fiche"}</button>
          </div>
          {message && <p role="status" style={{ fontSize: 13, color: problemes.length ? "#a32d2d" : "#444", margin: "12px 0 0", lineHeight: 1.5 }}>{message}</p>}
        </div>
      )}
    </div>
  );
}
