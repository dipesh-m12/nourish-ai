import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportFinding } from '../src/db/schema';
import {
  markerTrends,
  prioritiesFrom,
  priorityTip,
} from '../src/services/priorities/priorities.rules';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 15, 12);
const ironLow: ReportFinding = {
  marker: 'Serum Ferritin',
  value: '8.5',
  unit: 'ng/mL',
  flag: 'low',
  area: 'iron',
};
const sugarHigh: ReportFinding = {
  marker: 'HbA1c',
  value: '6.1',
  unit: '%',
  flag: 'high',
  area: 'sugar',
};

describe('priorities from what the user told us', () => {
  it('keeps recent focuses newest first, without repeats, and lets old asks fade', () => {
    const p = prioritiesFrom(
      [
        { focus: 'Knee pain on stairs', findings: [], at: NOW - 2 * DAY },
        { focus: 'knee pain on stairs', findings: [], at: NOW - 5 * DAY },
        { focus: 'evening snacking', findings: [], at: NOW - 1 * DAY },
        { focus: 'sleep', findings: [], at: NOW - 60 * DAY },
      ],
      NOW,
    );
    assert.deepEqual(p.focuses, ['evening snacking', 'knee pain on stairs']);
  });

  it('a newer report replaces an older finding in the same area', () => {
    const older = { ...ironLow, value: '6.0' };
    const p = prioritiesFrom(
      [
        { focus: null, findings: [older], at: NOW - 40 * DAY },
        { focus: null, findings: [ironLow], at: NOW - 3 * DAY },
      ],
      NOW,
    );
    assert.equal(p.findings.length, 1);
    assert.equal(p.findings[0]!.value, '8.5');
  });
});

describe('the report-led tip', () => {
  const base = { diet: 'veg', allergies: [] as string[], foods: [] as string[] };

  it('suggests diet-safe iron foods at a meal hour', () => {
    const tip = priorityTip({ ...base, hour: 13, findings: [ironLow] });
    assert.equal(tip?.area, 'iron');
    assert.match(tip!.headline, /palak|rajma/);
    assert.doesNotMatch(tip!.headline, /chicken|egg/i);
    assert.match(tip!.feel, /tired/);
  });

  it('goes quiet once today’s meals already cover it', () => {
    assert.equal(
      priorityTip({ ...base, hour: 13, findings: [ironLow], foods: ['Rajma chawal'] }),
      null,
    );
  });

  it('not outside meal hours', () => {
    assert.equal(priorityTip({ ...base, hour: 9, findings: [ironLow] }), null);
  });

  it('high sugar: a walk after dinner, only in the evening', () => {
    assert.equal(priorityTip({ ...base, hour: 20, findings: [sugarHigh] })?.area, 'sugar');
    assert.equal(priorityTip({ ...base, hour: 15, findings: [sugarHigh] }), null);
  });

  it('respects allergies when picking foods', () => {
    const b12: ReportFinding = { ...ironLow, area: 'b12', marker: 'Vitamin B12' };
    const tip = priorityTip({ ...base, hour: 13, findings: [b12], allergies: ['dairy'] });
    // Every veg B12 food is dairy: no safe suggestion means no tip, not a wrong one.
    assert.equal(tip, null);
  });
});

describe('report markers over time', () => {
  const ironOk: ReportFinding = { ...ironLow, value: '42', flag: 'normal' };

  it('a newer in-range report ends the priority', () => {
    const p = prioritiesFrom(
      [
        { focus: null, findings: [ironLow], at: NOW - 60 * DAY },
        { focus: null, findings: [ironOk], at: NOW - 1 * DAY },
      ],
      NOW,
    );
    assert.deepEqual(p.findings, []);
  });

  it('shows back-in-range as better, a first report as new, and skips untested areas', () => {
    const rows = markerTrends([
      { focus: null, findings: [ironLow, sugarHigh], at: NOW - 60 * DAY },
      { focus: null, findings: [ironOk], at: NOW - 1 * DAY },
      { focus: 'tired', findings: [], at: NOW },
    ]);
    assert.deepEqual(
      rows.map((r) => [r.area, r.before, r.now, r.trend]),
      [
        ['iron', 'low', 'normal', 'better'],
        ['sugar', null, 'high', 'new'],
      ],
    );
  });

  it('an out-of-range marker wins over an in-range one from the same report', () => {
    const hb: ReportFinding = { ...ironOk, marker: 'Haemoglobin' };
    const [row] = markerTrends([{ focus: null, findings: [hb, ironLow], at: NOW }]);
    assert.equal(row!.now, 'low');
  });
});
