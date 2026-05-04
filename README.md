# Populavote — PromptPay Voting Web App

A vote-with-payment web app for school/club events. Voters scan a PromptPay QR code, pay 10฿ per point, and upload their bank slip — slips are verified server-side before votes are awarded.

**Stack:** Next.js 14 + TypeScript + Tailwind + Supabase (Postgres) + SlipOK API + Vercel

---

## Features

- 🗳️ PromptPay QR generation per vote (custom amount, 10฿ = 1 point)
- 🧾 Real slip verification via SlipOK (server-side, with replay protection)
- 💸 Auto-recovery: if voter pays a different amount than they picked, points are awarded based on the actual paid amount (rounded down to the nearest 10฿)
- 📊 Live leaderboard with realtime updates
- 🛠️ Admin page with candidate edit/delete, totals, and a voting open/close toggle
- 🔒 Rate limiting (per-IP) on both API endpoints
- ⏱️ Auto-expiry of pending payment intents after 30 minutes
- 🔐 Row-level security on all DB tables; service-role key isolated server-side

---

## Setup

### 1. Accounts you need

1. **Supabase** — https://supabase.com (free tier works)
2. **SlipOK** — https://slipok.com (slip verification, free tier ~100 slips/month)
3. **PromptPay-enabled bank account** — note the phone number registered
4. **Vercel** — https://vercel.com (deploy, free tier)
5. **GitHub** — for code hosting

### 2. Local install

```bash
git clone https://github.com/YOUR_USERNAME/populavote.git
cd populavote
npm install
cp .env.example .env.local   # then fill in real values
```

### 3. Database setup

In Supabase → SQL Editor, run these in order:

1. `supabase/schema.sql` — creates tables, view, and RLS policies
2. `supabase/functions.sql` — atomic vote-awarding function
3. The `app_settings` table:

```sql
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into app_settings (key, value)
values ('voting_open', 'true')
on conflict (key) do nothing;

alter table app_settings enable row level security;
```

### 4. Environment variables

Fill in `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SLIPOK_API_KEY=...
SLIPOK_BRANCH_ID=...
PROMPTPAY_ID=0812345678        # phone number, no dashes
ADMIN_TOKEN=long-random-string

⚠️ The `SUPABASE_SERVICE_ROLE_KEY` bypasses all DB security. Never commit it. Never expose it to the browser. Never paste it in chat or email.

### 5. Run dev server

```bash
npm run dev
```

Visit http://localhost:3000

### 6. Add candidates

Visit `/admin?token=YOUR_ADMIN_TOKEN` and use the form.

### 7. Deploy to Vercel

1. Push code to a private GitHub repo
2. Import the repo on Vercel
3. Add all 7 env vars in Vercel project settings
4. Deploy

⚠️ Both local and production environments share the same Supabase database by default. Stop your local dev server during the actual event to avoid accidental writes.

---

## Admin tasks

### Manually add points to a candidate

Use Supabase SQL Editor. Run both queries in sequence.

**Step 1** — create a fake "verified" payment intent:

```sql
insert into payment_intents (candidate_id, amount_baht, reference_number, status)
values (
  (select id from candidates where name = 'Candidate Name Here'),
  50,                                                                  -- amount in baht
  'MANUAL-' || floor(extract(epoch from now()))::text,
  'pending'
)
returning id;
```

This returns a UUID. Copy it.

**Step 2** — award the votes (paste the UUID, set how many points):

```sql
select verify_and_award_votes(
  'PASTE-UUID-HERE'::uuid,
  'MANUAL-TRANS-' || floor(extract(epoch from now()))::text,
  5                                                                    -- number of points to add
);
```

Refresh `/results` — points appear immediately.

### Soft-delete a candidate (with votes)

The DB blocks deleting a candidate who has votes (foreign-key restriction protects vote history). Recommended approach: hide them.

```sql
-- Sink them to the bottom of the list
update candidates set display_order = 9999 where name = 'Person Name';

-- Or rename them
update candidates set name = '[Withdrawn] Person Name' where name = 'Person Name';
```

### Hard-delete a candidate (destroys vote history)

⚠️ Not reversible. Export tables to CSV first if you want a backup.

```sql
delete from votes where candidate_id = (select id from candidates where name = 'Person Name');
delete from payment_intents where candidate_id = (select id from candidates where name = 'Person Name');
delete from candidates where name = 'Person Name';
```

### Wipe all votes (start fresh)

```sql
delete from votes;
update payment_intents set status = 'rejected' where status = 'verified';
```

Candidates and admin settings are preserved.

### Refund a vote

Find the payment intent for the vote you want to refund, then:

```sql
delete from votes where payment_intent_id = 'INTENT-UUID';
update payment_intents set status = 'rejected' where id = 'INTENT-UUID';
```

### Open / close voting

Use the toggle on `/admin?token=...`. When closed:
- New payment intents are blocked
- Slip verification is blocked
- A "Voting is closed" banner appears on the home page
- Existing results stay visible

---

## Security notes

- **Slip replay protection:** every successful slip's `transRef` is stored with a unique constraint. The same slip can't be redeemed twice.
- **Recipient check:** server verifies the slip was paid to the configured PromptPay number.
- **Amount validation:** if a voter pays a different amount than picked, the system auto-recovers and awards points based on the actual paid amount (rounded down to nearest 10฿).
- **Rate limiting:** 10 intents/min and 3 slip uploads/min per IP.
- **Voting toggle:** a panic-button kill switch in the admin page.
- **RLS:** all tables have row-level security. Only the server (with `service_role` key) can write.

### Rotating compromised secrets

If `SUPABASE_SERVICE_ROLE_KEY` ever leaks (committed to public git, pasted in chat, screenshot, etc.):

1. Supabase dashboard → Settings → API Keys → revoke the secret key
2. Generate a new one
3. Update `.env.local` (local) and Vercel env vars (production)
4. Redeploy on Vercel

---

## File structure

app/
page.tsx                     → home (candidate grid, total stats, "voting closed" banner)
vote/[id]/page.tsx           → vote page for a single candidate
results/page.tsx             → live leaderboard
admin/page.tsx               → admin (add/edit/delete, totals, voting toggle)
api/create-intent/route.ts   → creates payment intent + PromptPay QR
api/verify-slip/route.ts     → verifies slip via SlipOK, awards votes
lib/
supabase.ts                  → DB clients + isVotingOpen helper
promptpay.ts                 → QR generation
rate-limit.ts                → in-memory per-IP rate limiter
components/
VoteFlow.tsx                 → amount picker + QR + slip upload (client component)
Leaderboard.tsx              → live-updating leaderboard
AdminForm.tsx                → add-candidate form
EditCandidate.tsx            → inline edit/delete row
supabase/
schema.sql                   → tables, view, RLS
functions.sql                → verify_and_award_votes, expire_stale_intents

---

## Things to tweak for your event

- `lib/promptpay.ts` — customise QR styling
- `app/page.tsx` — change the "Vol. 01 · Edition Live" subhead, marquee text, stats labels
- `app/globals.css` — fonts, colors (look for `--font-display`, `bg-paper`, `text-ink`, `text-accent`)
- `supabase/functions.sql` — change `'30 minutes'` interval in `expire_stale_intents` if you want shorter/longer expiry
- `app/api/create-intent/route.ts` — adjust rate limit `(intent:${ip}, 10, 60_000)` numbers
- `app/api/verify-slip/route.ts` — adjust slip rate limit `(verify:${ip}, 3, 60_000)`

---

## Known limits

- No voter authentication — anyone with the URL can vote (intentional, school-event scale)
- Single-server rate limiter (resets on Vercel cold-start; OK for one-event use)
- Cannot delete a candidate with votes without manual SQL (intentional protection)
- SlipOK consumes a slip from your quota even when our app rejects it — see the auto-recovery logic for amount mismatches
- Same Supabase DB shared between local dev and production unless you set up a separate project

---

## Troubleshooting

**"Slip already used" on first attempt** → SlipOK saw this slip earlier (e.g. from a prior failed amount check). Each slip is one-shot. If a real voter is stuck, manually add their points via SQL (see admin tasks above).

**"Voting is currently closed"** → check `app_settings` table; toggle voting back open from `/admin?token=...`

**Edits in admin not reflecting on vote page** → make sure `noStore()` is called at the top of `app/vote/[id]/page.tsx`. Hard refresh browser (Cmd+Shift+R)

**Vercel deploy failing** → check the build logs. Usually it's a missing env var or a TypeScript error from a recent edit

**Toggle button does nothing** → check `app_settings` table exists in Supabase. If missing, run the SQL from setup step 3.

---

## Credits

Built for school council elections. Use freely, fork, modify. No warranty.
