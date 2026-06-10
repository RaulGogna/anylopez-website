import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRating, decide } from './update-reviews.mjs';

test('formatRating añade 1 decimal', () => {
  assert.equal(formatRating(5), '5.0');
  assert.equal(formatRating(4.9), '4.9');
  assert.equal(formatRating(4), '4.0');
});

const current = { rating: '5.0', count: 220, updated: '2026-06-10' };

test('decide: rechaza count nulo/invalido', () => {
  assert.equal(decide(current, { rating: 5 }).action, 'reject');
  assert.equal(decide(current, { rating: 5, userRatingCount: 0 }).action, 'reject');
});

test('decide: rechaza rating fuera de rango', () => {
  assert.equal(decide(current, { rating: 9, userRatingCount: 230 }).action, 'reject');
});

test('decide: rechaza caída de count (dato corrupto)', () => {
  assert.equal(decide(current, { rating: 5, userRatingCount: 210 }).action, 'reject');
});

test('decide: nochange si igual', () => {
  assert.equal(decide(current, { rating: 5, userRatingCount: 220 }).action, 'nochange');
});

test('decide: update si crece el count', () => {
  const d = decide(current, { rating: 5, userRatingCount: 225 }, '2026-06-11');
  assert.equal(d.action, 'update');
  assert.equal(d.next.count, 225);
  assert.equal(d.next.rating, '5.0');
  assert.equal(d.next.updated, '2026-06-11');
});
