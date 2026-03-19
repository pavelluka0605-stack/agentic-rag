# Task

## Context
This is now an infrastructure blocker, not a product-model blocker.

## Objective
Run the real VPS end-to-end test as soon as `ANTHROPIC_API_KEY` is available in GitHub Secrets or in the deployed environment.

Focus only on the real deployed flow.

## What must be verified
1. Create a new chat
2. Send the first real user message
3. Receive a real Claude reply
4. Verify structured proposal metadata is extracted from the real LLM response
5. Verify proposal cards render correctly
6. Click `Создать задачу` on exactly one proposal
7. Verify the task is actually created
8. Verify the task is linked to the originating assistant message/proposal
9. Verify a system message about task creation appears in the chat

## Constraints
- Focus only on the real deployed flow
- Do not repeat architecture summaries
- Do not report build-only checks
- Do not use stub-only validation
- Do not auto-create tasks on every message

## Output
Return one markdown block only:

```report
DEPLOY STATUS:
- deployed yes/no
- environment
- ANTHROPIC_API_KEY present yes/no

REAL VPS E2E:
1. new chat created — yes/no — comment
2. first assistant reply generated — yes/no — comment
3. metadata extracted from real LLM — yes/no — comment
4. proposal cards rendered — yes/no — comment
5. task created from one proposal — yes/no — comment
6. task linked to originating message/proposal — yes/no — comment
7. system message added — yes/no — comment

ACTUAL REAL RESPONSE SUMMARY:
- assistant visible text
- number of proposals
- extracted missing items
- created task id

STILL BROKEN:
- ...
- ...

NEXT STEP:
- one concrete next step only
