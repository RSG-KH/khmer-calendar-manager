import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWorkspace } from '../src/workspace.ts';

const knowledgeFile = JSON.parse(await readFile('data/knowledge.json', 'utf8')) as { provenance: { note: string }, entries: Array<{
  id: string; category: string; name_km: string; name_en: string; summary_km: string; summary_en: string;
}> };
const knowledge = knowledgeFile.entries;
const workspace = validateWorkspace(JSON.parse(await readFile('data/workspace.json', 'utf8')));
const catalogIds = new Set(workspace.data.events.map(e => e.id));
const categories = new Set(['global_observance', 'national_history', 'cultural', 'royal', 'unesco', 'lunar_buddhist', 'milestone']);

test('knowledge carries provenance', () => {
  assert.match(knowledgeFile.provenance.note, /Gemini 3.8 Flash Extended.*GPT5.6 Sol High.*2026-09-22/);
});

test('knowledge entries reference catalog events one-to-one', () => {
  assert.equal(knowledge.length, workspace.data.events.length, 'the knowledge file must cover every catalog event');
  assert.equal(new Set(knowledge.map(e => e.id)).size, knowledge.length, 'knowledge ids must be unique');
  for (const entry of knowledge) assert.ok(catalogIds.has(entry.id), `unknown knowledge id ${entry.id}`);
  for (const id of catalogIds) assert.ok(knowledge.some(e => e.id === id), `catalog event ${id} has no knowledge entry`);
});

test('knowledge entries are complete and well-formed', () => {
  for (const entry of knowledge) {
    assert.ok(categories.has(entry.category), `${entry.id}: unknown category ${entry.category}`);
    for (const field of ['name_km', 'name_en', 'summary_km', 'summary_en'] as const) {
      assert.ok(typeof entry[field] === 'string' && entry[field].trim().length > 0, `${entry.id}: ${field} is empty`);
    }
  }
});
