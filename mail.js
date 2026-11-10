// שליחת מייל עם קובץ מצורף. אם מוגדר BREVO_API_KEY משתמשים בברבו, אחרת ב-SMTP
import nodemailer from 'nodemailer';

const smtp = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

export async function sendMail({ to, subject, text, attachments = [] }) {
  const from = process.env.MAIL_FROM;
  if (process.env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        ...(attachments.length ? {
          attachment: attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') }))
        } : {})
      })
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  if (!smtp) throw new Error('לא הוגדר שרת מייל (BREVO_API_KEY או SMTP_HOST)');
  await smtp.sendMail({ from, to, subject, text, attachments });
}
