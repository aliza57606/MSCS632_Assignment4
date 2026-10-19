# Employee Weekly Shift Scheduler

A 7-day employee scheduler implemented separately in **Python 3** and **JavaScript (Node.js 18+)**. Both programs demonstrate conditional statements, nested loops, branching, arrays/lists, maps/dictionaries, and random selection. No third-party dependencies.

## Requirements covered

- Input employee names and **ranked** daily preferences, via interactive command-line questions or an editable `employees.json` file.
- Schedule **exactly two** staff in morning, afternoon and evening every day (42 slots per week).
- Limit each employee to **one shift per day** and **five shifts per week**.
- Prefer first-choice shifts; when that shift is filled, use next-best available shift on the same day, or a later day. (Preferences are not hard availability restrictions.)
- Fill understaffed shifts from remaining eligible employees, using random tie-breaking.
- Detect invalid or unachievable schedules, retry alternate random tie-breaks, and verify all three staffing rules.
- Print a seven-day schedule and summary of workdays per employee.

**Important:** At least 9 employees are mathematically required: 7 days × 3 shifts × 2 people = 42 assignments; one employee can fill at most 5 assignments. The included example uses 12 employees. With less than 9 the programs print an error rather than a fake schedule.

## Run the programs

From the project root:

```bash
python3 python/employee_scheduler.py
node javascript/employee_scheduler.js
```

To enter employee names and preferences through the console, use:

```bash
python3 python/employee_scheduler.py --interactive
node javascript/employee_scheduler.js --interactive
```

Each program will ask for names and rankings for all seven days. Enter a blank employee name when finished. For a daily ranking, type, for example, `evening,morning,afternoon`, or press Enter to use the default `morning,afternoon,evening`.

To edit employees faster, change `employees.json`: each employee needs a distinct `name` and a `preferences` object with all seven days. Each day's preference list must contain all three shift names, in priority order. The sample file demonstrates the format.

To change random seeds:

```bash
python3 python/employee_scheduler.py --seed 25
node javascript/employee_scheduler.js employees.json 25
```

To run the Python tests:

```bash
python3 -m unittest discover -s python -p 'test_*.py' -v
```

To run JavaScript tests:

```bash
node --test javascript/test_scheduler.js
```

## How the scheduling logic works

1. Load/collect employee names and seven daily preference rankings; reject malformed or duplicate data.
2. For each day, process shifts with fewer first-choice volunteers first.
3. For each open slot, consider only employees with fewer than five assigned workdays who have not already been scheduled that day.
4. Select the person with the **best preference rank** for that shift; next balance by workdays so far; break ties randomly.
5. If a first choice is already full, the employee may be assigned to another shift or later day. This is a *soft-preference* scheduler: it may place staff in a lower-ranked shift to meet mandatory staffing.
6. Retry with new tie-breaking choices if a greedy attempt gets stuck. Validate the finished schedule.

This is a randomized greedy scheduler, **not** an exhaustive or mathematically optimal preference-matching algorithm. Although it works with the included example, a greedy retry strategy is not guaranteed to find a schedule for every arbitrary input. Employees are assumed available for all three shifts unless availability constraints are added separately.

## Files

- `python/employee_scheduler.py`: Python application.
- `python/test_scheduler.py`: Python validation tests.
- `javascript/employee_scheduler.js`: JavaScript application.
- `javascript/test_scheduler.js`: JavaScript validation tests.
- `employees.json`: 12 sample employees and ranked preferences.
- `screenshots/`: captured console output and submission images.
- `submission/`: editable Word document and PDF submission template.

