import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHoroscope,
  calculateHoroscopeUtc,
  WesternZodiacSign,
  AscendantStatus
} from 'khmer-calendar-engine';

test('Western horoscope calculates Big 3 and angles with bilingual Khmer/English signs', () => {
  // Test 12 signs coverage and bilingual names
  const signs = WesternZodiacSign.values();
  assert.equal(signs.length, 12);
  const expectedSigns = [
    { index: 0, symbol: '♈', en: 'Aries', km: 'មេស', element: 'Fire' },
    { index: 1, symbol: '♉', en: 'Taurus', km: 'ឧសភ', element: 'Earth' },
    { index: 2, symbol: '♊', en: 'Gemini', km: 'មេថុន', element: 'Air' },
    { index: 3, symbol: '♋', en: 'Cancer', km: 'កក្កដា', element: 'Water' },
    { index: 4, symbol: '♌', en: 'Leo', km: 'សីហ', element: 'Fire' },
    { index: 5, symbol: '♍', en: 'Virgo', km: 'កញ្ញា', element: 'Earth' },
    { index: 6, symbol: '♎', en: 'Libra', km: 'តុលា', element: 'Air' },
    { index: 7, symbol: '♏', en: 'Scorpio', km: 'វិច្ឆិកា', element: 'Water' },
    { index: 8, symbol: '♐', en: 'Sagittarius', km: 'ធ្នូ', element: 'Fire' },
    { index: 9, symbol: '♑', en: 'Capricorn', km: 'មករ', element: 'Earth' },
    { index: 10, symbol: '♒', en: 'Aquarius', km: 'កុម្ភៈ', element: 'Air' },
    { index: 11, symbol: '♓', en: 'Pisces', km: 'មីន', element: 'Water' },
  ];

  for (let i = 0; i < 12; i++) {
    const s = signs[i];
    const exp = expectedSigns[i];
    assert.equal(s.index, exp.index);
    assert.equal(s.symbol, exp.symbol);
    assert.equal(s.englishName, exp.en);
    assert.equal(s.khmerName, exp.km);
    assert.equal(s.element, exp.element);
  }

  // Khmer New Year 2026 anchor (Phnom Penh coordinates: 11.5564° N, 104.9282° E, UTC+7)
  const chart = calculateHoroscope({
    year: 2026,
    month: 4,
    day: 14,
    hour: 10,
    minute: 30,
    second: 0,
    utcOffsetHours: 7.0,
    latitude: 11.5564,
    longitude: 104.9282,
  });

  assert.equal(chart.sun.sign.englishName, 'Aries');
  assert.equal(chart.sun.sign.khmerName, 'មេស');
  assert.equal(chart.moon.sign.englishName, 'Pisces');
  assert.equal(chart.moon.sign.khmerName, 'មីន');
  assert.ok(chart.ascendant);
  assert.equal(chart.ascendant.sign.englishName, 'Cancer');
  assert.equal(chart.ascendant.sign.khmerName, 'កក្កដា');
  assert.equal(chart.midheaven.sign.englishName, 'Pisces');
  assert.equal(chart.isPolarLatitude, false);
  assert.equal(chart.ascendantStatus, AscendantStatus.CALCULATED);

  // UTC equivalent calculation via calculateHoroscopeUtc
  const chartUtc = calculateHoroscopeUtc({
    yearUtc: 2026,
    monthUtc: 4,
    dayUtc: 14,
    hourUtc: 3,
    minuteUtc: 30,
    secondUtc: 0,
    latitude: 11.5564,
    longitude: 104.9282,
  });

  assert.equal(chartUtc.sun.formatted, chart.sun.formatted);
  assert.equal(chartUtc.moon.formatted, chart.moon.formatted);
  assert.equal(chartUtc.ascendant?.formatted, chart.ascendant?.formatted);
  assert.equal(chartUtc.midheaven.formatted, chart.midheaven.formatted);
});
