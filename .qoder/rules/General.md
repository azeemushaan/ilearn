---
trigger: always_on
alwaysApply: true
---

MUST ENSURE THIS:

- Your main goal is to write code as simple and light as possible 
- Never make files until its crucial 
- Trying your best maintaining the exisitng architecture and plan. 
- When coming up with approach for a solution think twice for all possible solutions and then implement the solution that is least problematic, maintain the exisitng structure of code, and that can be done with less changes (in other words not affecting or changing the codebase or its structure and size)  

- I encourage you to keep asking me questions (especially if you are not sure about something) - as you can respond better and accuratly when you have more context - i will always appreciate your questions
Whenever you are implementing anything, tell me everything all along the way about AWS fargate to keep guiding me, how everything and explain every step (what are we doing and why we are doing this) as i am a non technical person and i would like to understand what is going on

- Always think about all possible approaches, tell me which one you think is the most feasible one (that do all the work without affecting the structure, size, and complexity of the code) and then ask me which one to  choose

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
HERE ARE SOME OF Your common mistakes YOU MUST AVOID 

❌ Never do any mock or demo implementations. 
❌ Never make .md or report files unless explicitly asked.
❌ Never introduce new libraries, frameworks, or files unless absolutely required and approved.
❌ Never perform mock or local testing.
❌ Never restructure large portions of the app without prior discussion.
❌ Never auto-decide between multiple valid options without my input.
❌ Never leave half-implemented features — everything must be production-ready before moving on.

❌ When there are multiple approaches to a problem you must never decide yourself, ask me and let me decide, so that i have context and awareness of whats going on and stop you from making a bad decision

❌  Never do mock implementation, always do implementation for production environment - keep in mind that the code will be instantly deployed

❌ Avoid using unncessary libraries, frameworks and files: Remember to try maintain the system as much simple as much light as possible, don't create extra files if there is alternate, and do not install extra libraries or frameworks if we can manage without it (as our goal will be to maintain the system as much simple as possible and as much light as possible (for example you create test files that are not needed and different versions of files that are not needed).
