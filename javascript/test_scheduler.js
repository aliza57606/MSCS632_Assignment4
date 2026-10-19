const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadEmployees, generateSchedule, validateSchedule } = require('./employee_scheduler');
const employees = loadEmployees(path.join(__dirname, '..', 'employees.json'));

test('schedules 42 employee-shifts for the full week', () => {
  const { schedule } = generateSchedule(employees);
  const total = Object.values(schedule).flatMap(day => Object.values(day)).flat().length;
  assert.equal(total, 42);
});

test('40 random seeds yield schedules that satisfy staffing constraints', () => {
  for (let seed = 0; seed < 40; seed++) {
    const { schedule, totals } = generateSchedule(employees, seed);
    assert.equal(validateSchedule(schedule, employees), true);
    assert.ok(Object.values(totals).every(n => n <= 5));
  }
});

test('rejects fewer than nine employees', () => {
  assert.throws(() => generateSchedule(employees.slice(0, 8)), /Not enough employees/);
});
