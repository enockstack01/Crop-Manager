# Real-device test pack

Nothing in this list has been run on a real phone yet. The automated tests (`npm run test:all --workspace server`, the three `mobile/scripts/test-*.mjs`) prove the rules; only phones prove speed, memory and heat. Run it on **at least**: a 3–4 GB Android, a 6 GB+ Android, and an iPhone (needs an EAS build). Record results in the table at the end.

## Setup
- Install the release build. Note model, Android/iOS version, free storage, RAM.
- Automated flows: `maestro test mobile/.maestro/offline-mode.yaml` and `offline-first-launch.yaml`.

## 1. Automatic download
| # | Step | Expected |
|---|------|----------|
| 1 | Install, open on **Wi-Fi** with ≥ 1.2 GB free | Download of the offline assistant starts by itself and shows progress |
| 2 | Same on **mobile data only** | It does **not** start; the screen says it waits for Wi-Fi |
| 3 | Press "Download now on mobile data" | It starts |
| 4 | Turn Wi-Fi off mid-download, wait 1 minute, back on | It stops, then continues from the same place without starting over |
| 5 | Close the app mid-download, reopen | Continues from where it stopped; no restart from zero |
| 6 | Fill storage so < 1.2 GB is free | It does not start and says how much to free |
| 7 | **2 GB phone** | It does not download and says the phone has too little memory |
| 8 | Finish the download | "Ready"; the 2.8 GB test model of the earlier build, if present, is gone |
| 9 | Tamper: replace the finished file with a same-size different file (developer build) | Next download attempt refuses it as damaged |

## 2. Offline mode
| # | Step | Expected |
|---|------|----------|
| 1 | Signed in, airplane mode on, wait 5–10 s | Offline screen with only "Scan a leaf" and "Ask a question"; no sign-in, no other features |
| 2 | Airplane mode off | App returns by itself to where you were, still signed in |
| 3 | Clear data, airplane mode, launch | Opens in offline mode, no sign-in asked |
| 4 | Sleep/cut the **server** but keep the internet | App stays in normal mode (internet is judged by a neutral address, not our server) |
| 5 | Weak signal flicker (toggle quickly 3×) | No flashing between screens |

## 3. Offline AI quality and cost (record numbers)
| # | Step | Record |
|---|------|--------|
| 1 | Scan 10 leaf photos offline | seconds per scan; correct crop/disease? |
| 2 | Write the treatment note for 5 of them | seconds; peak RAM; battery %; temperature |
| 3 | Ask the 22 questions in `docs/eval/offline-questions.json`, save replies, score with `server/src/scripts/score-offline-answers.mjs` | passes / 22; seconds per answer |
| 4 | Ask 5 questions in a row | does the app get killed? slows down? |
| 5 | Leave the app 3 min, ask again | model reloads without error |

## 4. Online features on device
Sign in, add a farm record, diagnose a photo (online), switch language, notifications, weather permission prompt, PDF report. Organization account: invitations list, farmer records, activity log.

## Results
| Device | Android/iOS | RAM | Download OK | Offline mode OK | Scan s | Note s | Peak RAM | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
