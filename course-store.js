import { COURSES, PERIODS } from "./schedule-data.js";

export const STORAGE_KEY = "semester-schedule:courses:v1";

const TONES = ["green", "amber", "coral", "blue", "red", "purple", "teal"];

function cloneCourse(course) {
  return {
    ...course,
    activeWeeks: [...course.activeWeeks],
  };
}

export function getDefaultCourses() {
  return COURSES.map(cloneCourse);
}

export function toneForCourse(name) {
  const hash = [...name].reduce((total, character) => total + character.codePointAt(0), 0);
  return TONES[hash % TONES.length];
}

export function hydrateCourse(course) {
  return {
    ...course,
    activeWeeks: [...course.activeWeeks].sort((a, b) => a - b),
    startTime: PERIODS[course.periodStart]?.start || course.startTime,
    endTime: PERIODS[course.periodEnd]?.end || course.endTime,
    tone: course.tone || toneForCourse(course.name),
  };
}

export function loadCourses(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (!saved) return getDefaultCourses();
    const payload = JSON.parse(saved);
    if (payload?.version !== 1 || !Array.isArray(payload.courses)) return getDefaultCourses();
    return payload.courses.map(hydrateCourse);
  } catch {
    return getDefaultCourses();
  }
}

export function saveCourses(courses, storage = globalThis.localStorage) {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: courses.map(cloneCourse),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function resetCourses(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // The default data can still be shown when browser storage is unavailable.
  }
  return getDefaultCourses();
}
