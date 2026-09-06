import { COURSES, PERIODS, PRACTICE_COURSES, TERM } from "./schedule-data.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_NAMES = Object.freeze([
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
]);

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TERM.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getShanghaiClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TERM.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

export function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function getWeekNumber(dateKey) {
  const days = Math.floor((parseDateKey(dateKey) - parseDateKey(TERM.startDate)) / DAY_MS);
  return Math.floor(days / 7) + 1;
}

export function getWeekday(dateKey) {
  return parseDateKey(dateKey).getUTCDay();
}

export function isInTerm(weekNumber) {
  return weekNumber >= 1 && weekNumber <= TERM.totalWeeks;
}

export function getDateForWeekday(weekNumber, weekday) {
  return addDays(TERM.startDate, (weekNumber - 1) * 7 + (weekday - 1));
}

export function getCoursesForDate(dateKey) {
  const weekNumber = getWeekNumber(dateKey);
  const weekday = getWeekday(dateKey);
  if (!isInTerm(weekNumber)) return [];

  return COURSES.filter(
    (course) => course.weekday === weekday && course.activeWeeks.includes(weekNumber),
  ).sort((a, b) => a.periodStart - b.periodStart);
}

export function getCoursesForWeek(weekNumber) {
  if (!isInTerm(weekNumber)) return [];
  return Array.from({ length: 5 }, (_, index) => {
    const weekday = index + 1;
    const dateKey = getDateForWeekday(weekNumber, weekday);
    return { weekday, dateKey, courses: getCoursesForDate(dateKey) };
  });
}

export function getPracticesForWeek(weekNumber) {
  return PRACTICE_COURSES.filter((course) => course.activeWeeks.includes(weekNumber));
}

export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getCourseState(course, currentMinutes) {
  const start = toMinutes(course.startTime);
  const end = toMinutes(course.endTime);
  if (currentMinutes < start) return "upcoming";
  if (currentMinutes <= end) return "ongoing";
  return "finished";
}

export function findNextCourse(fromDate = new Date()) {
  const todayKey = toDateKey(fromDate);
  const currentMinutes = getShanghaiClock(fromDate);
  const termEnd = getDateForWeekday(TERM.totalWeeks, 7);

  for (let offset = 0; offset <= TERM.totalWeeks * 7; offset += 1) {
    const dateKey = addDays(todayKey, offset);
    if (dateKey > termEnd) break;
    const courses = getCoursesForDate(dateKey);
    const course = courses.find(
      (item) => offset > 0 || getCourseState(item, currentMinutes) !== "finished",
    );
    if (course) return { course, dateKey, offset };
  }
  return null;
}

export function validateScheduleData(courses = COURSES) {
  const errors = [];
  const ids = new Set();

  courses.forEach((course, index) => {
    const label = course.id || `第 ${index + 1} 条课程`;
    if (!course.id || !course.name || !course.location) {
      errors.push(`${label} 缺少 id、name 或 location`);
    }
    if (ids.has(course.id)) errors.push(`${label} 的 id 重复`);
    ids.add(course.id);
    if (!Number.isInteger(course.weekday) || course.weekday < 1 || course.weekday > 5) {
      errors.push(`${label} 的 weekday 必须为 1-5`);
    }
    if (!PERIODS[course.periodStart] || !PERIODS[course.periodEnd] || course.periodStart > course.periodEnd) {
      errors.push(`${label} 的节次无效`);
    }
    if (
      !Array.isArray(course.activeWeeks) ||
      !course.activeWeeks.length ||
      course.activeWeeks.some((week) => !Number.isInteger(week) || week < 1 || week > TERM.totalWeeks)
    ) {
      errors.push(`${label} 的 activeWeeks 无效`);
    }
  });

  return errors;
}
