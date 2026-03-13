

## Competition System Issues — Fix Plan

### Issues Identified

1. **Dialog scrolling frozen** — The `CompetitionFormDialog` uses `DialogContent` with `max-w-4xl h-[85vh] flex flex-col p-0`, but the base `DialogContent` already applies `max-h-[85vh] overflow-y-auto`. The component then has its own inner scroll container (`<div className="flex-1 overflow-y-auto pb-4" style={{ minHeight: 0 }}>`) — two competing scroll regions. The `p-0` override removes padding but the base dialog's `overflow-y-auto` on the outer shell conflicts with the inner flex layout, causing frozen/non-scrollable content. Same issue affects `CompetitionParticipantsDialog` (nested `ScrollArea` inside already-scrollable `DialogContent`).

2. **Competition types not working** — The admin form saves all competition types correctly to DB, but the `AllCompetitionsPanel` only queries `status = 'active'`. The real issue is that the Dialog for competition details (Sheet) doesn't render type-specific participation flows for all types properly because the scroll is frozen (issue #1), making it seem like types don't work.

3. **Previous competition winners not appearing** — `CompetitionHistory` page fetches winners by querying `competition_tickets.is_winner = true`, which works. However, the completed competition "كولكشن البداية" has `winner_user_id` set, and the query looks correct. The issue is likely that the admin `AdminCompetitions` page doesn't show winner info at all — there's no winner display section in the competition cards. Also, the `CompetitionParticipantsDialog` shows winners with a badge but doesn't highlight them prominently.

4. **Winner notifications not sent** — The `auto-draw-competitions` edge function does create notifications and calls `notify-competition-telegram`, but manual draws done through the admin panel likely bypass this entirely. There's no "draw winner" button visible in AdminCompetitions — the draw is only automatic via the cron edge function.

5. **Admin can't chat with winner** — There's no "chat with winner" button anywhere in the admin competition UI. The admin needs a way to initiate a conversation with the winner from the competition management page.

---

### Implementation Plan

#### 1. Fix Dialog Scrolling (Frozen Pop-ups)
- **`CompetitionFormDialog.tsx`**: Override the base DialogContent's scroll by adding `overflow-hidden` to DialogContent and keeping the inner flex scroll container as the sole scrollable area. Add `[&>div[data-radix-dialog-content]]:overflow-hidden` or simply pass `className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden"` so the outer dialog doesn't scroll, and only the inner `<div className="flex-1 overflow-y-auto">` handles scrolling.
- **`CompetitionParticipantsDialog.tsx`**: Same fix — set `overflow-hidden` on DialogContent and let the inner `ScrollArea` handle scrolling exclusively.

#### 2. Fix All Competition Types Working
- Ensure the frozen dialog fix (above) allows users to actually interact with all type-specific settings in the form.
- Verify the competition type Select dropdown renders inside a scrollable area and is accessible.

#### 3. Show Previous Competition Winners in Admin
- **`AdminCompetitions.tsx`**: Add winner info to completed competition cards — show winner name, ticket number, and a "🏆 فائز" section. Query `competition_tickets` with `is_winner = true` to get winners for each completed competition.
- Add a **"Draw Winner"** button for active competitions that triggers the draw manually (calling a new or existing edge function or inline logic similar to `auto-draw-competitions`).
- Add a **"Send Winner Notification"** button for completed competitions that re-sends the winner notification.

#### 4. Add "Chat with Winner" Button for Admin
- In the winner section of `AdminCompetitions` or `CompetitionParticipantsDialog`, add a button that navigates the admin to `/chats` with the winner's user ID, creating or opening a conversation via the existing `listing_conversations` system.

#### 5. Send Winner Notifications Properly
- When admin manually draws a winner, create notifications using `sendAllNotifications()` from `src/lib/notifications.ts` and also invoke `notify-competition-telegram` edge function.

---

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/CompetitionFormDialog.tsx` | Fix overflow: add `overflow-hidden` to DialogContent |
| `src/components/CompetitionParticipantsDialog.tsx` | Fix overflow: add `overflow-hidden` to DialogContent, add "Chat with Winner" button |
| `src/pages/AdminCompetitions.tsx` | Add winner display on cards, draw winner button, send notification button, chat with winner button |
| `src/components/ui/dialog.tsx` | No changes needed (base component is fine) |

