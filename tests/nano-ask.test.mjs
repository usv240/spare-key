// ask_device answered by Gemini Nano when the code rules cannot tell (extension/src/classify.js nanoAnswer): the answer
// is always one of three words, whatever Nano returns or however it fails, and only known questions are asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_ASK_WORDS, DEVICE_ASK_SCHEMA } from '../extension/src/classify.js';
import { DEVICE_QUESTIONS } from '../extension/src/cloud/plan.js';

test('every question the cloud may ask has words for Gemini Nano', () => {
  for (const q of DEVICE_QUESTIONS) assert.ok(DEVICE_ASK_WORDS[q], q);
});

test('Gemini Nano can only answer yes, no or unknown', () => {
  assert.deepEqual(DEVICE_ASK_SCHEMA.properties.answer.enum, ['yes', 'no', 'unknown']);
  assert.deepEqual(DEVICE_ASK_SCHEMA.required, ['answer']);
});

test('the question words hold nothing about the person', () => {
  for (const w of Object.values(DEVICE_ASK_WORDS)) assert.ok(!/@|\d{3}/.test(w), w);
});
