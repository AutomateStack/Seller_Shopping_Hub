# ShopHub production deployment

## Architecture

- **Frontend:** Vercel hosts this Vite/React app.
- **Backend/database:** Supabase is the recommended and already integrated backend. It provides PostgreSQL, Auth, Storage, Row Level Security (RLS), and the Edge Functions this app calls for checkout, wallet, quiz, email, and AI operations.
- **Do not replace Supabase with a separate database** unless you plan a backend rewrite. Vercel Postgres/Neon would only cover the database; it would not replace the existing Auth, Storage, RLS, or Edge Functions.

## 1. Secure the repository first

This project previously tracked `.env`. It is now ignored, but Git will keep tracking it until you run the following once. This does **not** delete your local `.env` file:

```powershell
git rm --cached .env
git add .gitignore .env.example vercel.json DEPLOYMENT.md
git commit -m "Configure secure Vercel deployment"
```

If the tracked file was ever pushed to a remote repository, rotate any keys it contained in the relevant provider dashboards. Never commit `service_role`, payment-provider, email-provider, or OpenAI keys.

## 2. Create or connect Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard), choosing a region close to your customers.
2. In **Project Settings > API**, copy the **Project URL** and the **Publishable key**.
3. In the repository root, copy `.env.example` to `.env` and enter those values for local development.
4. Apply all SQL files in `supabase/migrations` to this project's database, in filename order. Use the Supabase CLI (`supabase link`, then `supabase db push`) or paste/run them in the SQL Editor in order.
5. Deploy every directory under `supabase/functions` as a Supabase Edge Function. The frontend invokes these functions directly; Vercel does not host them.
6. In Supabase Auth, set:
   - **Site URL:** your production Vercel URL, then your custom domain once connected.
   - **Redirect URLs:** `http://localhost:8080/**`, `https://YOUR-VERCEL-DOMAIN/**`, and `https://YOUR-DOMAIN/**`.
7. Configure Edge Function secrets in **Supabase Dashboard > Edge Functions > Secrets** (or `supabase secrets set`). Add only the provider credentials required by the functions you enable: payment gateway, email sender, and AI provider keys. Keep these server-side; never prefix them with `VITE_`.

For Razorpay checkout and wallet top-ups, configure these exact Supabase Edge Function secrets:

```powershell
supabase secrets set RAZORPAY_KEY_ID=rzp_live_... RAZORPAY_KEY_SECRET=...
```

Then deploy the payment functions after every code or secret change:

```powershell
supabase functions deploy razorpay-create-order
supabase functions deploy razorpay-verify-payment
supabase functions deploy wallet-topup
supabase functions deploy wallet-verify-topup
```

Use `rzp_test_...` credentials while testing. The browser only receives `RAZORPAY_KEY_ID`; never add `RAZORPAY_KEY_SECRET` to `.env`, Vercel, or any `VITE_` variable.
8. Create/verify the Storage buckets used by the app, including `product-images` and any blog-image bucket referenced in the admin screens. Verify their upload/read policies before launch.

## 3. Deploy the frontend to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In [Vercel](https://vercel.com/new), select **Add New > Project**, import the repository, and use the repository root as the Root Directory.
3. Vercel normally detects Vite automatically. Confirm these settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
4. Add these environment variables for **Production**, **Preview**, and **Development** as appropriate:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID` (if used by future code)

   These are browser-visible configuration values and are safe to bundle. Do not enter Supabase `service_role` or other private credentials into Vercel for this frontend.
5. Deploy. The included `vercel.json` rewrites browser-router paths to `index.html`, preventing direct-route 404s.
6. Open the assigned `*.vercel.app` domain and test sign-up/login, product images, checkout, an admin action, and a direct deep link such as `/products`.

## 4. Custom domain and production cutover

1. In Vercel: **Project > Settings > Domains**, add your domain.
2. Add the exact DNS record Vercel shows at your domain registrar and wait for verification.
3. Add the verified custom domain to Supabase Auth's Site URL and Redirect URLs.
4. Update any allowed-origin, payment webhook, email-template, and analytics settings to use the custom domain.
5. Redeploy after changing Vercel environment variables.

## Launch checklist

- Production build succeeds locally: `npm run build`
- All migrations are applied to the production Supabase project.
- Every invoked Edge Function is deployed and has its required secrets.
- RLS is enabled and tested with a non-admin account.
- Storage bucket policies allow only intended uploads.
- Auth redirect URLs include both the Vercel and custom domains.
- Payment webhooks use their provider's real production endpoint/secret and are tested with a small transaction.
- `.env` is untracked and sensitive credentials have been rotated if exposed.

## Ongoing deployments

Pushes to the production branch trigger Vercel production deployments; pull requests receive preview URLs. Apply database schema changes through new Supabase migrations, deploy changed Edge Functions, then deploy the frontend.
