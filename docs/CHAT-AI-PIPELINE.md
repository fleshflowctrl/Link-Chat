# Chat AI Pipeline — architectuur v2 (ChatTurnPlan)

## Manual operator mode (`MANUAL_OPERATOR_MODE=1`)

When enabled in `.env.local`:

- User messages are saved; **no** automatic `generatePeerReply`, pending queue, spontaneous, or winback.
- Threads appear in **`/operator/inbox`** (`chat_operator_queue`).
- Operators send via `POST /api/operator/conversations/{ownerId__peerId}/reply` (`message_source=operator_manual`).
- AI only via **`POST .../suggest-reply`** → `generatePeerReplyDraftOnly` (no DB insert).
- Cancel old AI queue: `POST /api/operator/cancel-ai-pending`.

### Telegram operator (optional)

When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OPERATOR_CHAT_IDS` are set:

- New user messages also notify your Telegram chat (HTML melding).
- **Reply** on that Telegram message → same insert as web (`message_source=operator_telegram`).
- Web inbox at `/operator/inbox` keeps working in parallel.
- Setup: `/admin/telegram` → register webhook (HTTPS; production or ngrok locally).
- DB: migration `20260522130000_chat_operator_telegram_map.sql`.

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OPERATOR_CHAT_IDS`, optional `TELEGRAM_WEBHOOK_SECRET`, optional `TELEGRAM_OPERATOR_USER_ID` (admin uuid for `assigned_operator_id`).

**Forum topics (recommended at scale):** set `TELEGRAM_OPERATOR_GROUP_CHAT_ID` to a supergroup with Topics enabled. Each user+persona conversation gets its own topic; reply in that topic (no reply-to needed). Migration: `20260522140000_chat_operator_telegram_topics.sql`.

**Operator inbox UX:** persona color badges, user photo + age/location context, “alleen ongelezen” filter, transcript recap in long threads.

**Operator summary (Grok):** menu → **Samenvatting** → `GET` loads saved text; **Opnieuw genereren** → `POST { refresh: true }`. Stored in `chat_operator_saved_summary` (migration `20260522150000`). Does not message the user.

---

# Chat AI Pipeline — architectuur v2 (ChatTurnPlan)

**Promptversie:** `v15` · **Orchestrator:** `lib/ai/generate-peer-reply.ts`

## Kernprincipe

**Logica eerst, stijl daarna.**

1. `ChatTurnPlan` bepaalt intent + constraints **vóór** Grok  
2. Plan staat in de system prompt (`GESPREKSPLAN VOOR DIT ANTWOORD`)  
3. Na Grok: **één** `Final Coherence Validator` (geen 6 losse rewrites)  
4. Daarna alleen **cosmetische** cleanup (taal, emoji)  
5. Last-resort: `validateChatQuality` + fallback template  

Oude guards (`conversation-state`, `session-fact`, `greeting-deduper`, zware `dutch-human-realism`) draaien **niet meer** in de main path. Logica zit in plan + `final-coherence-validator.ts`.

---

## Pipeline (volgorde)

### A. Vóór Grok

| Stap | Module |
|------|--------|
| User burst coalesce | `coalesce-user-reply.ts` (messages route) |
| Memory refresh | `thread-memory`, `structured-memory`, `persona-self-memory`, `user-cross-chat-profile` |
| **ChatTurnPlan** | `chat-turn-plan.ts` (`buildChatTurnPlan`) |
| System prompt | `build-grok-system-prompt.ts` + `human-dutch-flirting-style.ts` + plan-blok |
| Dialogue tail | `sliceRecentDialogue` (50 berichten) |

### B. Grok

`grokResponsesComplete` — optioneel `draft-revise` (`XAI_DRAFT_REVISE=1`)

### C. Na Grok

| Stap | Module | Semantisch? |
|------|--------|-------------|
| Final Coherence Validator | `final-coherence-validator.ts` | **Ja** — 1× regels + fallback (+ optioneel LLM) |
| Light text cleanup | `light-text-cleanup.ts` | Nee — cosmetic |
| Split `<<<>>>` | `post-process-reply.splitMultiMessage` | cap = `plan.maxBubbles` |
| postProcessReply | markdown/lengte | cosmetic |
| Voice fingerprint | structural quirks only | cosmetic |
| Language cleanup | `language-cleanup.ts` | fix hoegaat/pirma |
| Emoji guard | `emoji-realism-guard.ts` | throttle |
| Ellipsis guard | `ellipsis-realism-guard.ts` | strip `...` spam (voice fingerprint no longer injects) |
| Last resort | `validateChatQuality` + `chat-turn-fallbacks.ts` | assert only on **invalid** output |
| Greeting fallbacks | `persona-greeting-style.ts` | seeded persona pools — not universal `"hoi jij"` |

Dev log when a template replaces model output: `[template-fallback]`.

### D. Delivery

Pacing → DB → pending chunks → read receipts

---

## ChatTurnPlan (`lib/ai/chat-turn-plan.ts`)

Output o.a.:

- `userIntent`: `greeting_only` | `greeting_plus_how_are_you` | `flirt` | …
- `mustAnswer`, `shouldNotAsk`, `allowedMoves`, `bannedMoves`
- `knownUserFactsThisSession`, `knownBotFactsThisSession`
- `maxBubbles`, `maxTotalChars`
- `shouldGreet`, `canAskBack`, `canIntroduceBotActivity`

Gebouwd uit: user burst, recent 12 turns, structured memory, `extractBotSessionFacts`, `normalizeUserMessageIntent`.

---

## Dev logging (gegroepeerd)

Één log per beurt:

```
[chat-turn-debug]
```

Bevat: `chatTurnPlan`, `rawGrokResponse`, `afterCoherence`, `finalResponse`, `invalidReasons`, …

---

## Acceptance tests

```bash
npx tsx scripts/run-chat-acceptance.ts
```

Fixtures: `lib/ai/chat-turn-acceptance.ts` (7 cases: hoi, hoi+hoe gaat het, net gegeten, flirt, …)

---

## Env vars

| Variabele | Default |
|-----------|---------|
| `XAI_API_KEY` | — |
| `XAI_CHAT_MODEL` | `grok-4.3` |
| `XAI_DRAFT_REVISE` | off |
| `XAI_FINAL_COHERENCE_LLM` | off |
| `XAI_DISABLE_PACING` | off |
| `PERSONA_DEFAULT_TZ` | `Europe/Amsterdam` |

(Legacy guard LLM flags still exist in old modules but are unused in main path.)

---

## Legacy modules (niet in main path)

Still in repo for reference / optional use:

- `dutch-human-realism-rewriter.ts` (heavy rewrite)
- `conversation-state-guard.ts`
- `session-fact-consistency-guard.ts` (still used: `extractBotSessionFacts` + validator)
- `greeting-deduper.ts`
- `chat-quality-gate.ts` (`applyChatQualityGate` replaced by `validateChatQuality` only)

---

*Updated: ChatTurnPlan + Final Coherence architecture.*
