// "Anything else you know?" on the step-by-step phone check: the person's words read on this device only. Firebase AI
// Logic with ONLY_ON_DEVICE runs Chrome's built-in Gemini Nano, so nothing is sent; there is no App Check and no cloud
// model here on purpose. Where Gemini Nano is not ready, Spare Key's keyword reader (shared/told.js) reads the words.
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { firebaseConfig } from '../../extension/src/firebase-config.js';
import { TOLD_SYSTEM, TOLD_SCHEMA, TOLD_MAX_CHARS, keywordTold, cleanTold } from '../../shared/told.js';

const TEXT_ONLY = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
let ai = null;

async function nanoReady() {
  try { return 'LanguageModel' in self && (await self.LanguageModel.availability(TEXT_ONLY)) === 'available'; } catch { return false; }
}

/** Returns { answer, how: 'nano' | 'reader' }. Never throws, and never sends the words anywhere. */
export async function readTold(text) {
  const words = String(text || '').slice(0, TOLD_MAX_CHARS);
  if (!words.trim()) return { answer: cleanTold({}), how: 'reader' };
  if (await nanoReady()) {
    try {
      ai ||= getAI(initializeApp(firebaseConfig, 'told-on-device'), { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_ON_DEVICE,
        onDeviceParams: {
          createOptions: { ...TEXT_ONLY, initialPrompts: [{ role: 'system', content: [{ type: 'text', value: TOLD_SYSTEM }] }] },
          promptOptions: { responseConstraint: TOLD_SCHEMA },
        },
      });
      const r = await Promise.race([model.generateContent(words), new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 60000))]);
      return { answer: cleanTold(JSON.parse(r.response.text())), how: 'nano' };
    } catch { /* falls back to the keyword reader below */ }
  }
  return { answer: cleanTold(keywordTold(words)), how: 'reader' };
}
