import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA_URL = new URL('../src/_data/reviews.json', import.meta.url);

export function formatRating(n) {
  return Number(n).toFixed(1);
}

export function decide(current, api, today) {
  const count = api?.userRatingCount;
  const rating = api?.rating;
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return { action: 'reject', reason: 'count inválido' };
  }
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0 || rating > 5) {
    return { action: 'reject', reason: 'rating inválido' };
  }
  if (count < current.count) {
    return { action: 'reject', reason: `count cayó ${current.count}->${count}` };
  }
  const next = { rating: formatRating(rating), count, updated: today ?? current.updated };
  if (next.rating === current.rating && next.count === current.count) {
    return { action: 'nochange' };
  }
  return { action: 'update', next };
}

async function fetchPlace(placeId, apiKey) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount',
    },
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const apiKey = process.env.PLACES_API_KEY;
  const placeId = process.env.PLACE_ID;
  if (!apiKey || !placeId) throw new Error('Falta PLACES_API_KEY o PLACE_ID');

  const current = JSON.parse(readFileSync(DATA_URL, 'utf8'));
  const api = await fetchPlace(placeId, apiKey);
  const today = new Date().toISOString().slice(0, 10);
  const d = decide(current, api, today);

  console.log(
    `API: count=${api.userRatingCount} rating=${api.rating} → ${d.action}${d.reason ? ' (' + d.reason + ')' : ''}`
  );
  if (d.action === 'update') {
    writeFileSync(DATA_URL, JSON.stringify(d.next, null, 2) + '\n');
    console.log('reviews.json actualizado:', d.next);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
