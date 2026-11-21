# Schachtrainer (playable web version)

Copyright (C) 2026 geramaya. This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License version 3 or (at your option) any later version. The license text is in
`LICENSE` next to this file.

Source code: https://github.com/geramaya/schachtrainer-public (GPL-3.0-or-later)

Third-party parts in this build:

- chessground (GPL-3.0), https://github.com/lichess-org/chessground
- Stockfish (GPL-3.0), https://github.com/official-stockfish/Stockfish, WebAssembly build via the npm package `stockfish`
- cburnett piece set (GPL-2.0-or-later, via chessground), by Colin M.L. Burnett
- chess.js (BSD-2-Clause), https://github.com/jhlywa/chess.js
- Lichess puzzle database and chess-openings dataset (CC0)
- Maia-2 (MIT), Copyright (c) 2024 CSSLab, https://github.com/CSSLab/maia2 - human-like move model, "rapid" weights
  (rapid_model.pt, SHA-256 65aae8465eed5e65df66a24ea7370715579f9e5435098d06fe18bdb1e267e997). The file
  `maia2/maia_rapid.onnx` is the unmodified ONNX export published by CSSLab in
  https://github.com/CSSLab/maia-platform-frontend (GPL-3.0), commit c2afeeaa96c7664dc9bb81954960b75ede7e4c20,
  path public/maia2/maia_rapid.onnx, SHA-256 027ddb8c1a8b7235b6e51827cffe325f9cb95fd4523dce65a131547c034ccfc9.
  It is not part of the source repository; `npm run maia` loads it at build time and checks the hash.
  License text: `maia2/LICENSE-maia2-MIT.txt`. Paper: Z. Tang, D. Jiao, R. McIlroy-Young, J. Kleinberg, S. Sen,
  A. Anderson, "Maia-2: A Unified Model for Human-AI Alignment in Chess", NeurIPS 2024, arXiv:2409.20553.
  Training data: Lichess standard rated games database (CC0). The board encoding, the Elo classes and the move
  vocabulary in `src/maia/` are ported from CSSLab/maia2 (MIT, commit 67bee6ce); the vocabulary is checked against
  `all_moves.json` of the frontend repository (same commit).
- ONNX Runtime Web 1.31.1 (MIT), Copyright (c) Microsoft Corporation, npm package `onnxruntime-web`;
  WebAssembly files in `ort/`. License and third-party notices: `ort/LICENSE`, `ort/ThirdPartyNotices.txt`.
- Sounds, set "Holz": own synthesis, `tools/gen-sounds.py`; no third-party recordings.
- Sounds: Enigmahack (github.com/Enigmahack), AGPLv3+, via lichess-org/lila (sets SFX, Piano, NES, Futuristic; commit and file hashes in `sounds/SOURCES.md`, license text in `sounds/LICENSE-AGPL-3.0.txt`)
- Audio files (teacher voices) were generated with HeyGen and ElevenLabs via OpenRouter.
