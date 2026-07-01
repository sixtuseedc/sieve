// /api/fulfill.js
// Core lead-generation pipeline, called automatically by the webhook.
// industry + region in -> a CSV of real businesses + real emails out.
//
// Step 1: Google Places Text Search finds real businesses matching the industry/region.
// Step 2: Hunter.io Domain Search finds a real email at each business's website domain.
// Both have free tiers — see README for the exact limits.

const PLACES_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACE_DETAILS_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';
const HUNTER_ENDPOINT = 'https://api.hunter.io/v2/domain-search';

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function findBusinesses(industry, region, limit) {
  const query = `${industry} ${region || ''}`.trim();
  const url = `${PLACES_ENDPOINT}?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status} ${data.error_message || ''}`);
  }

  const results = (data.results || []).slice(0, limit);

  const withWebsites = await Promise.all(
    results.map(async (place) => {
      const detailUrl = `${PLACE_DETAILS_ENDPOINT}?place_id=${place.place_id}&fields=name,website&key=${process.env.GOOGLE_PLACES_API_KEY}`;
      const detailRes = await fetch(detailUrl);
      const detailData = await detailRes.json();
      return {
        name: place.name,
        website: detailData.result?.website || null,
      };
    })
  );

  return withWebsites.filter((b) => b.website);
}

async function findEmailForDomain(domain) {
  const url = `${HUNTER_ENDPOINT}?domain=${domain}&limit=1&api_key=${process.env.HUNTER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.errors) return null; // quota hit, bad domain, etc. — skip gracefully
  const email = data.data?.emails?.[0]?.value;
  return email || null;
}

// Returns { rows, quotaHit, requested, found }
export async function generateLeadList(industry, region, targetCount) {
  // Cap how many Places lookups we attempt — keeps this inside the free tier
  // even if someone orders the 1,000-lead plan; see README for what that means.
  const searchCap = Math.min(targetCount, 60);
  const businesses = await findBusinesses(industry, region, searchCap);

  const rows = [];

  for (const biz of businesses) {
    if (rows.length >= targetCount) break;
    const domain = domainFromUrl(biz.website);
    if (!domain) continue;

    const email = await findEmailForDomain(domain);
    if (!email) continue; // no email found at this domain, or quota hit — skip and keep going

    rows.push({ business: biz.name, domain, email });
  }

  return { rows, requested: targetCount, found: rows.length, quotaHit: rows.length === 0 };
}

export function toCsv(rows) {
  const header = 'business,domain,email\n';
  const body = rows
    .map((r) => `"${r.business.replace(/"/g, '""')}","${r.domain}","${r.email}"`)
    .join('\n');
  return header + body;
}
