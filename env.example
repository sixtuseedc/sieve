// /api/webhook.js
// Stripe calls this automatically on payment events. On a successful payment
// (one-time, or each subscription renewal) this runs the lead-gen pipeline
// and emails the finished CSV straight to the buyer. You only get an email
// if something needs your attention (quota exhausted, an error).

import Stripe from 'stripe';
import { Resend } from 'resend';
import { generateLeadList, toCsv } from './fulfill.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const PLAN_VOLUMES = {
  'one-100': 100,
  'one-500': 500,
  'one-1000': 1000,
  'weekly-50': 50,
  'monthly-200': 200,
  'monthly-500': 500,
};

async function fulfillOrder({ plan, industry, region, buyerEmail }) {
  const targetCount = PLAN_VOLUMES[plan] || 25;

  let result;
  try {
    result = await generateLeadList(industry, region, targetCount);
  } catch (err) {
    console.error('Lead generation failed:', err);
    await notifyOwner(
      `Lead gen FAILED for ${buyerEmail} (${plan}, "${industry}")`,
      `Error: ${err.message}\n\nThis order needs manual fulfillment — the data APIs returned an error.`
    );
    return;
  }

  if (result.quotaHit || result.found === 0) {
    await notifyOwner(
      `Lead gen returned 0 results for ${buyerEmail} (${plan}, "${industry}")`,
      `Requested: ${result.requested}. Found: 0.\n\nThis usually means the free API quota (Hunter.io: 25/month, or Google Places monthly credit) is exhausted, or the industry/region was too narrow. Needs manual fulfillment or a quota top-up.`
    );
    return;
  }

  const csv = toCsv(result.rows);
  const shortOfTarget = result.found < result.requested;

  await resend.emails.send({
    from: 'orders@yourdomain.com', // must be a domain verified in Resend
    to: buyerEmail,
    subject: `Your Sieve lead list: ${industry}`,
    text: shortOfTarget
      ? `Attached are ${result.found} verified leads for "${industry}"${region ? ' in ' + region : ''}. We came in under the ${result.requested} requested because that's everything available from free, real-time business data right now — no padded or fake rows.`
      : `Attached are your ${result.found} leads for "${industry}"${region ? ' in ' + region : ''}.`,
    attachments: [
      { filename: 'leads.csv', content: Buffer.from(csv).toString('base64') },
    ],
  });

  if (shortOfTarget) {
    await notifyOwner(
      `Order delivered short: ${result.found}/${result.requested} for ${buyerEmail}`,
      `Plan: ${plan}\nIndustry: ${industry}\nDelivered ${result.found} of ${result.requested} — likely hit the free API quota. No action needed unless this keeps happening, in which case it's time to upgrade the Hunter.io plan.`
    );
  }
}

async function notifyOwner(subject, text) {
  try {
    await resend.emails.send({
      from: 'orders@yourdomain.com',
      to: process.env.OWNER_EMAIL,
      subject: `[Sieve] ${subject}`,
      text,
    });
  } catch (err) {
    console.error('Owner notification failed:', err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // One-time payments fulfill here.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { plan, industry, region, mode } = session.metadata || {};
    const buyerEmail = session.customer_details?.email || session.customer_email;

    if (mode === 'payment') {
      await fulfillOrder({ plan, industry, region, buyerEmail });
    }
    // Subscription mode: the first payment is handled by invoice.paid below
    // too, so we deliberately skip fulfilling here to avoid sending twice.
  }

  // Subscriptions fulfill here — fires on signup AND every renewal, which is
  // what makes "50 leads every week" actually arrive every week with zero
  // manual steps from you.
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const { plan, industry, region } = subscription.metadata || {};
      const buyerEmail = invoice.customer_email;
      if (plan && industry && buyerEmail) {
        await fulfillOrder({ plan, industry, region, buyerEmail });
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    console.log('Subscription cancelled:', event.data.object.id);
  }

  return res.status(200).json({ received: true });
}
