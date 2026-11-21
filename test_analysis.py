import unittest
from datetime import date, timedelta

from analysis import analyze


def entry(i, screen=90, focus=45, pickups=10):
    return dict(date=str(date(2026, 1, 1) + timedelta(days=i)), screen=screen,
                focus=focus, pickups=pickups, mood=3)


class PatternTests(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(analyze([]), {"count": 0, "averages": {}, "pattern": None})

    def test_two_recurring_routines(self):
        rows = [entry(i) for i in range(3)] + [entry(i, 300, 12, 75) for i in range(3, 6)]
        result = analyze(rows)
        self.assertEqual(result["averages"]["screen"], 195)
        self.assertEqual([p["screen"] for p in result["pattern"]], [90, 300])
        self.assertEqual(result, analyze(rows[::-1]))

    def test_insufficient_variation(self):
        self.assertIsNone(analyze([entry(i) for i in range(7)])["pattern"])
        self.assertIsNone(analyze([entry(i) for i in range(5)]+[entry(5, 400)])["pattern"])

    def test_invalid_records(self):
        for rows in ([entry(0)] * 2, [entry(0, -1)], [entry(0, True)], [{}]):
            with self.assertRaises(ValueError):
                analyze(rows)
