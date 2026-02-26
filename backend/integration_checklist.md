# LYLO OS — Sentinel Integration Checklist

## Files to add / replace

| File | Action | Destination |
|------|--------|-------------|
| `src/lib/sentinelService.ts`         | ADD    | Frontend lib folder |
| `src/lib/useSentinel.ts`             | ADD    | Frontend lib folder |
| `public/service-worker.js`           | REPLACE | Replaces your existing SW |
| `sentinel_routes.py`                 | ADD    | Backend root (beside main.py) |
| `lylo_sentinel/` (from earlier)      | ADD    | Backend root |

---

## Step 1 — Backend: mount the router

In `main.py`, add two lines:

```python
from sentinel_routes import sentinel_router
app.include_router(sentinel_router)
```

---

## Step 2 — Backend: environment variable

Ensure your `.env` (and Render environment) has `VAPID_PUBLIC_KEY` set.
This is the same key used in Step 3.

---

## Step 3 — Frontend: environment variable

Add to your `.env` file:

```
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

Generate a key pair if you don't have one:
```bash
npx web-push generate-vapid-keys
```
Set the private key in your backend `.env` as `VAPID_PRIVATE_KEY`.
Set the public key in both `.env` files.

---

## Step 4 — Frontend: apply ChatInterface.tsx diff

Follow the 4 changes in `ChatInterface_sentinel_diff.md`.

---

## Step 5 — Deploy & test in dry-run mode

Set `SENTINEL_DRY_RUN=true` in your backend environment first.
Run the Sentinel manually to verify targeting and payloads:

```bash
python3 -m lylo_sentinel.sentinel_cron --mode dormant --dry-run
```

Check logs for:
- `✅ Pinecone connected`
- `📊 Dormant scan complete: N users qualify`
- `[DRY RUN] WebPush → ...`

---

## Step 6 — Go live

Set `SENTINEL_DRY_RUN=false` (or remove the variable).
Add cron jobs to Render / Railway:

```
# Daily dormant scan at 9 AM UTC
0 9 * * * python3 -m lylo_sentinel.sentinel_cron --mode dormant

# Sunday accountability sweep at 9 AM UTC
0 9 * * 0 python3 -m lylo_sentinel.sentinel_cron --mode both
```
