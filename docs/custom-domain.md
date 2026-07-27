# Moving to a custom domain

The Celo team's review said one concrete thing about infrastructure:

> The domain needs to be your own with HTTPS not vercel.

`nullstate-ten.vercel.app` works and is served over HTTPS, so this is not a
security gap — it is a credibility one. A wallet with 16M users links out to a
Mini App from inside its own UI, and a `*.vercel.app` subdomain reads as a
preview deploy rather than a product. It is also not yours: it cannot move to
another host, and it disappears if the project is renamed.

This is a runbook, not a suggestion. The order matters, because **one step is
not reversible**.

---

## The irreversible step, first

The Celo attribution code (ERC-8021) that tags every transaction this app sends
is **a hash of the hostname**. It is derived, not registered:

```
codeFromHostname('nullstate-ten.vercel.app')  →  celo_135bf4523d70
codeFromHostname('nullstate.xyz')             →  some entirely different code
```

Change the domain and the code changes with it. Celo's dashboard then sees two
unrelated apps — the transactions before the move under one code, the ones after
under another — and **attribution cannot be backfilled**. Every tagged
transaction the game has already sent stays stranded under a hostname that no
longer resolves, and it counts toward nothing.

So before touching DNS, pin the current code:

```
NEXT_PUBLIC_CELO_ATTRIBUTION_CODE=celo_135bf4523d70
```

`lib/attribution-tag.ts` prefers a pinned code over the hostname on both the
client and the server. With it set, the move is invisible to attribution: same
code before, same code after, one continuous history.

Once pinned, it must never change again.

> **Better long-term option.** Proof of Ship — which this project is already
> enrolled in — issues attribution codes tied to the *project* rather than to
> whatever URL it happens to live at. An issued code survives every future move
> for free. If one is available, pin that instead of the hostname hash, and do
> it before the domain change rather than as a second migration later.

---

## Steps

1. **Buy the domain.** Any registrar. Prefer something short and typable on a
   phone keyboard — the audience opens this inside MiniPay on Android, often on
   a cheap device, and often shares links by pasting them into WhatsApp.

2. **Pin the attribution code.** Vercel → Project → Settings → Environment
   Variables → `NEXT_PUBLIC_CELO_ATTRIBUTION_CODE` = `celo_135bf4523d70`,
   applied to Production. Redeploy and confirm before step 3.

3. **Add the domain in Vercel.** Project → Settings → Domains → Add. Vercel
   provisions the certificate automatically; HTTPS is not a separate step and
   there is no certificate to renew by hand.

4. **Point DNS at Vercel.** The exact records are shown in the same screen —
   usually an `A` record for the apex and a `CNAME` for `www`. Propagation is
   normally minutes, occasionally a few hours.

5. **Set the public URL.** `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`, also
   applied to Production. This is what fixes the OpenGraph metadata base,
   `robots.txt`, the sitemap and the server-side attribution hostname — all in
   one place, because `lib/siteUrl.ts` is the only file allowed to name the
   URL and `npm run audit` fails if that stops being true.

6. **Keep the Vercel subdomain working.** Do not remove it. Old links exist —
   in Telegram messages, in the MiniPay submission draft, in posts. Vercel
   redirects the subdomain to the primary domain automatically once one is set
   as primary, which is the behaviour you want.

7. **Update what points at the old URL.** `docs/minipay-submission-draft.md`
   (App URL, Terms, Privacy), the MiniPay listing form if already submitted,
   and any social profile links.

8. **Re-run PageSpeed against the new domain** and record the score in
   `docs/network-manifest.md`. The number in the submission has to match the URL
   being submitted.

---

## What does *not* need to change

- **Contracts.** Nothing on-chain references the domain.
- **Firebase.** Add the new domain to the authorized-domains list if auth is
  ever used; the RTDB and Firestore calls this app makes are unaffected.
- **The RPC.** Independent of the site's own hostname.
- **The treasury CLI.** `scripts/deposit-reward.js` reads the URL out of
  `lib/siteUrl.ts` rather than keeping its own copy, so it follows along on the
  next `git pull`. `STATS_URL` still overrides it for a one-off.

---

## Verifying afterwards

```bash
curl -sI https://yourdomain.com | head -1          # 200, over TLS
curl -s  https://yourdomain.com/robots.txt         # sitemap line names the new host
curl -s  https://yourdomain.com/sitemap.xml | head # URLs on the new host
```

Then open the game in MiniPay, buy the cheapest item, and check the transaction
on Celoscan: the calldata should still end in the pinned suffix. If it changed,
step 2 did not take effect — stop and fix it before more transactions land under
a second code.
