# 🚀 KaniUp-ის ატვირთვა Firebase-ზე

ყველაფერი Firebase-ზეა: **App Hosting** (Next.js აპი), **Firestore** (ბაზა), **Authentication** (შესვლა), **Storage** (ფაილები), **Cloud Messaging** (push).
PostgreSQL / Supabase არ გამოიყენება.

> ⚠️ **გეგმა:** Next.js სერვერის გასაშვებად (App Hosting) Firebase მოითხოვს **Blaze** გეგმას (pay-as-you-go).
> Blaze-საც აქვს იგივე უფასო ლიმიტები, რაც უფასო Spark გეგმას. ~100 მომხმარებელზე ხარჯი, სავარაუდოდ, **$0** იქნება.
> რეკომენდაცია: Google Cloud Billing-ში დააყენე **Budget alert** (მაგ. $5), რომ ნებისმიერ ხარჯზე შეტყობინება მოგივიდეს.

## 1. Firebase პროექტი
1. https://console.firebase.google.com → **Add project** → მაგ. `kaniup`.
2. **Upgrade** → Blaze (ბარათის მიბმა; იხ. ზემოთ).
3. **Build → Firestore Database** → Create (რეგიონი: `europe-west3` ან `europe-west1`), Production mode.
4. **Build → Storage** → Get started (იგივე რეგიონი).
5. **Build → Authentication → Sign-in method**:
   - **Email/Password** → ჩართე **Email link (passwordless sign-in)** (თვითონ პაროლი გამორთული დატოვე).
   - **Google** → Enable.
   - **Settings → Authorized domains** → დაამატე აპის დომენი (მაგ. `kaniup--xxxx.web.app` / საკუთარი დომენი).
6. **Project settings → Your apps → Web app (</>)** → დააკოპირე config მნიშვნელობები `apphosting.yaml`-ში.
7. **Project settings → Cloud Messaging → Web Push certificates** → Generate → გასაღები `NEXT_PUBLIC_FIREBASE_VAPID_KEY`-ში.

## 2. უსაფრთხოების წესები
```bash
npx firebase login
npx firebase use --add          # აირჩიე შენი პროექტი
npx firebase deploy --only firestore:rules,storage
```

## 3. საიდუმლოებები (Secrets)
```bash
npx firebase apphosting:secrets:set SMTP_URL      # smtps://kartoziasoso%40gmail.com:APP_PASSWORD@smtp.gmail.com:465
npx firebase apphosting:secrets:set CRON_SECRET   # ნებისმიერი გრძელი შემთხვევითი სტრიქონი
```
**Gmail App Password:** Google Account → Security → 2-Step Verification (ჩართული უნდა იყოს) → **App passwords** → შექმენი „KaniUp“ → 16 სიმბოლო (გამოტოვებების გარეშე ჩასვი).

## 4. App Hosting
1. Firebase console → **Build → App Hosting → Get started**.
2. დააკავშირე GitHub რეპოზიტორია `megrelisk/KaniUp`, ბრანჩი (მაგ. `main`), root directory `/`.
3. ყოველი push ამ ბრანჩზე ავტომატურად აახლებს აპს.

## 5. დილის შეხსენებები (Cloud Scheduler)
Google Cloud console → **Cloud Scheduler → Create job**:
- Frequency: `0 9 * * *`, Timezone: `Asia/Tbilisi`
- Target: HTTP, GET, URL: `https://<აპის დომენი>/api/cron/deadlines`
- Header: `Authorization: Bearer <CRON_SECRET>`

(3 job თვეში უფასოა.)

## 6. SMS (როცა გასაღები გექნება)
`apphosting.yaml`-ში გააქტიურე `SMS_PROVIDER` და `SMS_API_KEY` (secret). მხარდაჭერილია `smsoffice` და ნებისმიერი HTTP API (`SMS_API_URL` შაბლონით).
