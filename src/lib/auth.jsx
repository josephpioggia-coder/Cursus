/**
 * ATELIER D'ÉCRIVAIN — Hook d'authentification
 *
 * Gère la session utilisateur Supabase avec Auth UI intégré.
 * Fournit : user, session, chargement, déconnecter()
 *
 * Utilisation dans App.jsx :
 *   const { user, chargement } = useAuth();
 *   if (chargement) return <Chargement />;
 *   if (!user) return <PageConnexion />;
 */

import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { MentionsLegales, CGV, PolitiqueConfidentialite } from "../components/PagesLegales.jsx";
import ModeEmploi from "../components/ModeEmploi.jsx";
import PlumeAnimee from "../components/PlumeAnimee.jsx";

export function useAuth() {
  const [user, setUser]           = useState(null);
  const [session, setSession]     = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    // Récupère la session existante au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setChargement(false);
    });

    // Écoute les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setChargement(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const déconnecter = () => supabase.auth.signOut();

  return { user, session, chargement, déconnecter };
}

// ─── Composant : Page de connexion ────────────────────────────────────────────

// Dernier email connu (16/08/2026) — localStorage (pas sessionStorage :
// doit survivre à la fermeture du navigateur/ordinateur), pré-rempli au
// chargement de la page. Un seul champ mémorisé, jamais le mot de passe.
const CLÉ_DERNIER_EMAIL = "cursus_dernier_email";

export function PageConnexion() {
  const [email, setEmail]       = useState(() => {
    try {
      return localStorage.getItem(CLÉ_DERNIER_EMAIL) || "";
    } catch (_e) {
      return "";
    }
  });
  const [motDePasse, setMDP]    = useState("");
  const [voirMotDePasse, setVoirMotDePasse] = useState(false);
  const [mode, setMode]         = useState("connexion"); // connexion | inscription
  const [chargement, setChargement] = useState(false);
  const [message, setMessage]   = useState(null);
  const [erreur, setErreur]     = useState(null);
  // Pages légales (15/09/2026) — accessibles SANS connexion, obligation
  // légale (mentions légales, CGV, confidentialité doivent être
  // consultables par n'importe qui, pas seulement un compte existant).
  // null = formulaire de connexion normal.
  const [pageLégale, setPageLégale] = useState(null);

  const soumettre = async () => {
    if (!email || !motDePasse) return;
    setChargement(true);
    setErreur(null);
    setMessage(null);

    let error;
    if (mode === "connexion") {
      ({ error } = await supabase.auth.signInWithPassword({ email, password: motDePasse }));
    } else {
      ({ error } = await supabase.auth.signUp({ email, password: motDePasse }));
      if (!error) setMessage("Compte créé ! Vérifiez votre email pour confirmer.");
    }

    if (error) {
      setErreur(error.message);
    } else {
      try { localStorage.setItem(CLÉ_DERNIER_EMAIL, email); } catch (_e) { /* stockage indisponible, sans conséquence */ }
    }
    setChargement(false);
  };

  if (pageLégale === "mentions") return <MentionsLegales onRetour={() => setPageLégale(null)} onNaviguer={setPageLégale} />;
  if (pageLégale === "cgv") return <CGV onRetour={() => setPageLégale(null)} onNaviguer={setPageLégale} />;
  if (pageLégale === "confidentialite") return <PolitiqueConfidentialite onRetour={() => setPageLégale(null)} onNaviguer={setPageLégale} />;
  // 24/09/2026 — "aide à l'inscription ou à l'ouverture, sur la 1ère
  // page" : accessible ici, avant même la création d'un compte, pas
  // seulement une fois connecté·e (voir EcranChoixEspace.jsx et
  // AppConnectée dans App.jsx pour les deux autres points d'entrée).
  if (pageLégale === "mode-emploi") return <ModeEmploi onRetour={() => setPageLégale(null)} />;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <PlumeAnimee />
      <div style={{
        background: "#fff", border: "0.5px solid #e5e5e5",
        borderRadius: 16, padding: "40px 48px", width: 380,
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* 06/09/2026 — logo agrandi de 48 à 98px : trop petit comparé aux
              logos de l'écran d'accueil (98px dans le bandeau, 110px sur les
              cartes) — même taille que le bandeau Cursus Essentiel pour
              rester cohérent d'une page à l'autre. */}
          <img src="/logo-cursus.png" alt="Cursus" style={{ height: 98, width: 98, borderRadius: 16, marginBottom: 8 }} />
          <div style={{ fontSize: 28, fontWeight: 500, color: "#7F77DD", letterSpacing: "0.02em" }}>Cursus</div>
          {/* Texte clarifié (23/09/2026, demande de Joseph) — cette page est,
              en pratique, la SEULE page que voit un visiteur non connecté
              (App.jsx : `if (!user) return <PageConnexion />;`), donc la
              seule que les moteurs de recherche et IA de recherche peuvent
              lire pour comprendre ce qu'est Cursus. L'ancienne version
              (une ligne grise de 13px, "CursEdit pour écrire, CursAudit
              pour auditer, CursDecision pour décider") était trop courte
              pour ça : une IA de recherche a fini par décrire Cursus comme
              un outil de "gestion de parcours de formation" et "d'audit de
              conformité" faute de matière réelle à lire. Texte repris des
              accroches déjà écrites et validées dans EcranChoixEspace.jsx
              (le détail complet, lui, reste réservé aux comptes connectés).
              La riche description en accès libre côté SEO reste un
              compromis : plus de texte ici aide le référencement, mais
              cette page est d'abord un formulaire de connexion, pas une
              page de lancement dédiée (voir PageLancement.jsx, elle,
              seulement accessible une fois connecté). */}
          <p style={{ fontSize: 13, color: "#666", marginTop: 8, lineHeight: 1.5 }}>
            Cursus est une suite d'écriture et d'audit assistée par IA, pour les auteurs, essayistes et rédacteurs de documents longs.
          </p>
          <div style={{ fontSize: 11.5, color: "#999", marginTop: 6, lineHeight: 1.6, textAlign: "left" }}>
            <div><b style={{ color: "#8B2635" }}>CursEdit</b> — votre espace d'écriture accompagné par IA : structurer, rédiger et réviser un manuscrit.</div>
            <div style={{ marginTop: 3 }}><b style={{ color: "#0E3374" }}>CursAudit</b> — auditer un texte déjà écrit : preuve, cohérence, risques, sur une grille de critères.</div>
            <div style={{ marginTop: 3 }}><b style={{ color: "#0E7256" }}>CursDecision</b> — transformer une situation complexe ou floue en décision claire, argumentée et suivable.</div>
          </div>
          {/* 24/09/2026 — remonté du pied de page (lien discret parmi les
              pages légales) à un vrai bouton, ici : demande explicite de
              Joseph, "ne serait-ce que parce qu'il indique les premiers
              pas à l'inscription" — utile à voir AVANT même de remplir le
              formulaire, pas juste accessible en cherchant tout en bas. Le
              lien du pied de page reste aussi, pour qui revient plus tard.
              RENDU LUDIQUE (24/09/2026, suite) — demande explicite : "rendre
              l'accès au mode d'emploi plus ludique" en y incorporant la
              mascotte de Cursus, baptisée "Æncre" par Joseph (jeu de mots
              avec "encre") — la plume animée du logo, ici recadrée en
              portrait (public/aencre-icone.png, issu de l'illustration
              fournie). Léger mouvement continu (flottement) + réaction au
              survol, pour donner un peu de vie plutôt qu'un simple bouton
              texte. */}
          <button onClick={() => setPageLégale("mode-emploi")} className="bouton-aencre"
            style={{
              marginTop: 14, width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "7px 14px 7px 7px", borderRadius: 30, textAlign: "left",
              border: "0.5px solid #7F77DD40", background: "#F5F4FD", color: "#7F77DD",
              fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>
            <img src="/aencre-icone.png" alt="Æncre" className="aencre-avatar" style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              boxShadow: "0 2px 6px rgba(127,119,221,0.35)",
            }} />
            <span><b>Æncre</b> vous guide — mode d'emploi, premiers pas</span>
          </button>
          <style>{`
            @keyframes aencre-flotte {
              0%, 100% { transform: translateY(0) rotate(-2deg); }
              50% { transform: translateY(-3px) rotate(2deg); }
            }
            .aencre-avatar { animation: aencre-flotte 2.8s ease-in-out infinite; }
            .bouton-aencre:hover .aencre-avatar { animation-play-state: paused; transform: scale(1.12) rotate(-6deg); }
            .bouton-aencre:hover { border-color: #7F77DD80; }
          `}</style>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", borderBottom: "0.5px solid #e5e5e5", marginBottom: 24 }}>
          {[["connexion", "Connexion"], ["inscription", "Créer un compte"]].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id); setErreur(null); setMessage(null); }}
              style={{
                flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: "inherit",
                fontSize: 13, fontWeight: mode === id ? 500 : 400,
                color: mode === id ? "#7F77DD" : "#999",
                borderBottom: mode === id ? "2px solid #7F77DD" : "2px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Formulaire */}
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && soumettre()}
              placeholder="vous@exemple.com"
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #e5e5e5", borderRadius: 8, fontSize: 14, color: "#1a1a1a", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 5 }}>Mot de passe</label>
            <div style={{ position: "relative" }}>
              <input type={voirMotDePasse ? "text" : "password"} value={motDePasse} onChange={(e) => setMDP(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && soumettre()}
                placeholder="••••••••" autoFocus={!!email}
                style={{ width: "100%", padding: "9px 38px 9px 12px", border: "0.5px solid #e5e5e5", borderRadius: 8, fontSize: 14, color: "#1a1a1a", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setVoirMotDePasse((v) => !v)}
                title={voirMotDePasse ? "Masquer" : "Afficher"}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", fontSize: 15,
                  padding: 4, color: "#999", lineHeight: 1,
                }}>
                {voirMotDePasse ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {erreur && (
            <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#A32D2D" }}>
              {erreur}
            </div>
          )}
          {message && (
            <div style={{ background: "#EAF3DE", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#3B6D11" }}>
              {message}
            </div>
          )}

          <button onClick={soumettre} disabled={chargement || !email || !motDePasse}
            style={{
              background: chargement ? "#AFA9EC" : "#7F77DD", color: "#fff",
              border: "none", borderRadius: 8, padding: "10px",
              fontSize: 14, fontWeight: 500, cursor: chargement ? "default" : "pointer",
              fontFamily: "inherit", marginTop: 4,
            }}>
            {chargement ? "…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          Vos données sont stockées en toute sécurité sur Supabase.
        </p>

        {/* Pages légales (15/09/2026) — lien obligatoire, accessible sans
            connexion. Voir src/components/PagesLegales.jsx. */}
        <p style={{ fontSize: 10.5, color: "#ccc", textAlign: "center", marginTop: 10 }}>
          <button onClick={() => setPageLégale("mode-emploi")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 10.5, fontFamily: "inherit", textDecoration: "underline" }}>Mode d'emploi</button>
          {" · "}
          <button onClick={() => setPageLégale("mentions")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 10.5, fontFamily: "inherit", textDecoration: "underline" }}>Mentions légales</button>
          {" · "}
          <button onClick={() => setPageLégale("cgv")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 10.5, fontFamily: "inherit", textDecoration: "underline" }}>CGV</button>
          {" · "}
          <button onClick={() => setPageLégale("confidentialite")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 10.5, fontFamily: "inherit", textDecoration: "underline" }}>Confidentialité</button>
        </p>
      </div>
    </div>
  );
}

