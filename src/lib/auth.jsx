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
import { supabase } from "../lib/supabase.js";
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

export function PageConnexion() {
  const [email, setEmail]       = useState("");
  const [motDePasse, setMDP]    = useState("");
  const [mode, setMode]         = useState("connexion"); // connexion | inscription
  const [chargement, setChargement] = useState(false);
  const [message, setMessage]   = useState(null);
  const [erreur, setErreur]     = useState(null);

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

    if (error) setErreur(error.message);
    setChargement(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff", border: "0.5px solid #e5e5e5",
        borderRadius: 16, padding: "40px 48px", width: 380,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: "#7F77DD", letterSpacing: "0.02em" }}>Atelier</div>
          <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Votre espace d'écriture</div>
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
            <input type="password" value={motDePasse} onChange={(e) => setMDP(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && soumettre()}
              placeholder="••••••••"
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #e5e5e5", borderRadius: 8, fontSize: 14, color: "#1a1a1a", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
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
      </div>
    </div>
  );
}

