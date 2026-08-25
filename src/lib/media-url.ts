import { supabase } from "@/integrations/supabase/client";

/**
 * URL assinada de mídia, com cache em memória.
 *
 * AudioMessage, FileMessage e MediaMessage chamavam `get-media-url` num
 * `useEffect` cru, sem cache: cada abertura de conversa refazia uma invocação
 * de edge function por mídia (~220 ms cada, medido na aba Network). Numa
 * conversa com 3 áudios eram 3 chamadas, toda vez, para gerar URLs idênticas.
 *
 * A URL assinada vale 24h (`createSignedUrl(path, 86400)` em
 * supabase/functions/get-media-url), então guardar por 12h é folgado: mesmo
 * uma sessão muito longa renova antes de expirar. Se ainda assim vencer, a
 * mídia falha ao carregar e o componente cai no fallback de URL pública que
 * já existia.
 *
 * ponytail: Map em memória, some no reload. Se um dia precisar sobreviver ao
 * refresh, sessionStorage cobre — mas aí lembre que URL assinada é credencial.
 */
const TTL_MS = 12 * 60 * 60 * 1000;

const cache = new Map<string, { url: string; gravadoEm: number }>();
const emVoo = new Map<string, Promise<string | null>>();

export async function getSignedMediaUrl(
  mediaPath: string,
  mediaType: "audio" | "image" | "video" | "document",
): Promise<string | null> {
  const chave = `${mediaType}:${mediaPath}`;

  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.gravadoEm < TTL_MS) return guardado.url;

  // Deduplica chamadas simultâneas para a mesma mídia — sem isto, três
  // componentes montando juntos disparariam três invocações iguais.
  const jaPedido = emVoo.get(chave);
  if (jaPedido) return jaPedido;

  const pedido = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-media-url", {
        body: { mediaPath: mediaPath.trim(), mediaType },
      });
      if (error || !data?.signedUrl) return null;
      cache.set(chave, { url: data.signedUrl, gravadoEm: Date.now() });
      return data.signedUrl as string;
    } finally {
      emVoo.delete(chave);
    }
  })();

  emVoo.set(chave, pedido);
  return pedido;
}
