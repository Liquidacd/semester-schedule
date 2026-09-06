import test from "node:test";
import assert from "node:assert/strict";

import {
  findNextCourse,
  getCourseState,
  getCoursesForDate,
  getCoursesForWeek,
  getPracticesForWeek,
  getWeekNumber,
  validateScheduleData,
} from "../schedule-core.js";

test("calculates term weeks from the first Monday", () => {
  assert.equal(getWeekNumber("2026-09-06"), 0);
  assert.equal(getWeekNumber("2026-09-07"), 1);
  assert.equal(getWeekNumber("2026-11-02"), 9);
  assert.equal(getWeekNumber("2026-12-27"), 16);
  assert.equal(getWeekNumber("2026-12-28"), 17);
});

test("week 1 Monday includes electronics but not late-starting linear algebra", () => {
  assert.deepEqual(getCoursesForDate("2026-09-07").map((course) => course.shortName || course.name), [
    "电工电子技术",
  ]);
});

test("weeks 6 through 9 include the all-week metalworking practice notice", () => {
  assert.equal(getPracticesForWeek(5).length, 0);
  assert.equal(getPracticesForWeek(6)[0].name, "金工实训 C");
  assert.equal(getPracticesForWeek(9)[0].name, "金工实训 C");
  assert.equal(getPracticesForWeek(10).length, 0);
});

test("odd-week online classes appear only on their scheduled odd weeks", () => {
  assert.deepEqual(getCoursesForDate("2026-11-04").map((course) => course.shortName || course.name), [
    "毛概（线上）",
  ]);
  assert.equal(getCoursesForDate("2026-11-11").some((course) => course.online), false);
  assert.equal(getCoursesForDate("2026-11-18").some((course) => course.online), true);
});

test("week 10 Monday switches both regular courses on", () => {
  assert.deepEqual(getCoursesForDate("2026-11-09").map((course) => course.name), [
    "线性代数 A",
    "电工电子技术",
  ]);
});

test("week 14 Friday contains all four scheduled courses in period order", () => {
  const friday = getCoursesForDate("2026-12-11");
  assert.deepEqual(friday.map((course) => course.periodStart), [1, 3, 5, 7]);
  assert.equal(friday[1].name, "形势与政策");
});

test("week 16 Tuesday excludes courses that ended in week 15", () => {
  assert.deepEqual(getCoursesForDate("2026-12-22").map((course) => course.shortName || course.name), [
    "理论力学",
    "毛概",
  ]);
});

test("course state recognizes upcoming, ongoing, and finished", () => {
  const course = getCoursesForDate("2026-11-09")[0];
  assert.equal(getCourseState(course, 7 * 60 + 59), "upcoming");
  assert.equal(getCourseState(course, 8 * 60 + 20), "ongoing");
  assert.equal(getCourseState(course, 9 * 60 + 41), "finished");
});

test("next course lookup crosses a weekend", () => {
  const saturdayInWeek10 = new Date("2026-11-14T02:00:00.000Z");
  const next = findNextCourse(saturdayInWeek10);
  assert.equal(next.dateKey, "2026-11-16");
  assert.equal(next.course.name, "线性代数 A");
});

test("week view always returns Monday through Friday", () => {
  const week = getCoursesForWeek(14);
  assert.equal(week.length, 5);
  assert.deepEqual(week.map((day) => day.weekday), [1, 2, 3, 4, 5]);
});

test("date and week queries accept a locally edited course list", () => {
  const custom = {
    id: "custom-course",
    name: "新增课程",
    weekday: 1,
    periodStart: 3,
    periodEnd: 4,
    startTime: "10:00",
    endTime: "11:35",
    activeWeeks: [1],
    location: "1 教 101",
    tone: "green",
  };
  assert.deepEqual(getCoursesForDate("2026-09-07", [custom]).map((course) => course.name), [
    "新增课程",
  ]);
  assert.equal(getCoursesForWeek(1, [custom])[0].courses[0].id, "custom-course");
});

test("schedule data remains valid after future edits", () => {
  assert.deepEqual(validateScheduleData(), []);
});

test("schedule validation reports common editing mistakes", () => {
  const errors = validateScheduleData([
    {
      id: "new-course",
      name: "新课程",
      weekday: 8,
      periodStart: 7,
      periodEnd: 6,
      activeWeeks: [0, 17],
      location: "",
    },
  ]);
  assert.equal(errors.length, 4);
});
