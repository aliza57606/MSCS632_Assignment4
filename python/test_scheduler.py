import unittest
from pathlib import Path
from employee_scheduler import load_employees, generate_schedule, validate_schedule, DAYS, SHIFTS

DATA = Path(__file__).resolve().parents[1] / 'employees.json'

class TestScheduler(unittest.TestCase):
    def setUp(self):
        self.people = load_employees(DATA)

    def test_42_staffed_slots(self):
        schedule, _ = generate_schedule(self.people)
        self.assertEqual(sum(len(schedule[d][s]) for d in DAYS for s in SHIFTS), 42)

    def test_no_double_booking_and_limits(self):
        for seed in range(40):
            schedule, totals = generate_schedule(self.people, seed)
            self.assertTrue(validate_schedule(schedule, self.people))
            self.assertTrue(all(v <= 5 for v in totals.values()))

    def test_understaffed_pool_rejected(self):
        with self.assertRaises(ValueError):
            generate_schedule(self.people[:8])

    def test_invalid_duplicate_name_rejected(self):
        import json, tempfile
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'invalid.json'
            p.write_text(json.dumps([self.people[0], self.people[0]]))
            with self.assertRaises(ValueError):
                load_employees(p)

if __name__ == '__main__':
    unittest.main()
