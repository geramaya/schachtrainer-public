import importlib.util
import os
import tempfile
import unittest
import wave

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('gen_sounds', os.path.join(HERE, '..', 'tools', 'gen-sounds.py'))
gs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gs)

NAMES = ['move', 'capture', 'check', 'castle', 'promote', 'wrong', 'end', 'correct']


class GenSounds(unittest.TestCase):
    def test_all_sounds_exist(self):
        self.assertEqual(sorted(gs.SOUNDS), sorted(NAMES))

    def test_deterministic(self):
        for n in NAMES:
            self.assertEqual(gs.synth(n), gs.synth(n), n)

    def test_peak_is_minus_3_dbfs(self):
        for n in NAMES:
            peak = max(abs(x) for x in gs.synth(n))
            self.assertAlmostEqual(peak, 10 ** (-3 / 20), delta=0.01, msg=n)

    def test_no_click_at_start_and_end(self):
        for n in NAMES:
            s = gs.synth(n)
            self.assertLess(abs(s[0]), 0.02, n)
            self.assertLess(abs(s[-1]), 0.02, n)

    def test_durations(self):
        ms = {n: len(gs.synth(n)) * 1000 / gs.RATE for n in NAMES}
        self.assertTrue(60 <= ms['move'] <= 130, ms['move'])
        self.assertTrue(ms['capture'] > ms['move'], ms)
        self.assertTrue(450 <= ms['end'] <= 800, ms['end'])

    def test_sounds_differ(self):
        self.assertEqual(len({tuple(gs.synth(n)[:400]) for n in NAMES}), len(NAMES))

    def test_writes_mono_16bit_wav(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'move.wav')
            gs.write_wav(p, gs.synth('move'))
            with wave.open(p) as w:
                self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, gs.RATE))


if __name__ == '__main__':
    unittest.main()
