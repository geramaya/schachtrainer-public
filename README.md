# Schachtrainer

Local browser trainer for a personal opening repertoire ("Schach-Architektur v1.8", `docs/repertoire-v1.8.md`).
UI language German, code English.

## What it does

Ten openings (Scotch, Smith-Morra, Caro-Kann, Budapest, King's Indian, Italian, Alapin, Vienna, Nimzo-Indian,
Tarrasch), each with its named variations. Every variation runs through four stages:

1. **Lernen** – play through the main line with explanations and goal position (audio where available).
2. **Verstehen** – questions on plans, threats and typical mistakes.
3. **Festigen** – spaced repetition of your own moves (drill), plus puzzles from Lichess games of this opening.
4. **Anwenden** – react to deviations and play on against Stockfish (sparring).

The coach explains positions deterministically (chess.js features + Stockfish, every engine claim labelled with its
depth). Lines run at least 28 half-moves (gambits up to 36); shorter only when they end in mate or a forced repetition.

Next to every board runs a Lichess-style engine field (switch on/off, evaluation bar, 1-5 MultiPV lines with live depth,
arrows, hover preview, `#/analyse` board). In exercises it stays locked until the answer is given. Design:

## Run

```bash
npm ci            # packages are pinned via audited overrides – do not upgrade without a supply-chain review
npm run engine    # copies the Stockfish WASM build to public/engine/
npm run dev       # http://localhost:5173
```


## Check

```bash
npm test          # node --test, ~330 tests
npm run typecheck
npm run build
```

## Content pipeline

`npm run content` builds `public/content/bundle.json` (schema 3) from `content-src/`, the chess-openings dataset
(CC0), the Lichess puzzle database and the Lichess Opening Explorer (token via `LICHESS_TOKEN_FILE`), with Stockfish
depth 18 as the reference. All move claims are engine-verified; failing claims are dropped, never thresholds changed.
`--only <openingId>` rebuilds one opening and merges it into the bundle. A second run from `tools/.cache` must yield the
same `contentVersion`.

Audio: `npm run audio:texts`, then `python3 tools/gen-audio.py --key-file <openrouter key>` (run by the owner only).

Teacher quips (Sparring, setting "Sprüche", off by default; texts in `src/teacher/quips-data.ts`) and their spoken versions:
one command from the project folder does everything (texts, plan, generation; existing files are skipped, the manifest is updated):

    npm run audio:lehrer -- <path-to-openrouter-key>

(the key path is optional, that is the default; the key is never printed). Before that:
`npm run audio:lehrer -- --dry-run` shows the number of requests (no key, no network);
`npm run audio:lehrer -- --proben` writes one German sample with an expression tag for each of the 21 ElevenLabs voices to `public/audio/proben/elevenlabs/` (costs about 0.10 USD, counts against the cap; listen, then delete the folder); `--proben-heygen` does the same with the old HeyGen voices.
Quips are spoken with `elevenlabs/eleven-v4` via OpenRouter (80 USD per million characters, mp3 directly); explanations stay with HeyGen/nadine.
Model, voices and expression tags per teacher are set in ONE place: `content-src/audio/quip-voices.ts` (preliminary: Jonas chris [cheerful],
Mira alice [sarcastic], Meister Aldo bill [warm], Fuchs Ferro callum [mischievous]). After a change run the command again: texts with a changed voice, tag or model are generated anew.
Cost: the plan shows characters x price before the run; every paid request is booked in `tools/laufzeit/lehrer-audio.json` and no request is sent that would exceed the cap `--deckel` (default 4.30 USD for everything under the ledger name, samples included; `--lauf NAME` starts a new ledger).
Order for the owner: `npm run audio:lehrer -- --dry-run`, then `npm run audio:lehrer -- --proben`, listen, adjust `quip-voices.ts`, then `npm run audio:lehrer` (a stopped run continues where it ended).
Quips with placeholders ({zug}, {figur}) get no audio. The app plays what is in `public/audio/manifest.json` and stays silent
for the rest; "Sprüche vorlesen" appears only when the manifest holds quip audio.

## Desktop app

A Tauri 2 shell (Linux `.deb`, Windows NSIS installer) is built by the GitHub Actions workflow
`.github/workflows/desktop.yml` in the private repo. Run it via *Actions -> desktop -> Run workflow*
(or push a `v*` tag) and download the artifact `schachtrainer-linux-deb` / `schachtrainer-windows-nsis`

- The programs are unsigned: Windows SmartScreen warns ("More info" -> "Run anyway").
- The installer never goes online; Windows 10 needs WebView2 preinstalled (Windows 11 has it).
- The learning state lives in the app's own browser storage, not in the web version's. To move it over,
  use *Export* in the web version and *Import* in the desktop app.
- External links are shown as plain text in the app; nothing opens outside the window.

## Web version (GitHub Pages)

Playable at https://geramaya.github.io/schachtrainer-play/ (audio included). The workflow
`.github/workflows/mirror.yml` of the development repo runs on every push to `main` or `release`: it exports a cleaned
copy of the sources (`tools/mirror-public.sh`, aborts if internal terms are found) into the same branch of
`geramaya/schachtrainer-public`. On `release` it then builds exactly that public state with
`VITE_BASE=/schachtrainer-play/` and replaces the content of `geramaya/schachtrainer-play` (deploy keys as secrets
`SCHACHTRAINER_PUBLIC_DEPLOY_KEY` and `SCHACHTRAINER_PLAY_DEPLOY_KEY`). Local check with a base path:
`VITE_BASE=/schachtrainer-play/ npm run build && npx vite preview --base /schachtrainer-play/`.
All asset paths go through `publicUrl()` (`src/ui/assetBase.ts`); the default base `/` keeps dev, preview and the
desktop app unchanged. Licence and third-party notice (`NOTICE.md`) are copied into the play repo.

## Sounds

Chess sounds (move, capture, check, castling, promotion, wrong, correct, game end) are our own synthesis
(`tools/gen-sounds.py`, Python stdlib, deterministic; `bash tools/gen-sounds.sh` writes `public/sounds/*.mp3`, needs ffmpeg).
Töne: eigene Synthese (`tools/gen-sounds.py`), keine fremden Aufnahmen. On/off in the top bar, volume under "Über".
Test: `python3 -m unittest test/test_gen_sounds.py`.

Further sound packs (choose under "Über"): SFX, Piano, NES, Futuristic. Sounds: Enigmahack (github.com/Enigmahack), AGPLv3+, via
lichess-org/lila; pinned commit, file hashes and mapping in `public/sounds/SOURCES.md`, license text in `public/sounds/LICENSE-AGPL-3.0.txt`.
The Lichess standard set is not free and is not used.

## Docs

- Visual concept: `docs/design/2026-11-20-design-konzept.md`

## License note

Copyright (C) 2026 geramaya. This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License version 3 or (at your option) any later version; see `LICENSE`.

Third-party parts: chessground and Stockfish (GPL-3.0), chess.js (BSD-2-Clause), cburnett piece set (GPL-2.0-or-later,
via chessground), Lichess puzzle database and chess-openings dataset (CC0). Audio files were generated with HeyGen and
ElevenLabs via OpenRouter; check their terms before redistributing them. The repository is currently private.
