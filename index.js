// שלוחת סקיצות שירים לימות המשיח
// זרימה: מילים (הקלטה + תמלול) → סגנון → מנגינה (זמזום, אופציונלי) → מייל עם השיר
import express from 'express';
import { YemotRouter } from 'yemot-router2';
import { ym, recordAudio } from './yemot.js';
import { transcribeHebrew, describeMelody, makeSongBrief, makeSong } from './google.js';
import { getCaller, saveEmail, createSong, updateSong, songsOf } from './db.js';
import { sendMail } from './mail.js';

const STYLES = { '1': 'pop', '2': 'rock', '3': 'mizrahi', '4': 'ballad', '5': '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const app = express();
app.use(express.json());

const router = YemotRouter({
  printLog: true,
  uncaughtErrorHandler: async (err, call) => {
    console.error('CALL ERROR:', err?.message);
    try { await call.id_list_message([{ type: 'text', data: ym('אירעה תקלה, נסו שוב מאוחר יותר') }]); }
    catch (e) { console.error('ERROR HANDLER FAILED:', e.message); }
  }
});

const say = (call, text) => call.id_list_message([{ type: 'text', data: ym(text) }]);

// תפריט עם הקשה אחת. מחזיר את הספרה כמחרוזת
async function tap(call, text, digits = 1) {
  const v = await call.read([{ type: 'text', data: ym(text) }], 'tap',
    { max_digits: digits, min_digits: 1, sec_wait: 10 });
  return String(v || '').trim();
}

async function askEmail(call) {
  const v = await call.read([{ type: 'text', data: ym('הקלידו את כתובת המייל ובסיום הקישו סולמית') }], 'tap',
    { typing_playback_mode: 'EmailKeyboard', max_digits: 80, min_digits: 5, sec_wait: 30 });
  return String(v || '').trim();
}

router.get('/song', async (call) => {
  const phone = call.phone;
  console.log('CALL START', phone);
  const choice = await tap(call, 'שלום, לסקיצת שיר חדשה הקישו 1. לשמיעת רשימת השירים שלכם הקישו 2');
  if (choice === '1') await newSong(call, phone);
  else if (choice === '2') await mySongs(call, phone);
  return call.hangup();
});

async function newSong(call, phone) {
  // 1. מילים
  const lyricsBuf = await recordAudio(call, 'אחרי הצליל, הקריאו או שרו את מילות השיר. בסיום הקישו סולמית', 180);
  if (!lyricsBuf) return say(call, 'לא קלטתי הקלטה, נסו שוב');
  const lyrics = await transcribeHebrew(lyricsBuf).catch((e) => { console.error('STT', e.message); return ''; });
  if (!lyrics) return say(call, 'לא זיהיתי מילים, נסו שוב בקול ברור יותר');

  // 2. סגנון
  const style = STYLES[await tap(call, 'לפופ הקישו 1. לרוק הקישו 2. למזרחית הקישו 3. לבלדה הקישו 4. לבחירה חופשית הקישו 5')] ?? '';

  // 3. מנגינה (אופציונלי)
  let melody = '';
  if (await tap(call, 'לזמזום מנגינה הקישו 1. לדילוג הקישו 2') === '1') {
    const melodyBuf = await recordAudio(call, 'זמזמו את המנגינה. בסיום הקישו סולמית', 60);
    if (melodyBuf) melody = await describeMelody(melodyBuf).catch(() => '');
  }

  // 4. מייל. אם כבר יש כתובת שמורה, מציעים להשתמש בה
  const saved = (await getCaller(phone)).email;
  let email = saved;
  if (!saved || (await tap(call, 'להשתמש בכתובת המייל ששמורה אצלנו הקישו 1. להזנת כתובת חדשה הקישו 2')) === '2') {
    email = await askEmail(call);
    if (!EMAIL_RE.test(email)) return say(call, 'כתובת המייל לא תקינה, נסו שוב');
    await saveEmail(phone, email);
  }

  // 5. אישור והפעלה ברקע
  if (await tap(call, 'לאישור ויצירת הסקיצה הקישו 1. לביטול הקישו 2') !== '1') return say(call, 'בוטל');
  const title = lyrics.split(/\s+/).slice(0, 4).join(' ');
  const id = await createSong({ phone, title, style, lyrics, status: 'pending' });
  await say(call, 'תודה. הסקיצה בדרך למייל שלכם, זה ייקח כמה דקות');

  // ההמשך רץ אחרי ניתוק השיחה
  runSong({ id, email, lyrics, style, melody });
}

async function runSong({ id, email, lyrics, style, melody }) {
  try {
    const prompt = await makeSongBrief({ lyrics, style, melody });
    const song = await makeSong(prompt);
    const ext = song.mime.includes('wav') ? 'wav' : 'mp3';
    await sendMail({
      to: email,
      subject: 'הסקיצה שלכם מוכנה',
      text: 'שלום, מצורפת סקיצת השיר שביקשתם בשיחה טלפונית.',
      attachments: [{ filename: `song.${ext}`, content: song.buf }]
    });
    await updateSong(id, { status: 'sent', sizeBytes: song.buf.length });
    console.log('SONG SENT', id);
  } catch (e) {
    console.error('SONG FAILED', id, e.message);
    await updateSong(id, { status: 'failed', error: String(e.message).slice(0, 200) }).catch(() => {});
    await sendMail({ to: email, subject: 'לא הצלחנו ליצור את השיר', text: 'מצטערים, היצירה נכשלה. נסו שוב מאוחר יותר.' }).catch(() => {});
  }
}

async function mySongs(call, phone) {
  const list = await songsOf(phone, 5);
  if (!list.length) return say(call, 'עדיין אין שירים בחשבון שלכם');
  const text = list.map((s, i) => `שיר ${i + 1}: ${s.title}. סטטוס: ${s.status === 'sent' ? 'נשלח' : s.status === 'failed' ? 'נכשל' : 'בתהליך'}`).join('. ');
  return say(call, text);
}

app.use('/', router);
app.get('/healthz', (_q, r) => r.send('ok'));
app.listen(process.env.PORT || 8080, () => console.log('STARTED'));
