/**
 * ATELIER D'ÉCRIVAIN — Module 4 : Bibliothèque & Citations
 *
 * Fonctionnalités :
 *   - Fiches de livres (titre, auteur, année, éditeur, genre, statut de lecture)
 *   - Extraction et stockage de citations avec page et paragraphe
 *   - Format APA automatique pour chaque source
 *   - Liaison des citations aux projets et chapitres
 *   - Recherche et filtrage par auteur, genre, thème, projet
 *   - Tags thématiques transversaux
 *   - Export des références APA d'un projet
 */

import { useState, useMemo } from "react";

// ─── Constantes ────────────────────────────────────────────────────────────────

const GENRES_LIVRE = ["Philosophie", "Psychologie", "Sociologie", "Sciences", "Histoire",
  "Roman", "Essai", "Biographie", "Méthode", "Autre"];

const STATUTS_LECTURE = ["Lu", "En cours", "À lire", "Référence"];

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Format APA ────────────────────────────────────────────────────────────────

const formatAPA = (livre) => {
  if (!livre) return "";
  const auteur = livre.auteur
    ? livre.auteur.split(" ").map((mot, i, arr) =>
        i === arr.length - 1 ? mot.toUpperCase() : `${mot[0]}.`
      ).reverse().join(" ")
    : "Auteur inconnu";
  const année = livre.année ? `(${livre.année})` : "(s.d.)";
  const titre = livre.titre ? `*${livre.titre}*` : "";
  const éditeur = livre.éditeur || "";
  const ville = livre.ville || "";
  const parties = [auteur, année, titre, [ville, éditeur].filter(Boolean).join(" : ")].filter(Boolean);
  return parties.join(". ") + ".";
};

const formatAPACitation = (livre, page, paragraphe) => {
  if (!livre) return "";
  const auteur = livre.auteur?.split(" ").pop() || "Auteur";
  const année = livre.année || "s.d.";
  const loc = [page ? `p. ${page}` : null, paragraphe ? `§${paragraphe}` : null].filter(Boolean).join(", ");
  return loc ? `(${auteur}, ${année}, ${loc})` : `(${auteur}, ${année})`;
};

// ─── Données de démo ────────────────────────────────────────────────────────────

const DEMO_LIVRES = [
  {
    id: genId(),
    titre: "L'Esprit, le soi et la société",
    auteur: "George Herbert Mead",
    année: "1934",
    éditeur: "PUF",
    ville: "Paris",
    genre: "Sociologie",
    statut: "Lu",
    note: "Fondamental pour la construction identitaire et le regard de l'autre.",
    tags: ["identité", "regard", "social"],
    couverture: null,
    citations: [
      {
        id: genId(),
        texte: "Le soi est une construction sociale — il émerge dans l'interaction avec autrui, jamais en dehors d'elle.",
        page: "138",
        paragraphe: "2",
        projetId: null,
        tags: ["identité", "regard"],
        dateAjout: "2025-11-12",
      },
      {
        id: genId(),
        texte: "L'individu se voit lui-même uniquement en prenant la perspective d'autrui pour se regarder.",
        page: "152",
        paragraphe: "1",
        projetId: null,
        tags: ["perspective", "autrui"],
        dateAjout: "2025-11-14",
      },
    ],
  },
  {
    id: genId(),
    titre: "Resolving Social Conflicts",
    auteur: "Kurt Lewin",
    année: "1948",
    éditeur: "Harper & Row",
    ville: "New York",
    genre: "Psychologie",
    statut: "Lu",
    note: "Lewin pose les bases du changement par le contexte, pas par la volonté.",
    tags: ["changement", "contexte", "groupe"],
    couverture: null,
    citations: [
      {
        id: genId(),
        texte: "Ce n'est pas l'individu qu'il faut changer, mais le champ psychologique dans lequel il évolue.",
        page: "59",
        paragraphe: "3",
        projetId: null,
        tags: ["changement", "contexte"],
        dateAjout: "2025-10-03",
      },
    ],
  },
  {
    id: genId(),
    titre: "Thinking, Fast and Slow",
    auteur: "Daniel Kahneman",
    année: "2011",
    éditeur: "Farrar, Straus and Giroux",
    ville: "New York",
    genre: "Psychologie",
    statut: "En cours",
    note: "Système 1 / Système 2 — utile pour la partie décision dans la méthode.",
    tags: ["cognition", "décision", "biais"],
    couverture: null,
    citations: [],
  },
];

// ─── Composant : Badge ─────────────────────────────────────────────────────────

function Badge({ label, couleur = "#7F77DD", small = false }) {
  const bg = couleur + "20";
  return (
    <span style={{
      display: "inline-block",
      background: bg, color: couleur,
      fontSize: small ? 10 : 11,
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 20, fontWeight: 500,
      marginRight: 4, marginBottom: 4,
    }}>{label}</span>
  );
}

// ─── Composant : Carte livre ────────────────────────────────────────────────────

function CarreLivre({ livre, sélectionné, onClick }) {
  const couleurStatut = {
    "Lu": "#1D9E75", "En cours": "#7F77DD",
    "À lire": "#BA7517", "Référence": "#378ADD",
  }[livre.statut] || "#888";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--color-background-primary)",
        border: `0.5px solid ${sélectionné ? "#7F77DD" : "var(--color-border-tertiary)"}`,
        borderLeft: `3px solid ${couleurStatut}`,
        borderRadius: 10, padding: "12px 14px",
        cursor: "pointer",
        outline: sélectionné ? "1px solid #7F77DD" : "none",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!sélectionné) e.currentTarget.style.borderColor = "#7F77DD50"; }}
      onMouseLeave={(e) => { if (!sélectionné) e.currentTarget.style.borderColor = "var(--color-border-tertiary)"; }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 3, lineHeight: 1.3 }}>
        {livre.titre}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
        {livre.auteur}{livre.année ? `, ${livre.année}` : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Badge label={livre.statut} couleur={couleurStatut} small />
        {livre.citations.length > 0 && (
          <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
            {livre.citations.length} citation{livre.citations.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Composant : Formulaire livre ──────────────────────────────────────────────

function FormulaireLivre({ initial = {}, onSauvegarder, onAnnuler }) {
  const [form, setForm] = useState({
    titre: "", auteur: "", année: "", éditeur: "",
    ville: "", genre: "Essai", statut: "À lire", note: "",
    tags: "", ...initial,
    tags: (initial.tags || []).join(", "),
  });
  const màj = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valider = () => {
    if (!form.titre.trim()) return;
    onSauvegarder({
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      citations: initial.citations || [],
      id: initial.id || genId(),
    });
  };

  const label = (t) => (
    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>{t}</label>
  );
  const input = (k, placeholder, type = "text") => (
    <input type={type} value={form[k]} placeholder={placeholder}
      onChange={(e) => màj(k, e.target.value)}
      style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>{label("Titre *")}{input("titre", "Titre du livre")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>{label("Auteur")}{input("auteur", "Prénom Nom")}</div>
        <div>{label("Année")}{input("année", "2024", "number")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>{label("Éditeur")}{input("éditeur", "Gallimard")}</div>
        <div>{label("Ville")}{input("ville", "Paris")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          {label("Genre")}
          <select value={form.genre} onChange={(e) => màj("genre", e.target.value)}
            style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
            {GENRES_LIVRE.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          {label("Statut")}
          <select value={form.statut} onChange={(e) => màj("statut", e.target.value)}
            style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
            {STATUTS_LECTURE.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        {label("Tags (séparés par des virgules)")}
        {input("tags", "identité, changement, cognition")}
      </div>
      <div>
        {label("Note personnelle")}
        <textarea value={form.note} onChange={(e) => màj("note", e.target.value)}
          placeholder="Pourquoi ce livre est important pour toi…"
          rows={2} style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={valider}
          style={{ background: "#7F77DD", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          {initial.id ? "Enregistrer" : "Ajouter le livre"}
        </button>
        <button onClick={onAnnuler}
          style={{ background: "transparent", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Composant : Formulaire citation ────────────────────────────────────────────

function FormulaireCitation({ livre, projets = [], onAjouter, onAnnuler }) {
  const [form, setForm] = useState({ texte: "", page: "", paragraphe: "", projetId: "", tags: "" });
  const màj = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valider = () => {
    if (!form.texte.trim()) return;
    onAjouter({
      id: genId(),
      texte: form.texte.trim(),
      page: form.page,
      paragraphe: form.paragraphe,
      projetId: form.projetId || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      dateAjout: new Date().toISOString().slice(0, 10),
    });
  };

  const apaCitation = formatAPACitation(livre, form.page, form.paragraphe);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Texte de la citation *</label>
        <textarea value={form.texte} onChange={(e) => màj("texte", e.target.value)}
          placeholder="Copiez ici le passage exact…"
          rows={3} style={{ width: "100%", padding: "8px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Page</label>
          <input value={form.page} onChange={(e) => màj("page", e.target.value)} placeholder="138"
            style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Paragraphe</label>
          <input value={form.paragraphe} onChange={(e) => màj("paragraphe", e.target.value)} placeholder="2"
            style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </div>
      {apaCitation && (
        <div style={{ background: "#EEEDFE", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#534AB7", fontStyle: "italic" }}>
          Référence APA : {apaCitation}
        </div>
      )}
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Lier à un projet</label>
        <select value={form.projetId} onChange={(e) => màj("projetId", e.target.value)}
          style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
          <option value="">Aucun projet</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Tags</label>
        <input value={form.tags} onChange={(e) => màj("tags", e.target.value)} placeholder="identité, regard, changement"
          style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 13, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={valider}
          style={{ background: "#7F77DD", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          Ajouter la citation
        </button>
        <button onClick={onAnnuler}
          style={{ background: "transparent", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Composant : Fiche livre détaillée ──────────────────────────────────────────

function FicheLivre({ livre, projets, onMàj, onSupprimer }) {
  const [onglet, setOnglet] = useState("citations"); // citations | apa | modifier
  const [ajouterCitation, setAjouterCitation] = useState(false);

  const couleurStatut = {
    "Lu": "#1D9E75", "En cours": "#7F77DD",
    "À lire": "#BA7517", "Référence": "#378ADD",
  }[livre.statut] || "#888";

  const référenceAPA = formatAPA(livre);

  const ajouterNouvellleCitation = (citation) => {
    onMàj({ ...livre, citations: [...(livre.citations || []), citation] });
    setAjouterCitation(false);
  };

  const supprimerCitation = (citationId) => {
    onMàj({ ...livre, citations: livre.citations.filter((c) => c.id !== citationId) });
  };

  // Export biblio APA de toutes les citations de ce livre
  const exporterAPA = () => {
    const lignes = [référenceAPA, "", ...livre.citations.map((c) => {
      const ref = formatAPACitation(livre, c.page, c.paragraphe);
      return `${ref} « ${c.texte} »`;
    })].join("\n");
    navigator.clipboard?.writeText(lignes);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 24px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px", lineHeight: 1.3 }}>
              {livre.titre}
            </h2>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {livre.auteur}{livre.année ? ` · ${livre.année}` : ""}{livre.éditeur ? ` · ${livre.éditeur}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            <Badge label={livre.statut} couleur={couleurStatut} />
            <button onClick={() => onSupprimer(livre.id)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--color-text-tertiary)", padding: "0 4px" }}>✕</button>
          </div>
        </div>
        {livre.note && (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "10px 0 0", lineHeight: 1.6, fontStyle: "italic" }}>
            {livre.note}
          </p>
        )}
        {livre.tags?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {livre.tags.map((t) => <Badge key={t} label={t} couleur="#888" small />)}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {[
          { id: "citations", label: `Citations (${livre.citations?.length || 0})` },
          { id: "apa", label: "Référence APA" },
          { id: "modifier", label: "Modifier" },
        ].map((o) => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            style={{
              flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
              background: "transparent", fontFamily: "inherit",
              fontSize: 12, fontWeight: onglet === o.id ? 500 : 400,
              color: onglet === o.id ? "#7F77DD" : "var(--color-text-secondary)",
              borderBottom: onglet === o.id ? "2px solid #7F77DD" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      <div style={{ flex: 1, padding: "16px 24px", overflowY: "auto" }}>

        {/* Onglet Citations */}
        {onglet === "citations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={() => setAjouterCitation(true)}
                style={{ background: "#7F77DD", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                + Nouvelle citation
              </button>
            </div>

            {ajouterCitation && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "14px", marginBottom: 14, border: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 12 }}>Nouvelle citation</div>
                <FormulaireCitation livre={livre} projets={projets} onAjouter={ajouterNouvellleCitation} onAnnuler={() => setAjouterCitation(false)} />
              </div>
            )}

            {livre.citations?.length === 0 && !ajouterCitation && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>
                Aucune citation pour ce livre.<br />Ajoutez-en une pour enrichir votre bibliothèque.
              </div>
            )}

            {livre.citations?.map((c) => {
              const projetLié = projets.find((p) => p.id === c.projetId);
              const apa = formatAPACitation(livre, c.page, c.paragraphe);
              return (
                <div key={c.id} style={{
                  background: "var(--color-background-primary)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderLeft: "3px solid #7F77DD",
                  borderRadius: 8, padding: "12px 14px", marginBottom: 10,
                }}>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-primary)", fontStyle: "italic", margin: "0 0 10px" }}>
                    « {c.texte} »
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#534AB7", fontFamily: "monospace" }}>{apa}</span>
                    {c.page && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>p. {c.page}</span>}
                    {c.paragraphe && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>§{c.paragraphe}</span>}
                    {projetLié && <Badge label={projetLié.titre} couleur={projetLié.couleur} small />}
                    {c.tags?.map((t) => <Badge key={t} label={t} couleur="#888" small />)}
                    <button onClick={() => supprimerCitation(c.id)}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-tertiary)" }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Onglet APA */}
        {onglet === "apa" && (
          <div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Référence complète</div>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--color-text-primary)", fontFamily: "Georgia, serif", margin: 0 }}>
                {référenceAPA}
              </p>
            </div>
            {livre.citations?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Citations avec références</div>
                {livre.citations.map((c) => (
                  <div key={c.id} style={{ marginBottom: 12, padding: "10px 14px", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: "#534AB7", fontFamily: "monospace" }}>
                      {formatAPACitation(livre, c.page, c.paragraphe)}
                    </span>
                    <p style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic", margin: "6px 0 0", lineHeight: 1.6 }}>
                      « {c.texte} »
                    </p>
                  </div>
                ))}
              </>
            )}
            <button onClick={exporterAPA}
              style={{ marginTop: 8, background: "transparent", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 16px", fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>
              📋 Copier tout dans le presse-papiers
            </button>
          </div>
        )}

        {/* Onglet Modifier */}
        {onglet === "modifier" && (
          <FormulaireLivre
            initial={livre}
            onSauvegarder={(données) => { onMàj(données); setOnglet("citations"); }}
            onAnnuler={() => setOnglet("citations")}
          />
        )}
      </div>
    </div>
  );
}

// ─── Composant principal : Bibliothèque ──────────────────────────────────────────

export default function Bibliotheque({ projets = [] }) {
  const [livres, setLivres] = useState(() => {
    try {
      const s = localStorage.getItem("atelier-bibliotheque");
      return s ? JSON.parse(s) : DEMO_LIVRES;
    } catch { return DEMO_LIVRES; }
  });
  const [livreActifId, setLivreActifId] = useState(livres[0]?.id || null);
  const [ajouterLivre, setAjouterLivre] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtreGenre, setFiltreGenre] = useState("Tous");
  const [filtreStatut, setFiltreStatut] = useState("Tous");

  const sauvegarder = (l) => {
    setLivres(l);
    localStorage.setItem("atelier-bibliotheque", JSON.stringify(l));
  };

  const livreActif = livres.find((l) => l.id === livreActifId);

  const livresFiltré = useMemo(() => {
    const q = recherche.toLowerCase();
    return livres.filter((l) => {
      const matchRecherche = !q ||
        l.titre?.toLowerCase().includes(q) ||
        l.auteur?.toLowerCase().includes(q) ||
        l.tags?.some((t) => t.toLowerCase().includes(q)) ||
        l.citations?.some((c) => c.texte?.toLowerCase().includes(q));
      const matchGenre = filtreGenre === "Tous" || l.genre === filtreGenre;
      const matchStatut = filtreStatut === "Tous" || l.statut === filtreStatut;
      return matchRecherche && matchGenre && matchStatut;
    });
  }, [livres, recherche, filtreGenre, filtreStatut]);

  const totalCitations = livres.reduce((acc, l) => acc + (l.citations?.length || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "100%", overflow: "hidden" }}>

      {/* ── Panneau gauche : liste des livres ── */}
      <div style={{
        borderRight: "0.5px solid var(--color-border-tertiary)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--color-background-secondary)",
      }}>
        {/* En-tête sidebar */}
        <div style={{ padding: "16px 14px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>Bibliothèque</div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{livres.length} livre{livres.length !== 1 ? "s" : ""} · {totalCitations} citation{totalCitations !== 1 ? "s" : ""}</div>
            </div>
            <button onClick={() => { setAjouterLivre(true); setLivreActifId(null); }}
              style={{ background: "#7F77DD", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
              + Livre
            </button>
          </div>
          {/* Recherche */}
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            style={{ width: "100%", padding: "6px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 12, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
          {/* Filtres */}
          <div style={{ display: "flex", gap: 6 }}>
            <select value={filtreGenre} onChange={(e) => setFiltreGenre(e.target.value)}
              style={{ flex: 1, padding: "5px 6px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
              <option value="Tous">Tous genres</option>
              {GENRES_LIVRE.map((g) => <option key={g}>{g}</option>)}
            </select>
            <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
              style={{ flex: 1, padding: "5px 6px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
              <option value="Tous">Tous statuts</option>
              {STATUTS_LECTURE.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {livresFiltré.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--color-text-tertiary)", fontSize: 12 }}>
              Aucun résultat.
            </div>
          ) : (
            livresFiltré.map((l) => (
              <div key={l.id} style={{ marginBottom: 6 }}>
                <CarreLivre
                  livre={l}
                  sélectionné={livreActifId === l.id && !ajouterLivre}
                  onClick={() => { setLivreActifId(l.id); setAjouterLivre(false); }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Panneau droit : fiche ou formulaire ── */}
      <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {ajouterLivre ? (
          <div style={{ padding: "24px 28px", overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 20 }}>Ajouter un livre</h2>
            <FormulaireLivre
              onSauvegarder={(données) => {
                const nouveaux = [...livres, données];
                sauvegarder(nouveaux);
                setLivreActifId(données.id);
                setAjouterLivre(false);
              }}
              onAnnuler={() => setAjouterLivre(false)}
            />
          </div>
        ) : livreActif ? (
          <FicheLivre
            livre={livreActif}
            projets={projets}
            onMàj={(données) => sauvegarder(livres.map((l) => l.id === données.id ? données : l))}
            onSupprimer={(id) => {
              sauvegarder(livres.filter((l) => l.id !== id));
              setLivreActifId(livres.find((l) => l.id !== id)?.id || null);
            }}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
            Sélectionnez un livre pour voir sa fiche.
          </div>
        )}
      </div>
    </div>
  );
}
