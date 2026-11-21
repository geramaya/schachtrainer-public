# Sound sources

## Own set "Holz" (`sounds/*.mp3`)

Own synthesis, `tools/gen-sounds.py` (reproducible, Python stdlib), converted with `tools/gen-sounds.sh`. No third-party recordings.

## Sets SFX, Piano, NES, Futuristic (`sounds/<set>/*.mp3`)

- Author: Enigmahack (https://github.com/Enigmahack), license AGPLv3+ (lila `COPYING.md`, retrieved 2026-11-21; text in `LICENSE-AGPL-3.0.txt`,
  downloaded 2026-11-21 from https://www.gnu.org/licenses/agpl-3.0.txt, sha256 `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`).
- Source: https://github.com/lichess-org/lila, commit `3692b7b3bdf5de5da92877802b2e80168b4d77a6`, folder `public/sound/<set>/`
  (`COPYING.md` names the path `public/sounds/<set>`; in this commit the folder is `public/sound/`).
- Files are copied unchanged. Only these four sets are used. The Lichess standard set is not free and is not used.

| Our file | lila file | Remark |
|---|---|---|
| `move.mp3` | `Move.mp3` | |
| `capture.mp3` | `Capture.mp3` | |
| `check.mp3` | `Check.mp3` | lila `Checkmate.mp3` is a link to `Check.mp3` |
| `end.mp3` | `Victory.mp3` | game end |
| `correct.mp3` | `GenericNotify.mp3` | lila `Confirmation.mp3` links to `GenericNotify.mp3` |
| castling, promotion | - | no such sound in the sets (Lichess plays `Move`): our `move.mp3` of the set is used |
| wrong | - | lila `Error.mp3` links to `../standard/Error.mp3` (non-free standard set): our own tone `sounds/wrong.mp3` is used |

SHA-256 of the copied files:

```
d043743b359844536b991600253453de9d3f95d6ca4688f25ec3eebcf0316874  futuristic/capture.mp3
dcc348cfb2f84bfa12daab3ea40b2970c41e9b33df8818a7788774bf485c312d  futuristic/check.mp3
088b8c3b986dffe36b52c15e67dd36589a709c5457c8c7e2a626cf150fcd45d5  futuristic/correct.mp3
43abe23ee2bce78b99ba1977429c7ddfe36b4f7f0dd41b37b5e2f341ca86607c  futuristic/end.mp3
e68edeb6dfc9d0510b553c7d94adbb249c07e52c8e1c6ae1a207dea56c08195a  futuristic/move.mp3
db0fee5a96c0638548e2f2522dce6541ca0e6a3cf75b50e0092817d9e00ecbb9  nes/capture.mp3
0d7f8760ffafa45baf1a7e9deafa398bf3aedbe76ab5bd0dbf03055c2697d6ef  nes/check.mp3
b3eee508d3d69176cb6d336a12e9def5992621ddec135d349d4085be9252500e  nes/correct.mp3
902489d7f8fc96cd557040124e9b67c5095242f4af339c267e8ae3bb1851fc67  nes/end.mp3
dd2537a1fe4e769cf81f2243a886869cecc747c03fc74302c26e82d1d30444f0  nes/move.mp3
3fe6ce347463fe2e1f31bdbcd936945b3e550c97569ac8d5e6b7ac3487a5f244  piano/capture.mp3
5f92c1c4b0e0d2af07de5d4b00702b16a4e77f83d4577cfce0d655b5acc1ccd0  piano/check.mp3
9ba65764ef6855e0af95ea1f313f6d04bc4b55ea59363d55fbc4def9e8cc21eb  piano/correct.mp3
71e06cd46e18fa9472b0fbd058ac88f4b1a07ecdff6bb45d413694fd23afa729  piano/end.mp3
2c681c2638ddaf4e18deebc36e5a2ee481c69ef6c6435597e672b73c5c078715  piano/move.mp3
59b9de82710ea30968312902bf7ac8334a1da620ee364e231ef9454f8648f2d2  sfx/capture.mp3
efaa7ae9a88025b6678de680441d806ce55e1a49f9009305235c5cd63a226093  sfx/check.mp3
128c00ae75c7b152e513cbd274a10e9acb28d3375388c2366936ed08d353ebdd  sfx/correct.mp3
1821e541f533e3e6214d9b05a80b2edc3600ce1fbf8700d014315c9570b93d72  sfx/end.mp3
0b4bbf4b0bc0cd937f9661820da4f6e9c5b821913a32502d3b571e6730f7c984  sfx/move.mp3
```
