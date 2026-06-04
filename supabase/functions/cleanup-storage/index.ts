import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKETS    = ['media-mensagens', 'audio-mensagens'];
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  try {
    const body    = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const daysOld: number  = body.days_old ?? 30;
    const dryRun: boolean  = body.dry_run  ?? false;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const cutoffIso = cutoff.toISOString();

    const summary: Record<string, { found: number; deleted: number; freed_bytes: number }> = {};

    for (const bucket of BUCKETS) {
      let totalFound = 0, totalDeleted = 0, totalBytes = 0, offset = 0;

      while (true) {
        const { data: objects, error } = await supabaseAdmin.rpc('get_old_storage_objects', {
          p_bucket: bucket,
          p_cutoff: cutoffIso,
          p_limit:  BATCH_SIZE,
          p_offset: offset,
        });

        if (error) { console.error(`[cleanup] RPC error em ${bucket}:`, error); break; }
        if (!objects || objects.length === 0) break;

        totalFound += objects.length;
        const names  = objects.map((o: any) => o.obj_name as string);
        const bytes  = objects.reduce((acc: number, o: any) => acc + (Number(o.size_bytes) || 0), 0);
        totalBytes  += bytes;

        if (!dryRun && names.length > 0) {
          const { error: delErr } = await supabaseAdmin.storage.from(bucket).remove(names);
          if (delErr) {
            console.error(`[cleanup] Erro ao deletar em ${bucket}:`, delErr);
          } else {
            totalDeleted += names.length;
          }
        }

        offset += BATCH_SIZE;
        if (objects.length < BATCH_SIZE) break;
      }

      summary[bucket] = { found: totalFound, deleted: dryRun ? 0 : totalDeleted, freed_bytes: totalBytes };
    }

    const totalFreed = Object.values(summary).reduce((a, s) => a + s.freed_bytes, 0);
    const totalFiles = Object.values(summary).reduce((a, s) => a + s.found, 0);

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun, days_old: daysOld, cutoff: cutoffIso,
      summary, total_files: totalFiles,
      total_freed_mb: (totalFreed / 1024 / 1024).toFixed(1),
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
