import { supabase } from './supabase';

export function isDataUrl(src: string): boolean {
  return src.startsWith('data:');
}

function extFromMime(mime: string): string {
  return (mime.split('/')[1] || 'png').replace('+xml', '');
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* Upload une image (File ou Blob) vers le bucket `note-images` sous
   <user_id>/<uuid>.<ext> et renvoie son URL publique.
   Renvoie null si le stockage cloud est indisponible (mode local, non
   connecté, ou échec) → l'appelant conserve alors l'image en base64. */
export async function uploadImage(input: File | Blob): Promise<string | null> {
  if (!supabase) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const ext = extFromMime(input.type);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('note-images')
    .upload(path, input, { contentType: input.type || `image/${ext}`, upsert: false });
  if (error) return null;
  return supabase.storage.from('note-images').getPublicUrl(path).data.publicUrl;
}

/* Variante pour une image déjà encodée en data URL (migration des
   anciennes notes où l'image était stockée en base64 dans le JSON). */
export async function uploadDataUrl(dataUrl: string): Promise<string | null> {
  try {
    return await uploadImage(dataUrlToBlob(dataUrl));
  } catch {
    return null;
  }
}
