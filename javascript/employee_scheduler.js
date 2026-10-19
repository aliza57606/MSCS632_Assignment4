/** Employee shift scheduler: JavaScript (Node.js, no packages needed).
 * Preferences are priorities rather than hard availability restrictions.
 */
// Node.js built-ins: file loading, paths, and optional terminal input.
const fs = require('node:fs');
const path = require('node:path');
// Centralized scheduling rules, matching the Python implementation.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFTS = ['morning', 'afternoon', 'evening'];
const MAX_DAYS = 5;
const STAFF_PER_SHIFT = 2;

// Simple seeded random generator for reproducible conflict tie-breaking.
function makeRandom(seed) {
  // Convert the seed to an unsigned 32-bit integer.
  let state = seed >>> 0;
  return () => {
    // Linear congruential generator: advance to the next pseudo-random value.
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function loadEmployees(filePath) {
  // Read the same employees.json file as the Python scheduler.
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) throw Error('Employee data must be a nonempty JSON array.');
  // Sets make it easy to reject duplicate employee names.
  const names = new Set();
  for (const p of data) {
    if (typeof p.name !== 'string' || !p.name.trim() || names.has(p.name.toLowerCase())) {
      throw Error('Names must be unique, nonempty strings.');
    }
    names.add(p.name.toLowerCase());
    if (!p.preferences || Object.keys(p.preferences).sort().join() !== [...DAYS].sort().join()) {
      throw Error(`${p.name}: provide preferences for all 7 days.`);
    }
    // Require a complete, non-repeating ranking of all three shifts each day.
    for (const day of DAYS) {
      const ranked = p.preferences[day];
      if (!Array.isArray(ranked) || [...ranked].sort().join() !== [...SHIFTS].sort().join()) {
        throw Error(`${p.name}, ${day}: rank morning, afternoon, evening once each.`);
      }
    }
  }
  return data;
}

async function collectEmployees() {
  const readline = require('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const people = [];
  try {
    console.log('Enter at least 9 employees. Leave name blank to finish.');
    // Stop when the user enters an empty employee name.
    while (true) {
      const name = (await rl.question('Employee name: ')).trim();
      if (!name) break;
      if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        console.log('Duplicate name. Try again.');
        continue;
      }
      const preferences = {};
      console.log('Rank morning, afternoon, evening for each day (comma-separated). Enter for default.');
      for (const day of DAYS) {
        // Re-prompt until all three shift names appear exactly once.
        while (true) {
          const answer = (await rl.question(`  ${day}: `)).trim().toLowerCase();
          const ranked = answer ? answer.split(',').map(v => v.trim()) : [...SHIFTS];
          if ([...ranked].sort().join() === [...SHIFTS].sort().join()) {
            preferences[day] = ranked;
            break;
          }
          console.log('Invalid ranking; include each shift exactly once.');
        }
      }
      people.push({ name, preferences });
    }
  } finally { rl.close(); }
  return people;
}

function validateSchedule(schedule, employees) {
  // Validate independently of the generation algorithm.
  const known = new Set(employees.map(p => p.name));
  const totals = Object.fromEntries(employees.map(p => [p.name, 0]));
  if (Object.keys(schedule).sort().join() !== [...DAYS].sort().join()) throw Error('Missing day.');
  for (const day of DAYS) {
    // Combine all three shifts to detect an employee booked twice today.
    const assigned = [];
    for (const shift of SHIFTS) {
      const people = schedule[day][shift];
      if (people.length !== STAFF_PER_SHIFT || people.some(p => !known.has(p))) {
        throw Error(`Staffing error: ${day}, ${shift}`);
      }
      assigned.push(...people);
    }
    if (new Set(assigned).size !== assigned.length) throw Error(`Double-booking on ${day}`);
    for (const name of assigned) totals[name] += 1;
  }
  // No employee may work on more than five days of the week.
  if (Object.values(totals).some(n => n > MAX_DAYS)) throw Error('Weekly limit exceeded.');
  return true;
}

function generateSchedule(employees, seed = 42, attempts = 500) {
  // 7 days x 3 shifts x 2 employees = 42 slots, requiring >= 9 people.
  if (employees.length * MAX_DAYS < 42 || employees.length < 6) {
    throw Error('Not enough employees: at least 9 employees are needed for 42 weekly slots.');
  }
  // Use a predictable random sequence when given the same seed.
  const random = makeRandom(seed);
  // Restart if greedy choices lead to a shift with no eligible employees.
  for (let attempt = 0; attempt < attempts; attempt++) {
    const schedule = Object.fromEntries(DAYS.map(d => [d, Object.fromEntries(SHIFTS.map(s => [s, []]))]));
    // Weekly workload count enforces the maximum-five-days rule.
    const totals = Object.fromEntries(employees.map(p => [p.name, 0]));
    let success = true;
    for (const day of DAYS) {
      // A Set ensures an employee cannot work two shifts on the same day.
      const usedToday = new Set();
      // Schedule shifts with fewer first-choice volunteers first.
      const order = SHIFTS.map(shift => ({
        shift,
        firstChoices: employees.filter(p => p.preferences[day][0] === shift && totals[p.name] < MAX_DAYS).length,
        tie: random()
      })).sort((a, b) => a.firstChoices - b.firstChoices || a.tie - b.tie);
      for (const { shift } of order) {
        // Fill two positions in the current shift.
        for (let slot = 0; slot < STAFF_PER_SHIFT; slot++) {
          // Only consider employees who are free today and under 5 days.
          const eligible = employees.filter(p => !usedToday.has(p.name) && totals[p.name] < MAX_DAYS);
          // If staffing is impossible, abandon this attempt and retry.
          if (eligible.length === 0) { success = false; break; }
          // Resolve filled preferred shifts by trying 2nd/3rd choices.
          const ordered = eligible.map(p => ({ p, rank: p.preferences[day].indexOf(shift),
            load: totals[p.name], tie: random() }))
            .sort((a, b) => a.rank - b.rank || a.load - b.load || a.tie - b.tie);
          // Pick best preference rank, then lowest weekly load; break ties randomly.
          const name = ordered[0].p.name;
          schedule[day][shift].push(name);
          usedToday.add(name);
          totals[name]++; // Count this employee's additional working day.
        }
        if (!success) break;
      }
      if (!success) break;
    }
    if (success) {
      // Return only after checking staffing, double bookings, and weekly limits.
      validateSchedule(schedule, employees);
      return { schedule, totals };
    }
  }
  throw Error('Could not generate a valid schedule. Try more employees or a different seed.');
}

function printSchedule(schedule, totals) {
  // Pad text into fixed-width columns for an easy-to-read console table.
  const pad = (value, len) => String(value).padEnd(len);
  console.log('\nEMPLOYEE WEEKLY SHIFT SCHEDULE');
  console.log('='.repeat(93));
  console.log(pad('DAY', 12) + pad('MORNING', 26) + pad('AFTERNOON', 26) + pad('EVENING', 26));
  console.log('-'.repeat(93));
  for (const day of DAYS) {
    console.log(pad(day, 12) + SHIFTS.map(s => pad(schedule[day][s].join(', '), 26)).join(''));
  }
  console.log('='.repeat(93));
  console.log('WORKDAYS PER EMPLOYEE');
  const entries = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => `${name}: ${count}`);
  for (let i = 0; i < entries.length; i += 4) console.log(entries.slice(i, i + 4).join(' | '));
  console.log('\nVALIDATION PASSED: 2 employees/shift, 1 shift/day, maximum 5 days/week.');
}

if (require.main === module) {
  (async () => {
    try {
      // --interactive switches to manual entry; otherwise load JSON data.
      const interactive = process.argv.includes('--interactive');
      const args = process.argv.slice(2).filter(a => a !== '--interactive');
      const dataFile = args[0] || path.join(__dirname, '..', 'employees.json');
      const seed = args[1] === undefined ? 42 : Number(args[1]);
      if (!Number.isInteger(seed)) throw Error('Seed must be an integer.');
      const employees = interactive ? await collectEmployees() : loadEmployees(dataFile);
      const { schedule, totals } = generateSchedule(employees, seed);
      printSchedule(schedule, totals);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      process.exitCode = 1;
    }
  })();
}

// Export core functions so the automated test file can import them.
module.exports = { loadEmployees, generateSchedule, validateSchedule };
