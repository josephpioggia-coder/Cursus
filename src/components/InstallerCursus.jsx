// « Installer Cursus » (30/10/2026) — mettre l'icône de Cursus sur l'écran d'accueil.
// Chrome / Edge / Samsung Internet (Android) : l'événement `beforeinstallprompt` permet l'installation en un clic.
// Firefox, Safari : AUCUN événement, on affiche les étapes du menu du navigateur. Firefox pour ordinateur ne sait
// Fenêtre rendue par portail (30/10/2026) : le tiroir mobile a un `transform`, qui devient le repère d'un `position: fixed`
// enfant — la fenêtre restait coincée (et rognée) dans le tiroir, donc « le bouton n'est pas activable ».
// pas installer une appli web : on le dit, et on propose le marque-page.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let invite = null; // événement mémorisé : il peut arriver avant que le composant soit affiché
const abonnés = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invite = e; abonnés.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { invite = null; abonnés.forEach((f) => f()); });
}

export function dejaInstallee() {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
}

function detecter() {
  const ua = navigator.userAgent || "";
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const firefox = /Firefox|FxiOS/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  return { android, ios, firefox, samsung, mobile: android || ios };
}

function etapes(p) {
  if (p.ios) return ["Touchez le bouton Partager (le carré avec une flèche vers le haut).", "Faites défiler et touchez « Sur l'écran d'accueil ».", "Touchez « Ajouter »."];
  if (p.android && p.firefox) return ["Touchez le menu ⋮ (en haut ou en bas à droite de Firefox).", "Touchez « Installer » (ou « Ajouter à l'écran d'accueil »).", "Confirmez : l'icône Cursus apparaît sur votre écran d'accueil."];
  if (p.android && p.samsung) return ["Touchez le menu ☰ (en bas à droite).", "Touchez « Ajouter la page à » puis « Écran d'accueil ».", "Confirmez."];
  if (p.android) return ["Touchez le menu ⋮ du navigateur.", "Touchez « Installer l'application » (ou « Ajouter à l'écran d'accueil »).", "Confirmez."];
  if (p.firefox) return ["Firefox pour ordinateur ne permet pas d'installer une application web.", "Ajoutez Cursus à vos marque-pages (Ctrl+D) ou épinglez l'onglet (clic droit sur l'onglet → « Épingler l'onglet »).", "Pour une vraie application sur l'ordinateur, ouvrez cursus.pro dans Chrome ou Edge : icône d'installation à droite de la barre d'adresse."];
  return ["Dans la barre d'adresse, cliquez sur l'icône d'installation (écran avec une flèche) à droite.", "Sinon : menu du navigateur → « Installer Cursus » ou « Enregistrer et partager » → « Installer »."];
}

export default function InstallerCursus({ style, libelle = "📲 Installer Cursus sur l'écran d'accueil", compact = false }) {
  const [, forcer] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => { const f = () => forcer((n) => n + 1); abonnés.add(f); return () => abonnés.delete(f); }, []);
  if (dejaInstallee()) return null;
  const p = detecter();
  const cliquer = async () => {
    if (invite) {
      try { invite.prompt(); await invite.userChoice; } catch { /* refus ou déjà utilisé */ }
      invite = null; forcer((n) => n + 1);
      return;
    }
    setOuvert(true);
  };
  return (
    <>
      <button type="button" onClick={cliquer} style={style || { fontSize: compact ? 12 : 14, padding: compact ? "6px 10px" : "10px 16px", borderRadius: 10, border: "0.5px solid #7F77DD", background: "#fff", color: "#534AB7", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
        {libelle}
      </button>
      {ouvert && createPortal(
        <div onClick={() => setOuvert(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 300 }}>
          <div role="dialog" aria-label="Installer Cursus" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#1a1a1a", borderRadius: 14, padding: "20px 22px", width: "100%", maxWidth: 420, boxSizing: "border-box", fontFamily: "inherit" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Installer Cursus</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
              {etapes(p).map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
            </ol>
            <button type="button" onClick={() => setOuvert(false)} style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#7F77DD", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>J'ai compris</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
