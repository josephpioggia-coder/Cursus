/**
 * IMPORT CYCLE "DE PAUL À WALL STREET"
 * Version simplifiée — utilise l'email directement
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const EMAIL    = "joseph.pioggia@gmail.com";
const PASSWORD = process.argv[2]; // passé en argument

const CYCLE = [
  {
    titre: "Tome I — De Paul à Wall Street",
    genre: "Essai", statut: "En cours", couleur: "#7F77DD", objectif_mots: 90000,
    description: "Foi, culpabilité et naissance du sujet débiteur.",
    parties: [
      { titre: "Partie I — La dette du lien", chapitres: [
        "Avant-propos au féminin",
        "Introduction — La condition féminine au premier siècle",
        "Chapitre 1 — Les âges du lien",
        "Chapitre 2 — Quel Dieu ? Quel divin ?",
        "Chapitre 3 — Le contexte culturel et socio-politique",
        "Chapitre 4 — Qui était Jésus-Christ ?",
        "Chapitre 5 — Qui était l'apôtre Paul ?",
      ]},
      { titre: "Partie II — La dette économique", chapitres: [
        "Chapitre 6 — De la dette de Dieu à la dette d'argent",
        "Chapitre 7 — Adam Smith et la foi dans l'intérêt",
        "Chapitre 8 — La bienveillance effacée",
        "Chapitre 9 — Le capitalisme comme théologie implicite",
        "Chapitre 10 — Wall Street ou la transcendance abstraite",
        "Chapitre 11 — L'effacement du féminin dans l'économie moderne",
        "Chapitre 12 — La fabrication culturelle du désir",
        "Épilogue — La dette comme architecture invisible",
      ]},
    ],
  },
  {
    titre: "Tome II — De la dette au calcul",
    genre: "Essai", statut: "En cours", couleur: "#1D9E75", objectif_mots: 100000,
    description: "Économie du moi et gouvernement du vivant.",
    parties: [
      { titre: "Préambule — Le moi comme nouvelle entreprise", chapitres: [
        "Introduction — Du salut religieux à l'optimisation de soi",
      ]},
      { titre: "Partie I — La dette de soi", chapitres: [
        "Chapitre 1 — La psychologisation du salut",
        "Chapitre 2 — Le capital émotionnel",
        "Chapitre 3 — Le sujet réflexif contemporain",
      ]},
      { titre: "Partie II — Le corps, le féminin et le marché", chapitres: [
        "Chapitre 4 — Le féminin instrumentalisé",
        "Chapitre 5 — Le corps performant",
        "Chapitre 6 — Visibilité, stigmate et reclassement symbolique",
      ]},
      { titre: "Partie III — Le gouvernement du vivant", chapitres: [
        "Chapitre 7 — La vérité qui ne domine pas",
        "Chapitre 8 — Le temps saturé",
        "Chapitre 9 — La solitude du sujet entrepreneurial",
      ]},
      { titre: "Partie IV — Sortir du calcul", chapitres: [
        "Chapitre 10 — Le féminin comme économie du vivant",
        "Chapitre 11 — L'économie du don",
        "Chapitre 12 — Vers une foi sans dette",
        "Épilogue — Aime, et tu seras libre",
      ]},
    ],
  },
  {
    titre: "Tome III — Les architectures du lien",
    genre: "Essai", statut: "En cours", couleur: "#D85A30", objectif_mots: 100000,
    description: "Couple, désir, sexualité et crise relationnelle contemporaine.",
    parties: [
      { titre: "Partie I — Le lien après l'effondrement", chapitres: [
        "Chapitre 1 — Le couple saturé",
        "Chapitre 2 — Solitude, hyperindividualisme et recomposition",
        "Chapitre 3 — Le corps après la performance",
        "Chapitre 4 — La fatigue d'aimer dans un monde saturé",
      ]},
      { titre: "Partie II — Le corps, le désir et la présence", chapitres: [
        "Chapitre 5 — Le corps comme espace relationnel",
        "Chapitre 6 — Désir, attachement et sécurité affective",
        "Chapitre 7 — Sexualités contemporaines et architectures du lien",
      ]},
      { titre: "Partie III — Vers une grammaire consciente du lien", chapitres: [
        "Chapitre 8 — Désimbriquer les registres du lien",
        "Chapitre 9 — Limites, consentement et métacommunication",
        "Chapitre 10 — Architectures relationnelles négociées",
      ]},
      { titre: "Partie IV — Paradoxes et limites", chapitres: [
        "Chapitre 11 — Les illusions de la conscience relationnelle",
        "Chapitre 12 — Le temps, les normes et l'imprévisibilité du vivant",
        "Conclusion — Ce que la crise du lien révèle de la dette moderne",
      ]},
    ],
  },
  {
    titre: "Tome IV — Vers une civilisation du lien",
    genre: "Essai", statut: "En cours", couleur: "#378ADD", objectif_mots: 90000,
    description: "Don, soin, présence et anthropologie du vivant relationnel.",
    parties: [
      { titre: "Partie I — Aimer sans posséder", chapitres: [
        "Chapitre 1 — Peut-on aimer sans posséder ?",
        "Chapitre 2 — De la possession à la gratitude",
        "Chapitre 3 — Le couple après le romantisme",
      ]},
      { titre: "Partie II — Communautés, soin et rituels", chapitres: [
        "Chapitre 4 — Le retour des rituels",
        "Chapitre 5 — Communautés relationnelles et écologie du lien",
        "Chapitre 6 — Le soin comme anthropologie",
      ]},
      { titre: "Partie III — Le don contre le calcul", chapitres: [
        "Chapitre 7 — L'économie du don revisitée",
        "Chapitre 8 — Le féminin comme économie du vivant",
        "Chapitre 9 — Une sagesse post-productiviste",
      ]},
      { titre: "Partie IV — Anthropologie du vivant relationnel", chapitres: [
        "Chapitre 10 — L'humain comme être relationnel",
        "Chapitre 11 — Spiritualité du vivant et présence incarnée",
        "Chapitre 12 — Vers une civilisation du lien conscient",
        "Conclusion générale — De Paul à Wall Street, puis au vivant",
      ]},
    ],
  },
];

async function importerCycle() {
  if (!PASSWORD) {
    console.error("❌ Usage : node import-cycle.mjs VOTRE_MOT_DE_PASSE");
    process.exit(1);
  }

  console.log("🔍 Connexion à Supabase...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error || !data.user) {
    console.error("❌ Connexion échouée :", error?.message);
    process.exit(1);
  }

  const userId = data.user.id;
  console.log(`✓ Connecté : ${data.user.email}`);
  console.log("");

  let totalProjets = 0, totalParties = 0, totalChapitres = 0;

  for (const tome of CYCLE) {
    console.log(`📖 ${tome.titre}`);

    const { data: projet, error: errProjet } = await supabase
      .from("projets")
      .insert([{ user_id: userId, titre: tome.titre, genre: tome.genre, statut: tome.statut, couleur: tome.couleur, objectif_mots: tome.objectif_mots, description: tome.description, date_creation: new Date().toISOString().slice(0, 10) }])
      .select().single();

    if (errProjet) { console.error(`  ❌ ${errProjet.message}`); continue; }
    totalProjets++;

    for (let pi = 0; pi < tome.parties.length; pi++) {
      const partie = tome.parties[pi];
      const { data: nPartie, error: errP } = await supabase
        .from("noeuds")
        .insert([{ projet_id: projet.id, parent_id: null, type: "partie", titre: partie.titre, ordre: pi + 1, texte: "" }])
        .select().single();

      if (errP) { console.error(`  ❌ ${errP.message}`); continue; }
      totalParties++;
      console.log(`  📂 ${partie.titre}`);

      for (let ci = 0; ci < partie.chapitres.length; ci++) {
        const { error: errC } = await supabase.from("noeuds")
          .insert([{ projet_id: projet.id, parent_id: nPartie.id, type: "chapitre", titre: partie.chapitres[ci], ordre: ci + 1, texte: "" }]);
        if (!errC) { totalChapitres++; console.log(`    📄 ${partie.chapitres[ci]}`); }
      }
    }
    console.log("");
  }

  console.log("═══════════════════════════════════");
  console.log(`✅ ${totalProjets} projets · ${totalParties} parties · ${totalChapitres} chapitres`);
  console.log("👉 Rechargez http://localhost:5173");
  process.exit(0);
}

importerCycle().catch(console.error);
