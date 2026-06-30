# Sieve — Launch Guide

Everything here takes about 45 minutes total.
You do not need to write any code. Just follow the steps in order.

---

## What you need to create accounts for (all free to start)

| Service | What it does | Cost |
|---|---|---|
| GitHub | Hosts your code | Free |
| Vercel | Runs your site + backend | Free |
| Stripe | Takes payments, sends money to your bank | Free (2.9% + 30¢ per transaction) |
| Resend | Sends the lead CSV to buyers automatically | Free up to 3,000 emails/month |
| Google Cloud | Finds real businesses by industry + region | Free ($200/month credit = thousands of searches) |
| Hunter.io | Finds real emails for each business | Free (25 searches/month to start) |

---

## Step 1 — Put the code on GitHub (5 min)

1. Go to github.com → sign up or log in.
2. Click **New repository** → name it `sieve` → **Create repository**.
3. Upload every file from this zip into the repo:
   - `index.html`
   - `api/checkout.js`
   - `api/webhook.js`
   - `api/fulfill.js`
   - `package.json`
   - `.env.example`
   - `vercel.json`

---

## Step 2 — Deploy to Vercel (5 min)

1. Go to vercel.com → **Sign up with GitHub**.
2. Click **Add New Project** → pick your `sieve` repo → **Deploy**.
   It'll fail the first time because the env vars aren't set yet — that's fine.
3. Go to **Project → Settings → Environment Variables**.
   Add every line from `.env.example` with your real values (see steps 3–7 below for where to get them).
4. Once all vars are set: **Deployments → ⋯ → Redeploy**.
5. Copy your live URL — it looks like `https://sieve-yourname.vercel.app`.
   Put that in `SITE_URL`.

---

## Step 3 — Stripe (10 min)

1. Go to stripe.com → **Start now**.
2. Fill in your business name, bank account, and government ID.
   This is how Stripe knows where to send your money. It usually verifies in minutes.
3. In the Stripe Dashboard, top-left toggle: start in **Test mode** until step 8.
4. Go to **Developers → API keys** → copy the **Secret key** (`sk_test_...`).
   → Paste into Vercel env var `STRIPE_SECRET_KEY`.

---

## Step 4 — Stripe Webhook (5 min)

This is the piece that fires your fulfillment pipeline the instant someone pays.

1. In Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-site.vercel.app/api/webhook`
3. Select these two events:
   - `checkout.session.completed`
   - `invoice.paid`
4. Click **Add endpoint** → click into it → copy the **Signing secret** (`whsec_...`).
   → Paste into Vercel env var `STRIPE_WEBHOOK_SECRET`.
5. Redeploy Vercel.

---

## Step 5 — Resend (5 min)

This sends the finished lead CSV directly to each buyer automatically.

1. Go to resend.com → sign up free.
2. **Domains → Add domain** → enter the domain you own (e.g. `sieve.io`).
   Follow the DNS instructions they give you (usually just adding 2-3 DNS records in wherever you bought your domain — GoDaddy, Namecheap, etc.).
   If you don't have a domain yet, use their test sending domain while you sort one.
3. **API Keys → Create API key** → copy it.
   → Paste into Vercel env var `RESEND_API_KEY`.
4. In `webhook.js` (line 10) and `webhook.js` (both `from:` fields): replace `orders@yourdomain.com` with your verified sending address.

---

## Step 6 — Google Places API (10 min)

This finds real businesses matching the buyer's industry + region.

1. Go to console.cloud.google.com → sign in with a Google account.
2. **Create project** → name it `sieve`.
3. Go to **APIs & Services → Enable APIs** → search **Places API** → **Enable**.
4. Go to **APIs & Services → Credentials → Create Credentials → API key**.
   Copy the key.
   → Paste into Vercel env var `GOOGLE_PLACES_API_KEY`.
5. Google gives you $200/month in free credit automatically — that covers
   thousands of Places searches per month at this scale.

---

## Step 7 — Hunter.io (3 min)

This finds a real email address at each business's domain.

1. Go to hunter.io → sign up free.
2. Go to **API** in the left sidebar → copy your API key.
   → Paste into Vercel env var `HUNTER_API_KEY`.

**Free tier limit:** 25 email searches/month shared across all orders.
That means: up to 25 leads total per month for free.
The moment you start getting consistent orders, upgrade Hunter to their
Starter plan ($49/month, 1,000 searches). At that point you're generating
enough revenue that it more than pays for itself.

---

## Step 8 — Test it end-to-end (5 min)

1. Go to your live site.
2. Fill in industry = `coffee shops`, region = `New York`, your real email.
3. Pick any plan → **Request this list**.
4. On Stripe's checkout page, use test card:
   - Number: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
5. You should receive an email with a real `leads.csv` attached.
6. Check Stripe dashboard → you'll see the test payment recorded there too.

---

## Step 9 — Go live (2 min)

1. In Stripe Dashboard: flip the top-left toggle from **Test** to **Live**.
2. Copy the new **Live secret key** (`sk_live_...`).
   → Replace `STRIPE_SECRET_KEY` in Vercel with the live key.
3. Re-add the webhook endpoint under Live mode too (test and live have
   separate webhook lists in Stripe) → get the new signing secret →
   replace `STRIPE_WEBHOOK_SECRET` in Vercel.
4. Redeploy Vercel.
5. You're live. Real cards will work. Money hits your Stripe balance within
   2 business days and lands in your bank on the payout schedule you set.

---

## How the system runs without you

```
Buyer fills in industry + region + email + picks a plan
          ↓
Stripe Checkout takes their card (Stripe's servers, not yours)
          ↓
Stripe fires a webhook to /api/webhook
          ↓
webhook.js calls fulfill.js
          ↓
Google Places → finds real businesses in that industry/region
          ↓
Hunter.io → finds a real email at each business's domain
          ↓
Resend → emails the CSV straight to the buyer
          ↓
Done. You see nothing unless something breaks.
```

For subscriptions (weekly/monthly plans), Stripe fires `invoice.paid`
automatically on every billing date — so the buyer gets a fresh list
every cycle with zero action from you.

---

## The only time you'll get an email

- Hunter.io quota runs out (fix: upgrade their plan)
- Google Places API key issue (fix: check the Google Cloud console)
- An order returned 0 results for an unusual industry/region

Everything else runs on its own.

---

## Hunter.io free tier math

| Hunter tier | Cost | Monthly searches | Orders you can fill |
|---|---|---|---|
| Free | $0 | 25 | ~25 leads total |
| Starter | $49/mo | 1,000 | 1,000 leads total |
| Growth | $149/mo | 5,000 | 5,000 leads total |

At $15/month per 200-lead subscriber, you need 4 subscribers to cover the
Starter plan cost. At 10 subscribers you're clearing ~$100/month profit
with zero ongoing work.

---

## Questions?
The code is self-contained — every file has comments explaining exactly what
it does and why. If anything breaks, Vercel's logs (Project → Deployments →
click a deployment → Functions) will show the exact error.
