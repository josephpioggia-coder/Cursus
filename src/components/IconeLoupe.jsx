// Icônes de loupe dessinées sur <canvas> (le mode sombre forcé des navigateurs
// mobiles inverserait un emoji ou un SVG texte, jamais un canvas).
// type "analyse" : A surligné en jaune + loupe ; "fond" : loupe + coche verte ; "faits" : loupe + chiffres.
import { useEffect, useRef } from "react";

export default function IconeLoupe({ type, taille = 18 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const d = window.devicePixelRatio || 1;
    c.width = c.height = taille * d;
    const g = c.getContext("2d");
    g.scale((taille * d) / 32, (taille * d) / 32);
    g.lineCap = "round";
    g.lineJoin = "round";
    const loupe = (x, y, r, l) => {
      g.strokeStyle = "#444"; g.lineWidth = 2.6;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x + r * 0.72, y + r * 0.72); g.lineTo(x + r * 0.72 + l, y + r * 0.72 + l); g.stroke();
    };
    if (type === "analyse") {
      g.fillStyle = "#FFD83B";
      g.beginPath(); g.roundRect(1, 7, 21, 13, 2); g.fill();
      g.fillStyle = "#444"; g.font = "bold 14px Arial, sans-serif"; g.textAlign = "center";
      g.fillText("A", 11.5, 18.5);
      loupe(21, 19, 6, 6);
    } else if (type === "faits") {
      loupe(13, 13, 8.5, 7);
      g.fillStyle = "#185FA5"; g.font = "bold 12px Arial, sans-serif"; g.textAlign = "center";
      g.fillText("12", 13, 17.2);
    } else {
      loupe(13, 13, 8.5, 7);
      g.strokeStyle = "#1D9E75"; g.lineWidth = 2.8;
      g.beginPath(); g.moveTo(9, 13); g.lineTo(12, 16.2); g.lineTo(17.5, 9.5); g.stroke();
    }
  }, [type, taille]);
  return <canvas ref={ref} aria-hidden="true" style={{ width: taille, height: taille, display: "block", flexShrink: 0 }} />;
}
