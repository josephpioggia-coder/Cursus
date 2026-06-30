/**
 * ATELIER D'ÉCRIVAIN — Client Supabase
 *
 * Ce fichier initialise le client Supabase une seule fois.
 * Toute l'application importe depuis ce fichier.
 *
 * Variables d'environnement requises (fichier .env à la racine) :
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGci...
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Variables Supabase manquantes.\n" +
    "Créez un fichier .env à la racine avec :\n" +
    "  VITE_SUPABASE_URL=https://xxxx.supabase.co\n" +
    "  VITE_SUPABASE_ANON_KEY=eyJ..."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
