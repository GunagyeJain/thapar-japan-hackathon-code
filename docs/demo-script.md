# Demo script: JL740, Delhi → Tokyo

The live demo is slide 4 of the final pitch. The **4-minute version** follows m11's nine steps on `/demo`; the **2-minute cut** (Acts 1, 2, 4, 5) fits the 5-minute pitch. Every click below was run end to end on the real app on 24 Oct, 18:50 IST, and again at 23:30 IST after the `/demo` cockpit, the guide bar and the new ops console landed.

Two rules for whoever speaks: **rules decide** (the system names the rule that fired), and **a person approves every fix**. Numbers from the demo are "in our demo", never claims about JAL.

## Roles (suggested; swap names if the team decides otherwise)
| Role | Who | Has |
|---|---|---|
| **Narrator** | Bhavyam | the clicker for the deck; says the lines below |
| **Driver** | Shefali | the projector MacBook: `/demo` in one tab, the act's screen in the next |
| **Devices** | Gunagye | the server laptop, Priya's phone and the crew iPad (mirrored over the QuickTime cable) |

## Setup (T-10 min)
1. **Server laptop:** `bash scripts/demo.sh --reset` (serves everything on :8000), then in a second terminal `npm run tunnel` and note the `https://….trycloudflare.com` address.
2. **Projector MacBook**, all on the tunnel address, one tab each: `/demo`, `/ops`, `/caterer`, `/ops/late`, `/insights`.
3. **Priya's phone:** open `/p` on the tunnel address. Leave it on "Find your booking".
   In a second tab on the same phone, open `/p/days?pnr=6XK2QP&surname=SHARMA` (Priya's fast days). It says "Tell us what you eat first" until Act 1 is done; that's expected.
4. **iPad:** open `/crew` on the tunnel address while online and leave it about 15 s (it saves the app for airplane mode). Don't download yet. Mirror it over the cable.
5. **`/demo`:** if it says "Start: reset to 23 Oct 18:00", leave it for Act 0. If a rehearsal ran, press **Reset** (keep judges) first.
6. Check the tunnel: `<address>/api/health` shows `{"ok":true}`.

**Never** refresh Priya's phone during the demo: it goes back to "Find your booking", and finding her again restarts the form. Never press **Next** twice. If a click doesn't work, press **Do it for me** next to **Next** on `/demo`: it does that step on the server and the screens catch up within 2 s.

## What's on the screens
- **`/demo` is the Driver's cockpit.** A strip of the nine steps across the top; for the current step, which device and screen (with **Open**), the clicks in order (**Do**), the Narrator's line (**Say**) and what the room should notice (**The room sees**). On the right, Priya's meal promise fills in hand-off by hand-off, and the judge QR with "N joined". **Next** names the step it moves to, e.g. *Next: Priya's inbound is rebooked; her meal drops*.
- **The guide bar.** Once **Start** is pressed, every projector screen (`/ops`, `/caterer`, `/ops/late`, `/insights`) shows a bar under the flight bar: the act and sim time, "This screen: …", "Do here: …", and Priya's five hand-offs with the current one outlined. **Hide guide** (right end of the bar) shows the plain screen; each browser remembers the choice.
- **`/ops`** from top to bottom: *How it works* in three boxes (reads every passenger list → checks every special meal → raises an alert, a person fixes it); five numbers, each with a plain line under it; **Alerts · what needs a person** (click a row to open it); then **Meal promises · where every meal stands**, every passenger who told us their food rules (judges included) across Diet → Booking → Caterer → Galley → Seat, next to the PNL/ADL feed. Judges' reserved meals show as Info alerts and don't count as open problems.
- **Priya's phone**, on *Your meal promise*: the tray label, the promise status, and **Where your meal is** with her five hand-offs, live.
- **Crew iPad**, **3 · Seat map**: tap any seat to see who sits there, what they can't eat, their tray and whether it's been found or served. Judges are marked **J**.

## 4-minute version
| Time | Act · sim clock | Driver / Devices | Narrator says | The room sees |
|---|---|---|---|---|
| 0:00 | **0 · 23 Oct 18:00** | `/demo` → **Start: reset to 23 Oct 18:00**. Leave the judge QR up. | "Priya flies JL740 from Delhi to Tokyo tomorrow morning. She's vegetarian and doesn't eat onion or garlic. Judges: scan the QR and join the flight; tell it what you can't eat." | Boarding pass, the QR, "N joined" ticking up |
| 0:20 | **1 · 23 Oct 18:10** | `/demo` **Next**. Phone `/p`: PNR `6XK2QP`, surname `SHARMA` → **Find booking** → **Next** → **Continue** → tap **Vegetarian**, tick **Onion & garlic** → **Next** → **Yes, that's right** → **Confirm AVML**. Then `/ops`: point at the **24A** alert and Priya's row on **Meal promises** (C1 Done). | "She doesn't pick a meal code. She says what she can't eat; the rules pick AVML and add the kitchen note. Her tray label says *VEG · no onion, no garlic*. On the ops board, an agent booked 24A on HNML, JAL's non-vegetarian Hindu meal (lamb, chicken, fish). His rules say vegetarian, so it's flagged with the fix: AVML." | AVML **Recommended**, note `NO ONION NO GARLIC`; `/ops` alert **24A · WRONG_CODE**; the meal-promise board, 23C at C1 **Done** |
| 1:00 | **2 · 24 Oct 23:02** | `/demo` **Next**. `/ops` → in **Alerts**, click **Meal request dropped after rebooking** (23C). | "Late at night her IndiGo connection is rebooked. The new booking reaches JAL without her meal. Today nobody would notice until the seat. We catch it with 1 hour 38 minutes left before the caterer's final list." | 23C **Critical** on top; C2 turns red in the guide bar; countdown **1 h 37 m**; evidence: PNL lines 335–338 vs the ADL, AVML line struck out |
| 1:30 | **3 · 24 Oct 23:09** | `/demo` **Next**. Alert tab → **Request again** → **Approve and send**. Hold up Priya's phone. | "Staff see the exact SSR line that goes back. A person approves it; nothing in the booking system changes on its own." | Dialog with `.R/AVML HK1 NO ONION NO GARLIC`; alert **Resolved**, C2 **Fixed**; Priya's phone: *Your meal is restored · 23:09 IST*, C2 **Fixed** under *Where your meal is* |
| 1:50 | **4 · 25 Oct 00:40** | `/demo` **Next**. `/caterer` → **Acknowledge** → **Labels**. | "The kitchen gets numbered, hashed meal lists with the change spelled out, and acknowledges them. Labels carry a code, not a seat: seats change after the truck leaves." | v3 **Waiting for acknowledgement**, "booking ref 6XK2QP → 8MZ2TN", then **Acknowledged 00:40**; A4 label sheet |
| 2:15 | **5 · 25 Oct 02:50** | `/demo` **Next**. `/ops/late`: type `31K` → **31K MEHTA** → tap **Jain** → **Find a safe meal** → **Reserve**. | "At the gate, Mr Mehta asks for a Jain meal he never booked. We check every meal already on board against his rules and explain why each one fails." | **Spare special** VJML, galley 2 (G2-X01); AVML spare *contains onion*; paneer butter masala *contains onion, garlic*; "CP-SAT · … ms"; **Done: late request** |
| 2:50 | **6 · 25 Oct 03:35** | `/demo` **Next**. iPad `/crew` → **Download for flight** → wait for **Saved 03:35** → turn on **airplane mode**. | "At boarding the crew download the flight once. From here the tablet is offline." | **Saved 03:35**, then **Offline** |
| 3:00 | **7 · 25 Oct 05:20** | `/demo` **Next**. iPad **1 · Galley check**, Galley 1: **Found** on each tray, **Missing** on **27D** → **Use backup**. **2 · Seat service**: seat **23C** → type `CTUS6P` → **Check** (red) → **Next** → **23C** → type `7K2Q9F` (or scan Priya's printed label) → **Check** (green) → **Next**. Airplane mode off. Optional (+10 s): **3 · Seat map** → tap **5A**. | "27D's tray didn't make it on board; the tablet offers the sealed backup in galley 2. At the seat, the wrong tray is stopped before it's served, offline, with the same rules as the server." | **7 of 8 found** → backup used; red **Do not serve · contains onion, contains garlic**; green **Safe to serve**; on 5A, the judge's name, meal and tray |
| 3:40 | **8 · 15:20 JST** | `/demo` **Next**. `/insights`. | "Landed in Tokyo. Priya's meal promise held at all five hand-offs. It broke once, at 23:02, and was fixed in 7 minutes. That record is the data JAL doesn't have today." | **5/5**, *Caught before the caterer's list 1 h 38 m*, *Time to fix 7 min*, breakpoint C2, journey C1 → C5 |
| 3:55 | **+ · 20 Nov, flight home** (optional, +20 s) | Phone: switch to the `/p/days` tab → tap **Ekadashi** (skip if it's already blue) → **Save fast days**. | "One more thing a 4-letter code can't say. Priya fasts on Ekadashi, and her flight home on 20 Nov is one. Her phone sends only the date, never which fast. That leg gets the fasting note, in Japanese for the Tokyo kitchen; her flight out is unchanged." | JL749 · 20 Nov · **Fast day**: AVML, `NO ONION NO GARLIC NO ALCOHOL NO GRAIN NO LENTILS OR BEANS`, 東京のキッチンへ：玉ねぎ・にんにく・アルコール・穀物・豆類不使用; *Usual meal: AVML · NO ONION NO GARLIC* |
| 4:15 | | Back to the deck. | | |

## Fallback lines (say these while Driver presses **Do it for me**)
| Act | If this fails | Do | Say |
|---|---|---|---|
| 1 | Phone form stuck | **Do it for me: Save Priya's profile** | "Her answers are saved; here's the meal it picked." Show `/ops`. |
| 2 | Alert doesn't appear | Reload `/ops` (laptop only) | "The rebooking just came off the feed." |
| 3 | Request again errors | **Do it for me: Request again** | "Approved; here's the corrected booking." |
| 4 | Acknowledge errors | **Do it for me: Acknowledge v3** | "The kitchen confirmed list v3." |
| 5 | `/ops/late` errors | **Do it for me: Reserve for 31K** | "Reserved: spare Jain meal, galley 2." |
| 7 | iPad camera or tablet trouble | Type the 6-character code; or **Do it for me: Sync the crew's scans** and show the seat map on the laptop | "Same check, from the label code." |
| + | `/p/days` shows "Tell us what you eat first" | Reload that tab once (Act 1 saved her profile after it opened) | "Her answers from Act 1 are in; here are her flights." |
| any | Priya's phone was refreshed | Don't fill the form again. Point at her hand-offs on the projector instead (guide bar, or Priya's meal promise on `/demo`) | "Here's her meal promise, hand-off by hand-off." |
| any | Tunnel or Wi-Fi down | Laptop hotspot; or play the backup video | "Here's the same run from this morning." |

## 2-minute cut (Acts 1, 2, 4, 5)
Before the pitch: on `/demo` press **Start**, then **Next**, and fill Priya's form on her phone as in Act 1 (ending on **Confirm AVML**). Leave the phone on **Your meal promise**. Keep the iPad online: it can only download at Act 5, when the sim clock reaches 03:35.

| Time | Act | Do | Say |
|---|---|---|---|
| 0:00 | 1 | Show Priya's phone on **Your meal promise** (done before the pitch). | "Priya said what she can't eat; the rules picked AVML with *no onion, no garlic*." |
| 0:15 | 2 | `/demo` **Next** → open the 23C alert → `/demo` **Next** → **Request again** → **Approve and send**. | "A rebooking dropped her meal. Caught 1 h 38 m before the caterer's list; a person approves the fix." |
| 0:50 | 4 | `/demo` **Next** → **Do it for me: Acknowledge v3** → **Next** → `/ops/late`: `31K` → **Jain** → **Find a safe meal** → **Reserve**. | "A Jain request at the gate: every meal on board checked, the reason for every no." |
| 1:30 | 5 | `/demo` **Next** → iPad **Download for flight**, airplane mode → `/demo` **Next** → **2 · Seat service** → **23C** → `CTUS6P` red → **23C** → `7K2Q9F` green. | "Offline at the seat: wrong tray stopped, right tray served." |
| 1:55 | 6 | `/demo` **Next** → `/insights`. | "Five hand-offs, one break, fixed in 7 minutes." |

## Numbers you can say (all measured on our build)
- **625** rule test cases give identical answers on the server and the offline tablet (pytest and vitest, run on every ship).
- Lost meal caught **1 h 38 m** before the caterer's final list and fixed in **7 min**: *in our demo*, simulated clock.
- The matcher checks **10** meal options on board for Mr Mehta in milliseconds on the demo laptop (CP-SAT, 2 s limit, greedy fallback). Read the exact "CP-SAT · N ms · N meals checked" off the screen on the day.

## Walkthrough video (for rehearsing)
A 7-minute walkthrough of this run is on Gunagye's laptop: `D:\Hackathons\Thapar Japan Hackathon\ThaliBento-demo-walkthrough.mp4`. It shows every click on the projector, Priya's phone, a judge's phone and the iPad, with these lines as captions. Watch it before dry run 1; it can also stand in for the backup video until the 07:30 recording exists.

## After the demo
Leave `/insights` up for questions. Before any re-run: `/demo` → **Reset** (keep judges).
