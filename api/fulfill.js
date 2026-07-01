// /api/checkout.js
// Creates a Stripe Checkout session for the selected plan and returns the URL
// to redirect the customer to. No card data ever touches this server —
// Stripe hosts the actual payment page.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  'one-100':      { name: '100 leads (one-time)',  amount: 500,  mode: 'payment' },
  'one-500':      { name: '500 leads (one-time)',  amount: 1800, mode: 'payment' },
  'one-1000':     { name: '1,000 leads (one-time)', amount: 3000, mode: 'payment' },
  'weekly-50':    { name: '50 leads / week',        amount: 900,  mode: 'subscription', interval: 'month' },
  'monthly-200':  { name: '200 leads / month',      amount: 1500, mode: 'subscription', interval: 'month' },
  'monthly-500':  { name: '500 leads / month',      amount: 2900, mode: 'subscription', interval: 'month' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, industry, region, email } = req.body;
    const planConfig = PLANS[plan];

    if (!planConfig) return res.status(400).json({ error: 'Unknown plan' });
    if (!industry || !email) {
      return res.status(400).json({ error: 'Industry and email are required' });
    }

    const lineItem = {
      price_data: {
        currency: 'usd',
        product_data: { name: `Sieve — ${planConfig.name}` },
        unit_amount: planConfig.amount,
        ...(planConfig.mode === 'subscription'
          ? { recurring: { interval: planConfig.interval } }
          : {}),
      },
      quantity: 1,
    };

    const metadata = { plan, industry, region: region || '', mode: planConfig.mode };

    const session = await stripe.checkout.sessions.create({
      mode: planConfig.mode,
      payment_method_types: ['card'],
      line_items: [lineItem],
      customer_email: email,
      metadata,
      // For subscriptions, metadata also has to be attached to the
      // subscription object itself — checkout session metadata alone
      // doesn't carry over to renewal invoices, which is how the webhook
      // knows what to fulfill on every recurring billing cycle.
      ...(planConfig.mode === 'subscription'
        ? { subscription_data: { metadata } }
        : {}),
      success_url: `${process.env.SITE_URL}/?order=success`,
      cancel_url: `${process.env.SITE_URL}/?order=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
