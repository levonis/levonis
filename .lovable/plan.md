
## Root Causes

**Issue 1 — Subscriber list shows incorrect/incomplete data:**
The `user_cards` table has RLS policies that ONLY allow `auth.uid() = user_id`. There is no admin SELECT policy, so the admin's query returns only their own card (currently 2 active cards exist in DB, but admin sees only their own).

**Issue 2 — Cannot edit expiration date:**
- No admin UPDATE policy on `user_cards` (only `auth.uid() = user_id`).
- No UI in the holders tab for editing `expires_at` — it's display-only.

## Fix

### 1. Database migration — add admin RLS policies on `user_cards`
```sql
CREATE POLICY "Admins can view all user cards"
  ON public.user_cards FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all user cards"
  ON public.user_cards FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user cards"
  ON public.user_cards FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### 2. `src/pages/AdminLoyaltyLevels.tsx` — add inline expiration date editing in the holders tab
- Add `editingHolderId` + `editingExpiresAt` state.
- In the "تاريخ الانتهاء" column, show the date with a small pencil button. Click → opens a Popover with a shadcn Calendar (`pointer-events-auto`) bound to `expires_at`.
- On select: mutation calls `supabase.from('user_cards').update({ expires_at: newDate.toISOString() }).eq('id', holder.id)`, then invalidates `cardHolders` query and toasts success.
- Add a quick "+30 days" / "+1 year" extend buttons next to the date for convenience.
- After update, also recompute `is_active` in UI (kept active as long as date is future).

### 3. Verify subscriber count
Once the admin SELECT policy is in place, both `cardHolders` query and `stats.activeHolders` count will return all users. No code change needed beyond the policy.

## Result
- Admin sees ALL active card subscribers.
- Admin can edit each subscriber's expiration date directly from the table (calendar picker + quick extend buttons), with immediate persistence and rollback on failure.
