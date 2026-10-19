"""Employee shift scheduler: Python version (standard library only).

Each shift has exactly two employees, each employee works at most once a
 day and five times a week. Preferences are soft priorities, not hard availability.
"""
# Standard-library tools for command-line options, JSON data, and reproducible randomness.
import argparse
import json
import random
from pathlib import Path

# Keep the business rules in one place so they are easy to adjust.
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
SHIFTS = ['morning', 'afternoon', 'evening']
MAX_DAYS = 5
STAFF_PER_SHIFT = 2


def load_employees(path):
    """Load and validate employee names and daily ranked preferences."""
    # Read employee records from the shared JSON file used by both languages.
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data, list) or not data:
        raise ValueError('Employee data must be a nonempty JSON array.')
    # A set provides efficient duplicate-name detection (case insensitive).
    seen = set()
    for person in data:
        name = person.get('name')
        preferences = person.get('preferences')
        if not isinstance(name, str) or not name.strip() or name.lower() in seen:
            raise ValueError('Names must be unique, nonempty strings.')
        seen.add(name.lower())
        # Every employee must provide ranked preferences for every weekday.
        if not isinstance(preferences, dict) or set(preferences) != set(DAYS):
            raise ValueError(f'{name}: provide preferences for all 7 days.')
        for day in DAYS:
            # Each day's ranking must contain each shift exactly once.
            ranked = preferences[day]
            if not isinstance(ranked, list) or sorted(ranked) != sorted(SHIFTS):
                raise ValueError(f'{name}, {day}: rank morning, afternoon, evening once each.')
    return data


def collect_employees():
    """Optional interactive entry; blank preference uses morning/afternoon/evening."""
    print('Enter at least 9 employees. Enter a blank name to finish.')
    people = []
    # A blank name finishes data entry; duplicate names are rejected.
    while True:
        name = input('Employee name: ').strip()
        if not name:
            break
        if any(p['name'].lower() == name.lower() for p in people):
            print('That employee already exists. Try again.')
            continue
        prefs = {}
        print('For each day, enter 3 shifts in priority order (e.g. morning,evening,afternoon).')
        print('Press Enter for the default morning,afternoon,evening ranking.')
        for day in DAYS:
            # Repeat the prompt until the user provides a valid ranking.
            while True:
                value = input(f'  {day}: ').strip().lower()
                ranked = [part.strip() for part in value.split(',')] if value else SHIFTS[:]
                if sorted(ranked) == sorted(SHIFTS):
                    prefs[day] = ranked
                    break
                print('Invalid ranking: use each of morning, afternoon, evening once.')
        people.append({'name': name, 'preferences': prefs})
    return people


def generate_schedule(employees, seed=42, attempts=500):
    """Build a schedule using preference-aware greedy assignment and restarts.

    A restart lets the scheduler try different tie-breaks if an early choice
    would leave too few eligible employees later in the week.
    """
    # Seven days x three shifts x two people = 42 assignments per week.
    required = len(DAYS) * len(SHIFTS) * STAFF_PER_SHIFT
    if len(employees) * MAX_DAYS < required or len(employees) < len(SHIFTS) * STAFF_PER_SHIFT:
        raise ValueError('Not enough employees: at least 9 employees are needed for 42 weekly slots.')
    # A local seeded generator makes runs repeatable for demonstrations/tests.
    rng = random.Random(seed)
    # Retry from an empty schedule if an earlier greedy choice blocks a later day.
    for _ in range(attempts):
        schedule = {day: {shift: [] for shift in SHIFTS} for day in DAYS}
        # Track each employee's weekly total to enforce the five-day limit.
        totals = {p['name']: 0 for p in employees}
        success = True
        for day in DAYS:
            # This set prevents assigning one person to multiple shifts today.
            used_today = set()
            # Staff the hardest-to-fill shifts first (those with few first choices).
            shift_order = sorted(SHIFTS, key=lambda s: (
                sum(p['preferences'][day][0] == s and totals[p['name']] < MAX_DAYS
                    for p in employees), rng.random()))
            # Process each shift, filling exactly STAFF_PER_SHIFT positions.
            for shift in shift_order:
                for _slot in range(STAFF_PER_SHIFT):
                    # Remove employees who are already working today or reached 5 days.
                    eligible = [p for p in employees if p['name'] not in used_today
                                and totals[p['name']] < MAX_DAYS]
                    # An unfilled position invalidates this attempt; restart.
                    if not eligible:
                        success = False
                        break
                    # Prefer an employee's requested shift; balance weekly load as
                    # secondary priority; randomize ties reproducibly.
                    best = min(eligible, key=lambda p: (
                        p['preferences'][day].index(shift), totals[p['name']], rng.random()))
                    # Commit the chosen assignment and update both constraints.
                    name = best['name']
                    schedule[day][shift].append(name)
                    used_today.add(name)
                    totals[name] += 1
                if not success:
                    break
            if not success:
                break
        if success:
            # Never return a schedule that fails the final business-rule checks.
            validate_schedule(schedule, employees)
            return schedule, totals
    raise ValueError('Could not generate a valid schedule. Try more employees or a different seed.')


def validate_schedule(schedule, employees):
    """Raise AssertionError if the schedule violates any staffing rule."""
    # Recompute totals independently rather than trusting the scheduler.
    known = {p['name'] for p in employees}
    counts = {name: 0 for name in known}
    assert set(schedule) == set(DAYS)
    for day in DAYS:
        assert set(schedule[day]) == set(SHIFTS)
        # Collect all names across a day to catch double bookings.
        assigned = []
        for shift in SHIFTS:
            people = schedule[day][shift]
            assert len(people) == STAFF_PER_SHIFT, (day, shift)
            assert all(person in known for person in people)
            assigned.extend(people)
        assert len(assigned) == len(set(assigned)), f'Double-booking on {day}'
        for name in assigned:
            counts[name] += 1
    assert all(value <= MAX_DAYS for value in counts.values()), counts
    return True


def print_schedule(schedule, totals):
    print('\nEMPLOYEE WEEKLY SHIFT SCHEDULE')
    print('=' * 93)
    print(f"{'DAY':<12} {'MORNING':<26} {'AFTERNOON':<26} {'EVENING':<26}")
    print('-' * 93)
    for day in DAYS:
        cells = [', '.join(schedule[day][shift]) for shift in SHIFTS]
        print(f'{day:<12} {cells[0]:<26} {cells[1]:<26} {cells[2]:<26}')
    print('=' * 93)
    print('WORKDAYS PER EMPLOYEE')
    # Display weekly workloads so the 5-day cap is easy to inspect.
    entries = [f'{name}: {count}' for name, count in sorted(totals.items())]
    for i in range(0, len(entries), 4):
        print(' | '.join(entries[i:i+4]))
    print('\nVALIDATION PASSED: 2 employees/shift, 1 shift/day, maximum 5 days/week.')


def main():
    # Default mode loads the example JSON; --interactive asks for new employees.
    parser = argparse.ArgumentParser(description='Generate a 7-day employee shift schedule.')
    parser.add_argument('--data', default=str(Path(__file__).resolve().parents[1] / 'employees.json'),
                        help='Path to employee preferences JSON file')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--interactive', action='store_true', help='Enter employees and preferences manually')
    args = parser.parse_args()
    try:
        # Input and scheduling failures are reported without an ugly traceback.
        employees = collect_employees() if args.interactive else load_employees(args.data)
        schedule, totals = generate_schedule(employees, seed=args.seed)
        print_schedule(schedule, totals)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        parser.exit(1, f'ERROR: {exc}\n')


if __name__ == '__main__':
    main()
