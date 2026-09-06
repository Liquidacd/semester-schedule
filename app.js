import { TERM } from "./schedule-data.js";
import {
  WEEKDAY_NAMES,
  addDays,
  findNextCourse,
  getCourseState,
  getCoursesForDate,
  getCoursesForWeek,
  getDateForWeekday,
  getPracticesForWeek,
  getShanghaiClock,
  getWeekNumber,
  isInTerm,
  parseDateKey,
  toDateKey,
} from "./schedule-core.js";

const $ = (selector) => document.querySelector(selector);
const todayKey = toDateKey(new Date());
const actualWeek = getWeekNumber(todayKey);
let selectedWeek = Math.min(Math.max(actualWeek, 1), TERM.totalWeeks);

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: TERM.timeZone,
  month: "long",
  day: "numeric",
  weekday: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "UTC",
  month: "numeric",
  day: "numeric",
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDateKey(dateKey) {
  return shortDateFormatter.format(parseDateKey(dateKey));
}

function periodLabel(course) {
  return `第 ${course.periodStart}–${course.periodEnd} 节`;
}

function courseCard(course, state = "") {
  const card = element("article", `course-card tone-${course.tone}${state ? ` is-${state}` : ""}`);
  const marker = element("span", "course-marker");
  marker.setAttribute("aria-hidden", "true");

  const body = element("div", "course-body");
  const top = element("div", "course-topline");
  const name = element("h3", "course-name", course.shortName || course.name);
  const period = element("span", "period-chip", periodLabel(course));
  top.append(name, period);

  const meta = element("div", "course-meta");
  const time = element("span", "course-time", `${course.startTime}–${course.endTime}`);
  const location = element("span", "course-location", course.location);
  if (course.online) location.classList.add("is-online");
  meta.append(time, location);

  if (state === "ongoing") {
    const live = element("span", "state-label", "正在上课");
    live.setAttribute("aria-label", "当前课程");
    body.append(live);
  } else if (state === "upcoming") {
    const next = element("span", "state-label", "下一节");
    body.append(next);
  }

  body.append(top, meta);
  card.append(marker, body);
  return card;
}

function emptyState(title, description) {
  const box = element("div", "empty-state");
  box.append(element("strong", "empty-title", title), element("p", "empty-copy", description));
  return box;
}

function practiceBanner(weekNumber) {
  const practices = getPracticesForWeek(weekNumber);
  if (!practices.length) return null;
  const banner = element("aside", "practice-banner");
  const badge = element("span", "practice-icon", "实");
  const copy = element("div");
  copy.append(
    element("strong", "practice-title", practices.map((item) => item.name).join("、")),
    element("p", "practice-copy", `第 ${weekNumber} 周 · 本周实践课程`),
  );
  banner.append(badge, copy);
  return banner;
}

function renderToday() {
  const now = new Date();
  const dateKey = toDateKey(now);
  const weekNumber = getWeekNumber(dateKey);
  const courses = getCoursesForDate(dateKey);
  const currentMinutes = getShanghaiClock(now);
  const states = courses.map((course) => getCourseState(course, currentMinutes));
  const ongoingIndex = states.indexOf("ongoing");
  const upcomingIndex = states.indexOf("upcoming");
  $("#today-date").textContent = dateFormatter.format(now);
  $("#today-week").textContent = isInTerm(weekNumber) ? `第 ${weekNumber} 周` : "学期外";

  const termStatus = $("#term-status");
  if (weekNumber < 1) {
    const days = Math.ceil((parseDateKey(TERM.startDate) - parseDateKey(dateKey)) / 86400000);
    termStatus.textContent = days === 1 ? "明天开学" : `距离开学还有 ${days} 天`;
    termStatus.hidden = false;
  } else if (weekNumber > TERM.totalWeeks) {
    termStatus.textContent = "本学期已结束";
    termStatus.hidden = false;
  } else {
    termStatus.hidden = true;
  }

  const todayPractice = $("#today-practice");
  const banner = practiceBanner(weekNumber);
  todayPractice.replaceChildren(...(banner ? [banner] : []));

  const summary = $("#today-summary");
  if (ongoingIndex >= 0) {
    summary.textContent = `今天 ${courses.length} 节课 · 正在上第 ${ongoingIndex + 1} 节`;
  } else if (upcomingIndex >= 0) {
    summary.textContent = `今天 ${courses.length} 节课 · 下一节 ${courses[upcomingIndex].startTime}`;
  } else if (courses.length) {
    summary.textContent = `今天 ${courses.length} 节课 · 已全部结束`;
  } else {
    summary.textContent = isInTerm(weekNumber) ? "今天没有排课" : TERM.name;
  }

  const timeline = $("#today-timeline");
  if (courses.length) {
    timeline.replaceChildren(...courses.map((course, index) => courseCard(course, states[index])));
  } else {
    const weekday = parseDateKey(dateKey).getUTCDay();
    timeline.replaceChildren(
      emptyState(weekday === 0 || weekday === 6 ? "今天休息" : "今天无课", "下一次课程已经列在下方。"),
    );
  }

  const nextRoot = $("#next-course");
  const next = findNextCourse(now);
  const hasActiveCourse = ongoingIndex >= 0 || upcomingIndex >= 0;
  if (!hasActiveCourse && next) {
    const section = element("section", "next-section");
    const dayText = next.offset === 0 ? "稍后" : next.offset === 1 ? "明天" : `${formatDateKey(next.dateKey)} ${WEEKDAY_NAMES[next.course.weekday]}`;
    section.append(element("h2", "section-heading", `${dayText}的下一节`), courseCard(next.course));
    nextRoot.replaceChildren(section);
  } else {
    nextRoot.replaceChildren();
  }
}

function renderWeek() {
  const days = getCoursesForWeek(selectedWeek);
  const monday = getDateForWeekday(selectedWeek, 1);
  const friday = getDateForWeekday(selectedWeek, 5);
  $("#week-heading").textContent = `第 ${selectedWeek} 周`;
  $("#week-range").textContent = `${formatDateKey(monday)} – ${formatDateKey(friday)}`;
  $("#previous-week").disabled = selectedWeek === 1;
  $("#next-week").disabled = selectedWeek === TERM.totalWeeks;
  $("#current-week").hidden = !isInTerm(actualWeek) || selectedWeek === actualWeek;

  const practiceRoot = $("#week-practice");
  const banner = practiceBanner(selectedWeek);
  practiceRoot.replaceChildren(...(banner ? [banner] : []));

  const weekList = $("#week-list");
  weekList.replaceChildren(
    ...days.map((day) => {
      const section = element("section", `week-day${day.dateKey === todayKey ? " is-today" : ""}`);
      const heading = element("div", "week-day-heading");
      const title = element("h3", "weekday-name", WEEKDAY_NAMES[day.weekday]);
      const date = element("span", "weekday-date", formatDateKey(day.dateKey));
      heading.append(title, date);
      if (day.dateKey === todayKey) heading.append(element("span", "today-chip", "今天"));
      const courses = element("div", "day-courses");
      courses.replaceChildren(
        ...(day.courses.length
          ? day.courses.map((course) => courseCard(course))
          : [element("p", "no-course", "无课")]),
      );
      section.append(heading, courses);
      return section;
    }),
  );
}

function setView(viewName) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#today-view").hidden = viewName !== "today";
  $("#week-view").hidden = viewName !== "week";
  if (viewName === "week") renderWeek();
}

function updateNetworkState() {
  const online = navigator.onLine;
  $("#network-state").classList.toggle("is-offline", !online);
  $("#network-label").textContent = online ? "可离线使用" : "离线模式";
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

$("#previous-week").addEventListener("click", () => {
  selectedWeek = Math.max(1, selectedWeek - 1);
  renderWeek();
});

$("#next-week").addEventListener("click", () => {
  selectedWeek = Math.min(TERM.totalWeeks, selectedWeek + 1);
  renderWeek();
});

$("#current-week").addEventListener("click", () => {
  selectedWeek = actualWeek;
  renderWeek();
});

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

renderToday();
renderWeek();
updateNetworkState();

setInterval(renderToday, 60_000);
