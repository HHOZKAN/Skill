import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/* On attend l'URL de l'API (https://<projet>.supabase.co). Celle du tableau de
   bord part sinon en requête et Supabase ne répond que "Invalid path specified
   in request URL", indéchiffrable depuis l'écran de connexion. */
function urlProblem(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `VITE_SUPABASE_URL n'est pas une URL valide (reçu : « ${value} »).`;
  }
  if (parsed.hostname.endsWith('supabase.com')) {
    return "VITE_SUPABASE_URL pointe vers le tableau de bord, pas vers l'API.";
  }
  if (parsed.pathname.replace(/\/+$/, '') !== '') {
    return `VITE_SUPABASE_URL ne doit contenir aucun chemin (reçu : « ${value} »).`;
  }
  return null;
}

function configProblem(): string | null {
  if (!rawUrl && !rawKey) return null; // non configuré : mode local assumé
  if (!rawUrl) return 'VITE_SUPABASE_URL est manquante.';
  if (!rawKey) return 'VITE_SUPABASE_ANON_KEY est manquante.';
  return urlProblem(rawUrl);
}

export const configError = configProblem();

export const supabase =
  rawUrl && rawKey && !configError
    ? createClient(rawUrl.replace(/\/+$/, ''), rawKey)
    : null;

export const hasSupabase = !!supabase;
