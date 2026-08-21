// supabase/functions/send-push/index.ts
// Sends web-push notifications to a user's devices.
// Deploy: supabase functions deploy send-push
// Secrets: supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:...
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });

    const { userId, title, body, url, tag } = await req.json();
    if (!userId || !title) return new Response(JSON.stringify({ error: 'userId and title required' }), { status: 400, headers: cors });

    // Create Supabase admin client to read subscriptions
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subs, error } = await sbAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { headers: cors });
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '/geogive/', tag: tag || 'geogive' });
    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(sub.endpoint);
      }
    }

    // Clean up dead endpoints
    for (const endpoint of stale) {
      await sbAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }

    return new Response(JSON.stringify({ sent, removed: stale.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
