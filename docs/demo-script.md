# Demo script v2: JL740, Delhi → Tokyo, after the cutoff

The live demo is the centre of the final pitch. It follows `/demo`'s six steps (spec: `docs/plan/v2.md`). The 4-minute version runs every step; the 2-minute cut is at the bottom. Every click below runs on the current build, and the story smoke test (`e2e/story.spec.ts`) runs the same path.

Two rules for whoever speaks: **the rules decide** (every chip and every fix names the rule or the rung behind it), and **food rules, not religion** (we store what someone doesn't eat and the dates, never "Jain" or the name of a festival). Numbers from the demo are "in our demo", never claims about JAL.

## Roles (suggested)
| Role | Who | Has |
|---|---|---|
| **Narrator** | Bhavyam | the deck clicker; says the lines below |
| **Driver** | Shefali | the projector laptop: `/demo` in one tab, the act's screen in the next |
| **Devices** | Gunagye | the server laptop, Priya's phone and the crew iPad (mirrored over the cable) |

## Setup (T-10 min)
1. **Server laptop:** `bash scripts/demo.sh --reset` (everything on :8000), then `npm run tunnel` in a second terminal; note the `https://….trycloudflare.com` address. Check `<address>/api/health` shows `{"ok":true}`.
2. **Projector laptop**, one tab each on the tunnel address: `/demo`, `/ops/changes`, `/ops/load`, `/ops/sun`.
3. **Priya's phone:** open `/chat?pnr=6XK2QP&surname=SHARMA`. The address becomes `?passenger=PX-0057`; leave it on the welcome message. (The booking reference changes in Chaos Mode; the pinned address keeps working.)
4. **iPad:** open `/crew` on the tunnel address while online (it loads the app for airplane mode). Don't download yet.
5. **`/demo`:** if it shows **Start: reset to 23 Oct 18:00**, leave it for step 0. After a rehearsal, press **Reset** (keeps the judges) first.

If a click fails, press **Do it for me** on `/demo`: the server does that step and every screen catches up within 2 s.

## 4-minute version
| Time | Step · sim clock | Driver / Devices | Narrator says | The room sees |
|---|---|---|---|---|
| 0:00 | **0 · 23 Oct 18:00** | `/demo` → **Start: reset to 23 Oct 18:00**. Point at the ladder. Leave the judge QR up. | "81% of Indians limit meat in some way, many only on certain days or festivals. JAL asks about meals once, 25 hours before take-off. Three of the four touchpoints in your brief come after that line. In 2013 a Delhi consumer commission made JAL itself pay ₹35,000 for a wrong meal. Judges: scan the QR and join JL740." | The cutoff ladder with **Today, the airline stops listening here**; "N joined" ticking up |
| 0:30 | **1 · 23 Oct 18:10** | `/demo` **Next**. Phone `/chat`: type (or tap the mic and say) `pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon` → **Send** → check the chips → **That's right**. | "Priya doesn't pick a meal code or fill a form. She says it her way, in Hinglish. Each chip shows which of her words it came from; she confirms. The rules pick AVML with no onion and no garlic. We keep her food rules, never her religion." | Chips grouped Never / Fine to eat, each with its words; "Purnima fasts · we'll ask before each one"; then **JL740: AVML + NO ONION NO GARLIC** |
| 1:10 | **2 · 23 Oct 18:12** | `/demo` **Next**. Phone: the Radar's question arrives → tap **1 Yes**. | "Her flight leaves on Sharad Purnima, a fast day. Today she'd remember at the gate, when nobody can help. The Calendar Radar asks now, a day before the cutoff, with one tap, and the kitchen makes the fasting meal in time." | "Your JL740 on Sun 25 Oct falls on Sharad Purnima. Keeping the fast?" → "Done… now the fasting version" (NO GRAIN NO LENTILS OR BEANS) |
| 1:40 | **3 · 24 Oct 11:30** | `/demo` **Next**. `/ops/changes` → **Run Chaos Mode**. Click three dots on the ladder: 23C (codeshare), 31K (gate), 38G (run-out). | "The night before the flight, compressed. Seven late changes: a companion who never ordered, a codeshare rebooking that drops Priya's meal, a diabetic at check-in, a Jain request at the gate, a no-show, a change of mind on board, and the paneer running out at the back. Each takes the best fix still physically possible at that minute, and the passenger is told honestly. The right column is what happens today." | Seven dots land on their rungs (caterer list, standby uplift, onboard spare, no-show release, reserve pouch, flex swap); the log's **Today** column mostly "not met"; the metrics strip fills in |
| 2:50 | **4 · 25 Oct 06:30** | `/demo` **Next**. iPad `/crew` → **Download for flight**, wait ~12 s, airplane mode on. **1 · Galley check**: Found on each tray, **Missing** on 27D → **Use backup**. **Copilot**: tap seat **2A**. **2 · Seat service**: 23C, code `CTUS6P` → **Check** (red) → **Next** → 23C, code `7K2Q9F` → **Check** (green). Airplane mode off. | "On board the tablet is offline. The copilot tells the crew in Japanese what each passenger can't eat, which tray is theirs, and when someone who doesn't eat before sunrise may eat: the sun rises over the aircraft 46 minutes before it rises in Delhi. A wrong tray is stopped at the seat." | Seats coloured by strictness; 2A's card in Japanese with **may eat from 06:30**; 27D on the sealed universal plate; red "do not serve" then green |
| 3:40 | **5 · 25 Oct 15:20 JST** | `/demo` **Next**. `/ops/changes` metrics strip, then `/ops/load`. | "Same seven events, two ways. Today: one strict need met out of five, and fresh meals thrown away. With ThaliBento: five of five, nothing wasted, and we knew 103 passengers' diets before the cutoff instead of 24. The safety stock is a shelf-stable universal plate that suits 13 of 13 diets on this route and flies again if unused, so covering almost every late request costs about ₹150 a flight." | Hard needs met 5/5 vs 1/5, meals thrown away 0 vs 2, diets known before the cutoff 103 vs 24; the coverage matrix with the universal plate at 13 of 13; the reserve card |
| 4:10 | | Back to the deck. | | |

**Optional (+20 s, after step 5):** phone, second tab `/p/days?pnr=6XK2QP&surname=SHARMA` → **Ekadashi** → **Save fast days**: her 20 Nov flight home gets the fasting note, in Japanese for the Tokyo kitchen. Optional (+20 s): `/ops/sun`, the chart of the sun over the aircraft vs Delhi.

## Fallback lines (say these while the Driver presses **Do it for me**)
| Step | If this fails | Do | Say |
|---|---|---|---|
| 1 | Phone typing or the mic stalls | **Do it for me: Save Priya's passport** | "Her words are in; here's what the rules made of them." |
| 2 | No question on the phone | Reload `/chat` once (the address is pinned); else **Do it for me: Answer Yes** | "She said yes; the kitchen has the fasting meal." |
| 3 | Run Chaos Mode errors | **Do it for me: Run Chaos Mode** | "Here are the seven changes as they landed overnight." |
| 4 | iPad trouble | **Do it for me: Sync the crew's scans** and show the seat map on the laptop (`/crew`) | "Same check, from the laptop." |
| any | Tunnel or Wi-Fi down | Laptop hotspot; or the backup video | "Here's the same run from this morning." |

## 2-minute cut (steps 1, 2, 3, 4, 5)
Before the pitch: `/demo` → **Start**. Keep the phone on `/chat` and the iPad on `/crew` online.
| Time | Do | Say |
|---|---|---|
| 0:00 | Phone: send the sentence → **That's right** → tap **1 Yes** on the Radar's question. | "She says it her way; the rules pick AVML with no onion or garlic, and the Radar catches her fast day before the cutoff." |
| 0:40 | `/demo` **Next** twice → `/ops/changes` → **Run Chaos Mode**. | "Seven late changes, each on the best fix still possible; the right column is today." |
| 1:30 | iPad: **Download**, airplane mode → Copilot seat 2A → Seat service 23C red, then green. | "Offline, in Japanese: who eats what, when the sun allows, and the wrong tray stopped at the seat." |
| 1:50 | `/ops/changes` metrics. | "Five of five strict needs met, against one of five today; nothing thrown away." |

## Numbers you can say (all measured on this build, simulated flight)
- **Chaos Mode, same seven events:** hard needs met 5/5 vs 1/5 today; firm (medical) 1/1 vs 0/1; meals thrown away 0 vs 2; diets known before the cutoff 103 of 186 vs 24.
- **Sun at the aircraft (JL740, 25 Oct 2026):** sunrise at the aircraft 05:42 IST over Tibet at 11,000 m vs 06:28 in Delhi (46 min earlier); a chauvihar passenger may eat from 06:30 instead of 07:16. Ground sunrise checked against sunrise-sunset.org within 1 min.
- **Smart load:** universal plate covers 13 of 13 diets (Jain thali 10, vrat plate 9, paneer 8, chicken 4); reserve by the newsvendor rule: fresh spares 7 (₹2,359 a flight in waste) vs shelf-stable pouches 10 (₹152 a flight).
- **Rules everywhere:** 625 shared rule test cases give identical answers on the server and the offline tablet.
- **Sources to quote:** Pew 2021 (81% limit meat, 39% vegetarian); Delhi state consumer commission vs JAL, ₹35,000 (2013, Deccan Herald); JAL's 25 h special-meal cutoff (jal.co.jp).

## After the demo
Leave `/ops/changes` up for questions. Before any re-run: `/demo` → **Reset** (keeps the judges).
