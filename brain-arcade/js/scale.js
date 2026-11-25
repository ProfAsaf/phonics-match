// The grade scale used everywhere.
//   g = -1  start of Pre-K (age 4)      g = 0  start of kindergarten
//   g =  1  start of 1st grade          g = 3.5  middle of 3rd grade
// The fraction is how far into the school year. Like IXL's diagnostic, a level of g means
// "ready to learn the skills taught at g": skills below it are mostly mastered.
// IXL-style level numbers are 100 * g (so 370 = late 3rd grade), shown from kindergarten up.

export const G_MIN = -1.5;
export const G_MAX = 6.5;

const GRADE_NAMES = ['Pre-K', 'K', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade'];
export const gradeName = (grade) => GRADE_NAMES[Math.max(-1, Math.min(6, grade)) + 1];

// "Mid 2nd grade", "Late Pre-K", "Early K"
export function gradeLabel(g) {
  if (g < -1) return 'Early Pre-K';
  if (g >= 6.5) return '6th grade +';
  const grade = Math.floor(g);
  const f = g - grade;
  const part = f < 0.34 ? 'Early' : f < 0.67 ? 'Mid' : 'Late';
  return `${part} ${gradeName(grade)}`;
}

// IXL-style number (kindergarten up), else null.
export const levelNumber = (g) => (g < 0 ? null : Math.round(g * 100));

// "2.7" style, with PK for Pre-K
export function gradeShort(g) {
  if (g < 0) return 'PK';
  return (Math.round(g * 10) / 10).toFixed(1);
}

// Fraction of the school year done on this date (Sept 1 = 0, June 1 = 0.9, summer holds 0.95).
export function schoolYearFraction(date = new Date()) {
  const m = date.getMonth(); // 0 = Jan
  const d = date.getDate();
  if (m === 7) return d >= 10 ? 0 : 0.95; // school starts mid-August
  if (m === 6 || (m === 5 && d > 10)) return 0.95; // summer
  const monthsIn = m >= 8 ? m - 8 : m + 4; // Sep=0 ... May=8, early June=9
  return Math.max(0, Math.min(0.95, (monthsIn + (d - 1) / 30) / 10));
}

// The level a typical child in this grade is at today.
export const expectedNow = (grade, date = new Date()) => grade + schoolYearFraction(date);

// Status relative to expected (DIBELS-like colors).
export function status(level, expected) {
  const d = level - expected;
  if (d >= 0.5) return { key: 'above', label: 'Above grade level', color: '#2f86d6' };
  if (d >= -0.25) return { key: 'on', label: 'On track', color: '#3aa757' };
  if (d >= -0.75) return { key: 'below', label: 'A little behind', color: '#e3b021' };
  return { key: 'wellbelow', label: 'Needs support', color: '#d9534f' };
}

export const GRADE_CHOICES = [
  { grade: -1, label: 'Pre-K (age 4)' },
  { grade: 0, label: 'Kindergarten' },
  { grade: 1, label: '1st grade' },
  { grade: 2, label: '2nd grade' },
  { grade: 3, label: '3rd grade' },
  { grade: 4, label: '4th grade' },
  { grade: 5, label: '5th grade' },
];
