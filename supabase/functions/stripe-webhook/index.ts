// supabase/functions/stripe-webhook/index.ts
// Fulfills promotions and Pro entitlements after successful payment.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, p) => {
    const [k, v] = p.split('=');
    acc[k.trim()] = v;
    return acc;
  }, {});
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === signature;
}

serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  if (!(await verifyStripeSignature(payload, sig, WEBHOOK_SECRET))) {
    return new Response('invalid signature', { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true, ignored: event.type }));
  }

  const session = event.data.object;
  const userId = session.metadata?.user_id;
  const product = session.metadata?.product;
  const itemId = session.metadata?.item_id;
  if (!userId || !product) return new Response(JSON.stringify({ received: true }));

  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (product === 'promote_24h' && itemId) {
    await sbAdmin.from('item_promotions').insert({
      item_id: itemId,
      user_id: userId,
      promoted_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      payment_id: session.payment_intent || session.id,
    });
  } else if (product === 'pro_monthly') {
    await sbAdmin.from('profiles').update({ is_pro: true }).eq('id', userId);
  }

  return new Response(JSON.stringify({ fulfilled: true }));
});
