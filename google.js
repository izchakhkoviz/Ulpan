// Google Cloud בלבד: Vertex AI (Gemini ו-Lyria) ו-Speech-to-Text.
// לא משתמשים ב-GEMINI_API_KEY, כי הוא מפנה ל-AI Studio ולא לקרדיט של Cloud.
import { GoogleGenAI } from '@google/genai';
import speech from '@google-cloud/speech';

const project = process.env.GOOGLE_CLOUD_PROJECT;
if (!project) throw new Error('חסר GOOGLE_CLOUD_PROJECT');
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

// על Cloud Run ההרשאות נלקחות אוטומטית מחשבון השירות של השירות
const ai = new GoogleGenAI({ vertexai: true, project, location });
const aiGlobal = new GoogleGenAI({ vertexai: true, project, location: 'global' });

export const MODELS = {
  text: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  music: process.env.LYRIA_MODEL || 'lyria-3-pro-preview'
};

// אם המודל לא נמצא באזור, מנסים שוב באזור הכללי
async function generate(params) {
  try {
    return await ai.models.generateContent(params);
  } catch (e) {
    if (!/404|NOT_FOUND|not found/i.test(String(e?.message))) throw e;
    console.error('MODEL NOT FOUND in region, retrying global:', params.model);
    return await aiGlobal.models.generateContent(params);
  }
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms)), ms))]);

// ---------- תמלול עברית ----------
const SPEECH_LOCATION = process.env.SPEECH_LOCATION || 'us';
const speechClient = new speech.v2.SpeechClient({
  apiEndpoint: SPEECH_LOCATION === 'global'
    ? 'speech.googleapis.com'
    : `${SPEECH_LOCATION}-speech.googleapis.com`
});

export async function transcribeHebrew(buf) {
  const [resp] = await withTimeout(speechClient.recognize({
    recognizer: `projects/${project}/locations/${SPEECH_LOCATION}/recognizers/_`,
    config: {
      autoDecodingConfig: {},
      model: process.env.SPEECH_MODEL || 'chirp_3',
      languageCodes: ['he-IL']
    },
    content: buf
  }), 30000);
  return (resp.results || []).map((r) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
}

// ---------- תיאור מנגינה מהזמזום (Gemini מקשיב לאודיו) ----------
export async function describeMelody(wavBuf) {
  const r = await withTimeout(generate({
    model: MODELS.text,
    contents: [
      { inlineData: { mimeType: 'audio/wav', data: wavBuf.toString('base64') } },
      { text: 'Describe the melody in this recording in English in 2-3 sentences: tempo, mood, rhythm, and how the pitch moves up and down. Do not transcribe any words.' }
    ]
  }), 60000);
  return (r.text || '').trim();
}

// ---------- כתיבת הנחיה מלאה לשיר ----------
export async function makeSongBrief({ lyrics, style, melody }) {
  const r = await withTimeout(generate({
    model: MODELS.text,
    contents: [
      'כתוב הנחיה לשיר. החזר JSON בלבד במבנה {"caption":"...","lyrics":"..."}.',
      'caption: תיאור קצר באנגלית של הז׳אנר, כלי הנגינה, מצב הרוח והקול.',
      'lyrics: מילות השיר בעברית, בדיוק כפי שהמתקשר אמר, עם בתים ופזמון. בלי הוראות במה.',
      style ? `סגנון שהמתקשר ביקש: ${style}` : '',
      melody ? `תיאור המנגינה שהמתקשר זמזם: ${melody}` : '',
      `מילים: ${lyrics}`
    ].filter(Boolean).join('\n'),
    config: { temperature: 0.7, responseMimeType: 'application/json' }
  }), 40000);
  let j = {};
  try { j = JSON.parse(r.text || '{}'); } catch (e) { /* נשתמש בברירת מחדל */ }
  const caption = String(j.caption || style || 'pop, vocals').slice(0, 300);
  const finalLyrics = String(j.lyrics || lyrics).slice(0, 3000);
  return `${caption}. Sung in Hebrew.\nLyrics:\n${finalLyrics}`;
}

// ---------- יצירת השיר עם Lyria ----------
export async function makeSong(prompt) {
  const r = await withTimeout(generate({
    model: MODELS.music,
    contents: `Create a complete song with sung vocals and lyrics, with a clear intro and a proper ending. ${prompt}`,
    config: { responseModalities: ['AUDIO', 'TEXT'] }
  }), 300000);
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error('Lyria לא החזיר שמע');
  return { buf: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'audio/mpeg' };
}
