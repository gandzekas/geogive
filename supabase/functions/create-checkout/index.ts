// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for promoted listings or Pro subscription.
// Deploy: supabase functions deploy create-checkout
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... SITE_URL=https://gandzekas.github.io/geogive/
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://gandzekas.github.io/geogive/';
const STRIPE_API = 'https://api.stripe.com/v1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripeForm(params: Record<string, string>): Promise<RequestInit> {
  const body = new URLSearchParams(params).toString();
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { productId, userId, userEmail, itemId } = await req.json();

    // Price catalog (EUR cents)
    const PRICES: Record<string, { amount: number; name: string; mode: string }> = {
      'promote_24h': { amount: 99, name: 'Boost listing — 24h top placement', mode: 'payment' },
      'pro_monthly': { amount: 299, name: 'GeoGive Pro — monthly', mode: 'subscription' },
    };
    const price = PRICES[productId];
    if (!price) return new Response(JSON.stringify({ error: 'unknown product' }), { status: 400, headers: cors });

    const params: Record<string, string> = {
      mode: price.mode,
      success_url: `${SITE_URL}?checkout=success&product=${productId}${itemId ? '&item=' + itemId : ''}`,
      cancel_url: `${SITE_URL}?checkout=cancelled`,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(price.amount),
      'line_items[0][price_data][product_data][name]': price.name,
      client_reference_id: userId,
      'metadata[user_id]': userId,
      'metadata[product]': productId,
    };
    if (itemId) params['metadata[item_id]'] = itemId;
    if (price.mode === 'subscription') {
      params['line_items[0][price_data][recurring][interval]'] = 'month';
    }
    if (userEmail) params['customer_email'] = userEmail;

    const resp = await fetch(`${STRIPE_API}/checkout/sessions`, await stripeForm(params));
    const session = await resp.json();
    if (!resp.ok) throw new Error(session?.error?.message || 'stripe error');

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
