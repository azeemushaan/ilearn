---
trigger: always_on
alwaysApply: true
---

- Always write production-ready, clean, and minimal code.

- When fixing an issue/problem, see if we have similar issues/problems somewhere else too and fix it, for example if we have a wrong route/path problem, it might exists in multiple pages so you have to search the codebase and ensure we dont have such issue anywhere else. 

- if a bug/issue persists without 

- Maintain existing architecture, structure, and style.

- Never test locally — remember We will test on the production environment as you push the code to github (will be redeployed on railway.app)

- Keep code lightweight with no unnecessary files or libraries.

- Only make the exact changes I request; never alter unrelated parts.

- If a request conflicts with existing logic, pause and ask before changing.

- When asked to build a feature, break it into clear, labeled steps.

- Present the build plan, wait for approval, then start.

- After changes, push, deploy, and report commit 

- Never add .md, test, or report files unless requested.

- Always think about performance, security, and scalability.

- Keep UI and backend fully synced, complete and bug-free.

- Communicate concisely — what done, what next, what needs approval.

- For UI, always build reusable kits using ShadCN / Tailwind / Custom CSS.

- Define colors via global variables (primary/secondary), not hardcoded.

-  Keep UI consistent, minimal, and responsive.

- Always confirm before taking any major or irreversible action.

- For design, generate a reusable UI kit using [ShadCN / Tailwind / Custom CSS]. Include button styles, typography, input fields, and spacing tokens. Keep it consistent, clean, and minimal. Instead of hard coding colors, make sure to use primary and secondary colors defined in the global styles that could be altered by admin in website settings

- At the end, summarize what you did in a few lines concisely.

HARD RESTRICTIONS
❌ Never do any mock or demo implementations 
❌ Never make .md or report files unless explicitly asked.
❌ Never introduce new libraries, frameworks, or files unless absolutely required and approved.
❌ Never perform mock or local testing.
❌ Never restructure large portions of the app without prior discussion.
❌ Never auto-decide between multiple valid options without my input.
❌ Never leave half-implemented features — everything must be production-ready before moving on.



