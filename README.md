# 💧 Water Wars

A real-time multiplayer science card game about the three properties of water: **cohesion**, **adhesion** and **surface tension**. Two to six players join a room with a 5-character code from any phone, tablet or computer, then play **Classic** (UNO + Go Fish) or **Battle** (drop vs. drop) mode. Science questions are part of the moves themselves: banking a set, boosting an attack, classifying a real-world example and challenging an opponent all require answering correctly.

<p align="center">
  <img src="docs/screenshots/menu-mobile.png" width="200" alt="Main menu" />
  <img src="docs/screenshots/question-mobile.png" width="200" alt="Science question" />
  <img src="docs/screenshots/results-mobile.png" width="200" alt="Results" />
</p>

---

## Contents
1. [Deploying (about 10 minutes)](#deploying-about-10-minutes)
2. [Environment variables](#environment-variables)
3. [How to play](#how-to-play)
4. [Architecture](#architecture)
5. [Local development & tests](#local-development--tests)
6. [Free-tier notes](#free-tier-notes)
7. [Troubleshooting](#troubleshooting)

---

## Deploying (about 10 minutes)

Netlify hosts the website and the game server (a Netlify Function). **Firebase** (free *Spark* plan) provides the realtime connection between devices and anonymous sign-in. Netlify cannot hold persistent connections itself, so you need both. No credit card is required for either.

### Step 1: Create the Firebase backend

1. Go to <https://console.firebase.google.com> → **Create a project** (Google Analytics can be turned off).
2. **Anonymous sign-in:** *Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.*
3. **Realtime Database:** *Build → Realtime Database → Create database.* Pick a location and choose **Start in locked mode**.
   Copy the database URL shown at the top of the *Data* tab, e.g. `https://my-project-default-rtdb.firebaseio.com`
   (regional databases look like `https://my-project-default-rtdb.europe-west1.firebasedatabase.app`).
4. **Security rules:** in Realtime Database → **Rules**, replace everything with the contents of [`database.rules.json`](database.rules.json) and click **Publish**.
   These rules let players read only their own room and their own hand, and stop clients from writing any game state.
5. **Web API key:** *Project settings (⚙️) → General → Your apps → Add app → Web (`</>`)*. Give it any name and register it (hosting is not needed). Copy the `apiKey` value from the config snippet.
6. **Service account (server key):** *Project settings → Service accounts → Generate new private key.* A `.json` file downloads. **Keep it secret.** Only Netlify should have it.

### Step 2: Deploy to Netlify

1. In Netlify: **Add new site → Import an existing project →** pick this GitHub repository.
   The build settings are read from [`netlify.toml`](netlify.toml) (build `npm run build`, publish `dist`, functions `netlify/functions`), so leave them alone.
2. Before or after the first deploy, open **Site configuration → Environment variables** and add:

   | Key | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | Paste the **entire contents** of the downloaded service-account `.json` file |
   | `FIREBASE_WEB_API_KEY` | The `apiKey` from step 1.5 |
   | `FIREBASE_DATABASE_URL` | The database URL from step 1.3 |

3. **Deploys → Trigger deploy → Deploy site.** Environment variable changes only take effect after a redeploy.
4. Open your site URL (e.g. `https://water-wars-xyz.netlify.app`) and share it. Players tap **Play → Create Room**, then share the room code or the **Invite link**.

If something is missing, the site shows a **"Almost ready to play!"** screen listing the variables that still need to be set.

> **Optional hardening:** in Google Cloud Console → *APIs & Services → Credentials*, restrict the browser API key to your Netlify domain. The game works without this; the key is public by design and the security rules protect the data.

---

## Environment variables

All configuration lives in Netlify's environment variables. The browser fetches its public Firebase config from `/api/config` at runtime, so there are **no build-time variables** and nothing secret is ever bundled into the site.

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | 🔒 yes | Service-account JSON (raw or base64). Lets the server write game state. |
| `FIREBASE_WEB_API_KEY` | ✅ | no | Public web key used for anonymous sign-in in the browser. |
| `FIREBASE_DATABASE_URL` | ✅ | no | Realtime Database URL. |
| `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | alternative | 🔒 | Use these three instead of `FIREBASE_SERVICE_ACCOUNT` if you prefer (`\n` in the key is handled). |

Netlify passes at most ~4 KB of environment variables to functions; a service-account JSON is ~2.3 KB, so this fits.

---

## How to play

Every card is linked to cohesion, adhesion or surface tension. There are **42 unique cards** (67 in the deck) in seven categories: Cohesion, Adhesion, Surface Tension, Challenge, Action, Real-World and Power-Up. The bank holds **40 science questions** plus 6 real-world classification cards, including combination questions such as *"Water rises in a narrow tube. Explain cohesion AND adhesion."* The full rules and a browsable card library with explanations are in the app under **How to Play**.

### Classic mode (UNO + Go Fish), with the highest score winning
* 7 cards each. Match the **active property** (the color of the pile), play the same card, or play a wild.
* **Free actions** (start of turn): **Bank a set** of 3 same-property cards and answer a question (correct +6, wrong +2), or **offer a trade** to another player.
* **Main action:** play a card (property cards score points), **draw**, or **Go Fish** (ask an opponent for a property; if they don't have one, draw and your turn ends).
* **Challenge cards** quiz an opponent. **Real-world cards** are wild: name the property shown for +3.
* The first player to empty their hand gets **+10** and ends the game; otherwise it ends after 10 rounds.

### Battle mode, with the last drop standing winning
* Every player is a drop with **20 HP**; draw 1 at the start of each turn.
* One **Power-Up** per turn is free (shields, heals, H-Bond Boost for double damage).
* Then play one card: **attack** with a property card, risk a **Science Boost** (correct = double damage, wrong = fizzle), or launch a **Combo** of two different properties with a combination question. Challenges, real-world cards and actions (Soap Disruptor pops shields, Surfactant Splash hits everyone) add variety. Or **Rest** to draw 1 and heal 1.
* After round 10 a **drought** drains 1 HP per turn, so games always finish.

Turns have a 90-second timer (45 s for questions, 30 s for trades). A disconnected player's turn is skipped automatically after 20 seconds, so nobody can stall the game.

---

## Architecture

```
Browser (React + TS, Vite)                Netlify Function  /api/*            Firebase
───────────────────────────               ─────────────────────────          ─────────────────────────
• Anonymous sign-in ───────────────────────────────────────────────────────▶ Auth
• POST /api {op, action} + ID token ────▶ verify token (firebase-admin)
                                          run game engine (server/engine.ts)
                                          RTDB transaction on rooms/{code} ─▶ Realtime Database
• realtime listeners ◀──────────────────────────────────────────────────────  rooms/{code}/public    (everyone in room)
                                                                              rooms/{code}/private/{uid} (only you)
• presence (online/offline) ────────────────────────────────────────────────▶ presence/{code}/{uid}
```

* **Server-authoritative:** clients only send *intents* ("play card X on player Y"). The function validates turn order, card ownership, matching rules and targets, resolves outcomes, and writes the new state inside a database **transaction**, so simultaneous requests are serialized.
* **Hidden information stays hidden:** the full state (deck order, all hands, answer keys) is stored in `rooms/{code}/secret`, which no client can read. Each player can read only the public view and their own hand. The question bank and answers live in `server/answers.ts` and are never shipped to the browser.
* **Room access:** only room members (added by the server on join) can read a room. Clients cannot write anything except their own presence flag.
* **Reconnects:** identity is a persistent anonymous Firebase user, so reloading or losing signal drops you back into your seat with your hand intact.
* **Cleanup:** rooms older than 8 hours are deleted automatically when new rooms are created.

```
src/shared/      card database + types shared by client and server
src/client/      Firebase client, API client, realtime room hook, settings, sound
src/components/  card component, 39 original SVG card illustrations, UI primitives
src/screens/     Menu, Lobby, Game, Results, How to Play, Settings
server/          engine.ts (rules), answers.ts (answer key), handler.ts (API), views.ts, firebase.ts
netlify/functions/api.mts   the deployed function (thin wrapper around server/handler.ts)
database.rules.json         Realtime Database security rules
tests/           engine unit + fuzz tests, security integration tests
```

---

## Local development & tests

Requirements: Node 20+ and Java 11+ (for the Firebase emulators).

```bash
npm install
npm run dev          # Firebase emulators + local API (same handler as the Netlify function) + Vite
# open http://localhost:5173 in two different browsers (or one normal + one private window)
```

`npm run dev` downloads `firebase-tools` via `npx` on first run. No Firebase project is needed locally: the emulators use the demo project `demo-water-wars`.

| Command | What it does |
|---|---|
| `npm test` | Engine tests: card database checks, rules enforcement, hidden-info checks, plus **600 fuzzed full games** (both modes, 2–6 players) asserting card conservation, termination and that rejected moves never change state |
| `npm run test:security` | With `npm run dev` running: 32 integration checks against the live API + database rules (auth, other hands unreadable, no client writes, turn enforcement, concurrency) |
| `npm run build` | Typecheck + production build into `dist/` |

### What was tested
* Two (and four) separate browser contexts creating, joining, readying and starting rooms; full **Classic** and **Battle** games played to the results screen by clicking through the real UI, with a consistency check after every move that both clients show the same deck count, discard pile and hand sizes (0 mismatches).
* The same full-game run against the **production build** and against the function **as bundled by Netlify CLI** (`netlify functions:serve`).
* Reload mid-game (hand restored), a player disappearing mid-turn (shown offline, turn auto-skipped after the grace period) and rejoining.
* Phone (360×640, iPhone 13), tablet (768×1024) and laptop layouts, with no horizontal overflow.

**Not tested from here:** a live Firebase project and a real Netlify deployment, since no accounts were available in the build environment. Everything below that line (function code, security rules, realtime sync) was exercised against the official Firebase emulators and Netlify's own function bundler.

---

## Free-tier notes
* **Firebase Spark (free):** 100 simultaneous connections (each open game tab is one; plenty for a class), 1 GB stored, 10 GB/month downloaded. A game uses kilobytes.
* **Netlify free:** the function is called once per page load (`/api/config`) and once per move, with no polling. Realtime updates come from Firebase, not Netlify.
* To shut it down afterwards, delete the Netlify site and the Firebase project.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Almost ready to play!" screen | Add the listed environment variables in Netlify and **redeploy**. |
| "Your session expired" / 401 errors | Anonymous sign-in isn't enabled (step 1.2), or `FIREBASE_WEB_API_KEY` belongs to a different project. |
| Stuck on "Connecting to room…" | Security rules weren't published (step 1.4) or `FIREBASE_DATABASE_URL` is wrong (check the region). |
| `SERVER` errors | Check *Netlify → Logs → Functions → api*. Usually a malformed `FIREBASE_SERVICE_ACCOUNT` (paste the whole JSON file). |
| Two tabs act as the same player | Expected: identity is per browser. Use a private window or another device for a second player. |
