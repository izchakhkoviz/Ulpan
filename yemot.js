// כל מה שקשור לימות המשיח: ניקוי טקסט, הקלטה, הורדה ומחיקה של הקלטות
import { randomUUID } from 'node:crypto';

// ימות דוחה פיסוק בהודעות להקראה, לכן משאירים רק אותיות, ספרות ורווחים
export const ym = (t) =>
  String(t ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() || ' ';

const token = () => `${process.env.YEMOT_NUMBER}:${process.env.YEMOT_PASSWORD}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(paths) {
  // ימות שומרת את ההקלטה אחרי רגע, לכן מנסים עד 3 פעמים
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const p of paths.filter(Boolean)) {
      try {
        const url = 'https://www.call2all.co.il/ym/api/DownloadFile?' +
          new URLSearchParams({ token: token(), path: 'ivr2:' + p });
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const buf = Buffer.from(await r.arrayBuffer());
        // תשובת שגיאה של ימות מתחילה ב-"{" ולכן לא נחשבת קובץ
        if (r.ok && buf.length > 200 && buf[0] !== 0x7b) return { buf, path: p };
        console.error('DOWNLOAD not a file', p, r.status, buf.length);
      } catch (e) {
        console.error('DOWNLOAD failed', p, e.message);
      }
    }
    await sleep(1500);
  }
  return null;
}

async function remove(path) {
  try {
    const url = 'https://www.call2all.co.il/ym/api/FileAction?' +
      new URLSearchParams({ token: token(), action: 'delete', what: 'ivr2:' + path });
    await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (e) { /* לא קריטי */ }
}

// מקליט את המתקשר, מוריד את הקובץ ומחזיר Buffer של WAV, או null אם לא נקלט כלום
export async function recordAudio(call, text, maxSeconds = 60) {
  const fname = `rec_${randomUUID().slice(0, 8)}`;
  const rec = await call.read(
    [{ type: 'text', data: ym(text) }],
    'record',
    { path: '/ApiRecords', file_name: fname, no_confirm_menu: true,
      max_length: maxSeconds, min_length: 1, quiet_max: 4 }
  );
  const fromReply = typeof rec === 'string' ? (rec.startsWith('/') ? rec : '/' + rec) : '';
  const got = await download([`/ApiRecords/${fname}.wav`, fromReply]);
  if (!got) return null;
  remove(got.path);
  return got.buf;
}
