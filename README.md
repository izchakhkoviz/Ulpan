# שלוחת סקיצות שירים בימות המשיח

## 1. פרויקט Google Cloud
1. ליצור פרויקט: https://console.cloud.google.com/projectcreate
2. לקשר אותו לחשבון החיוב עם הקרדיט: https://console.cloud.google.com/billing
3. להגדיר תקציב והתראה, למשל 900 ש"ח: https://console.cloud.google.com/billing/budgets
4. להפעיל את ה-APIs: https://console.cloud.google.com/apis/library
   - Vertex AI API
   - Cloud Speech-to-Text API
   - Cloud Firestore API
   - Cloud Run Admin API

## 2. Firestore
1. ליצור מסד נתונים (Native mode): https://console.cloud.google.com/firestore
2. להשאיר את שם המסד ריק, כלומר (default).

## 3. הרשאות לחשבון השירות של Cloud Run
בדף https://console.cloud.google.com/iam-admin/iam להוסיף לחשבון `PROJECT_NUMBER-compute@developer.gserviceaccount.com` את התפקידים:
- Vertex AI User
- Cloud Speech Client
- Cloud Datastore User

## 4. משתנים: איפה יוצרים כל אחד
| משתנה | מאיפה מביאים |
|---|---|
| YEMOT_NUMBER, YEMOT_PASSWORD | חשבון ימות המשיח שלכם (שם המשתמש והסיסמה שבהם נכנסים לממשק הניהול) |
| GOOGLE_CLOUD_PROJECT | מזהה הפרויקט מ-https://console.cloud.google.com |
| GOOGLE_CLOUD_LOCATION | us-central1 (ברירת מחדל מומלצת) |
| SPEECH_LOCATION | us |
| GEMINI_MODEL | gemini-3.5-flash |
| LYRIA_MODEL | lyria-3-pro-preview |
| BREVO_API_KEY | https://app.brevo.com ← SMTP & API ← API Keys. השולח צריך להיות מאומת |
| MAIL_FROM | הכתובת המאומתת בברבו |

**לא להגדיר** את `GEMINI_API_KEY` ואת `ACEMUSIC_API_KEY`. הם מעבירים את החיוב מחוץ לקרדיט.

## 5. קובץ env.yaml
העתיקו את `.env.example` לקובץ בשם `env.yaml` בפורמט YAML, למשל:
```yaml
YEMOT_NUMBER: "0000000000"
YEMOT_PASSWORD: "..."
GOOGLE_CLOUD_PROJECT: "your-project-id"
GOOGLE_CLOUD_LOCATION: "us-central1"
SPEECH_LOCATION: "us"
MAIL_FROM: "you@yourdomain.com"
BREVO_API_KEY: "..."
```

## 6. פריסה ל-Cloud Run
בטרמינל, מתוך התיקייה של הפרויקט (אחרי `gcloud init`):
```bash
gcloud run deploy song-sketch-line \
  --source . \
  --region us-central1 \
  --env-vars-file env.yaml \
  --no-cpu-throttling \
  --min-instances 0 \
  --allow-unauthenticated
```
`--no-cpu-throttling` חשוב: בלעדיו יצירת השיר ברקע נעצרת אחרי שהשיחה נסגרת.
הכתובת שתתקבל בסוף תהיה בסגנון `https://song-sketch-line-xxxx.a.run.app`.

## 7. הגדרות השלוחה בימות המשיח
היכנסו לחשבון ימות המשיח ולשלוחה חדשה, ואז בהגדרות המתקדמות:
- **כתובת השרת (URL של API):** `https://song-sketch-line-xxxx.a.run.app/song`
- **סוג הבקשה:** GET או POST (שניהם נתמכים)
- **שמירה על שיחה פתוחה:** כמו שהספרייה yemot-router2 ממליצה במסמכים שלה, כדאי לא לכבות את ה-API אחרי כל צעד
- **זמן המתנה לקלט:** השאירו את ברירת המחדל
- **הקלטות:** הקלטות נשמרות בנתיב `/ApiRecords`, והקוד מוריד ומוחק אותן לבד

**שימו לב:** שמות התפריטים בממשק משתנים לפעמים. אם לא מצאתם שם מדויק, חפשו "API" או "כתובת שרת", או שאלו בפורום ימות המשיח.

## 8. בדיקה
1. לחייג לשלוחה.
2. ללחוץ 1, להקריא מילים, לבחור סגנון, לדלג על המנגינה, להזין מייל ולאשר.
3. לבדוק את הלוגים: https://console.cloud.google.com/run (בחרו את השירות ואז Logs).
4. לבדוק את תיבת המייל. ההמתנה לשיר יכולה להיות כמה דקות.
