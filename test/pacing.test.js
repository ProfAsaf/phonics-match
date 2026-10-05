// The pace of the whole curriculum: a simulated child who gets about nine in ten right finishes every
// step, through level 7's endings and two-syllable words, within a school year of daily matches.
// Run: npm test   (this one takes about half a minute)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, season, PROFILES } from '../tools/pacing.mjs';

test('the whole curriculum fits a school year at a steady pace, about a week per step', () => {
  const C = loadIndex();
  const r = season(C, PROFILES.steady);
  assert.ok(r.finished, `finished every step (stopped at ${r.P.step})`);
  assert.ok(r.days <= 170, `${r.days} matches; a school year from October to June is about 170 school days`);
  const perStep = C.steps.map((s, i) => (r.firstDay[C.steps[i + 1]?.step] ?? r.days) - r.firstDay[s.step]);
  assert.ok(Math.max(...perStep) <= 15, `no step takes more than three weeks of matches (${perStep.join(', ')})`);
  assert.equal(r.P.levelChecks.filter(c => c.pass).length, 6, 'a level check passed at the end of each of levels 1 to 6');
});
