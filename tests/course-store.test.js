import test from "node:test";
import assert from "node:assert/strict";

import {
  COURSE_TONES,
  STORAGE_KEY,
  getDefaultCourses,
  hydrateCourse,
  loadCourses,
  resetCourses,
  saveCourses,
  toneForCourse,
} from "../course-store.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("loads independent copies of the default schedule", () => {
  const storage = new MemoryStorage();
  const first = loadCourses(storage);
  first[0].activeWeeks.push(1);
  const second = loadCourses(storage);
  assert.notDeepEqual(first[0].activeWeeks, second[0].activeWeeks);
});

test("saves and reloads local course changes", () => {
  const storage = new MemoryStorage();
  const courses = getDefaultCourses();
  courses[0] = { ...courses[0], location: "新教室 101", tone: "purple" };
  assert.equal(saveCourses(courses, storage), true);
  assert.equal(loadCourses(storage)[0].location, "新教室 101");
  assert.equal(loadCourses(storage)[0].tone, "purple");
});

test("falls back to defaults when saved data is corrupt", () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, "not-json");
  assert.equal(loadCourses(storage).length, getDefaultCourses().length);
});

test("hydrates calculated time and an automatic color", () => {
  const course = hydrateCourse({
    id: "custom-course",
    name: "测试课程",
    weekday: 1,
    periodStart: 3,
    periodEnd: 4,
    activeWeeks: [3, 1, 2],
    location: "1 教 101",
  });
  assert.equal(course.startTime, "10:00");
  assert.equal(course.endTime, "11:35");
  assert.deepEqual(course.activeWeeks, [1, 2, 3]);
  assert.equal(course.tone, toneForCourse("测试课程"));
});

test("replaces an unsupported saved color with a valid course color", () => {
  const course = hydrateCourse({
    id: "custom-course",
    name: "测试课程",
    weekday: 1,
    periodStart: 1,
    periodEnd: 2,
    activeWeeks: [1],
    location: "1 教 101",
    tone: "transparent",
  });
  assert.equal(COURSE_TONES.includes(course.tone), true);
  assert.equal(course.tone, toneForCourse("测试课程"));
});

test("reset removes custom data and returns the defaults", () => {
  const storage = new MemoryStorage();
  saveCourses([], storage);
  const courses = resetCourses(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(courses.length, getDefaultCourses().length);
});

test("reports when browser storage is unavailable", () => {
  const storage = {
    setItem() {
      throw new Error("storage blocked");
    },
  };
  assert.equal(saveCourses(getDefaultCourses(), storage), false);
});
