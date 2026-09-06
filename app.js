import { PERIODS, TERM } from "./schedule-data.js";
import {
  COURSE_TONES,
  STORAGE_KEY,
  hydrateCourse,
  loadCourses,
  resetCourses,
  saveCourses,
  toneForCourse,
} from "./course-store.js";
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
  validateScheduleData,
} from "./schedule-core.js";

const $ = (selector) => document.querySelector(selector);
const todayKey = toDateKey(new Date());
const actualWeek = getWeekNumber(todayKey);
let selectedWeek = Math.min(Math.max(actualWeek, 1), TERM.totalWeeks);
let currentView = "today";
let activeCourses = loadCourses();
let toastTimer;

const TONE_LABELS = Object.freeze({
  green: "松绿",
  amber: "琥珀",
  coral: "珊瑚",
  blue: "湖蓝",
  red: "砖红",
  purple: "紫灰",
  teal: "青绿",
});

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

function makeCourseId() {
  if (globalThis.crypto?.randomUUID) return `custom-${globalThis.crypto.randomUUID()}`;
  return `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function summarizeWeeks(activeWeeks) {
  const sorted = [...activeWeeks].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const week of sorted.slice(1)) {
    if (week === previous + 1) {
      previous = week;
      continue;
    }
    groups.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = week;
    previous = week;
  }
  if (start !== undefined) groups.push(start === previous ? `${start}` : `${start}–${previous}`);
  return `${groups.join("、")} 周`;
}

function showToast(message) {
  const toast = $("#toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
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
  const courses = getCoursesForDate(dateKey, activeCourses);
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
  const next = findNextCourse(now, activeCourses);
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
  const days = getCoursesForWeek(selectedWeek, activeCourses);
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
  currentView = viewName;
  document.body.classList.remove("is-managing");
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#today-view").hidden = viewName !== "today";
  $("#week-view").hidden = viewName !== "week";
  $("#manage-view").hidden = true;
  if (viewName === "week") renderWeek();
}

function refreshSchedule() {
  renderToday();
  renderWeek();
  renderManager();
}

function managerCourseRow(course) {
  const row = element("article", `manager-course tone-${course.tone}`);
  const accent = element("span", "manager-course-accent");
  accent.setAttribute("aria-hidden", "true");
  const details = element("div", "manager-course-details");
  details.append(
    element("h4", "manager-course-name", course.name),
    element(
      "p",
      "manager-course-meta",
      `${periodLabel(course)} · ${course.location} · ${summarizeWeeks(course.activeWeeks)}`,
    ),
  );
  const actions = element("div", "row-actions");
  const edit = element("button", "row-icon-button", "✎");
  edit.type = "button";
  edit.title = `编辑${course.name}`;
  edit.setAttribute("aria-label", `编辑${course.name}`);
  edit.addEventListener("click", () => openCourseDialog(course));
  const remove = element("button", "row-icon-button is-danger", "×");
  remove.type = "button";
  remove.title = `删除${course.name}`;
  remove.setAttribute("aria-label", `删除${course.name}`);
  remove.addEventListener("click", () => deleteCourse(course));
  actions.append(edit, remove);
  row.append(accent, details, actions);
  return row;
}

function renderManager() {
  const sorted = [...activeCourses].sort(
    (a, b) => a.weekday - b.weekday || a.periodStart - b.periodStart || a.name.localeCompare(b.name, "zh-CN"),
  );
  $("#manage-count").textContent = `本设备 · ${sorted.length} 条安排`;
  const groups = Array.from({ length: 5 }, (_, index) => {
    const weekday = index + 1;
    const courses = sorted.filter((course) => course.weekday === weekday);
    const section = element("section", "manager-day");
    section.append(element("h3", "manager-day-title", WEEKDAY_NAMES[weekday]));
    const list = element("div", "manager-day-list");
    list.replaceChildren(
      ...(courses.length
        ? courses.map(managerCourseRow)
        : [element("p", "manager-empty", "暂无课程")]),
    );
    section.append(list);
    return section;
  });
  $("#manage-list").replaceChildren(...groups);
}

function openManager() {
  document.body.classList.add("is-managing");
  $("#today-view").hidden = true;
  $("#week-view").hidden = true;
  $("#manage-view").hidden = false;
  renderManager();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setSelectedWeeks(activeWeeks) {
  document.querySelectorAll('[name="activeWeeks"]').forEach((checkbox) => {
    checkbox.checked = activeWeeks.includes(Number(checkbox.value));
  });
}

function setSelectedTone(tone) {
  const selected = document.querySelector(`[name="courseTone"][value="${tone}"]`);
  if (selected) selected.checked = true;
}

function updateTimePreview() {
  const start = Number($("#period-start").value);
  const end = Number($("#period-end").value);
  const valid = PERIODS[start] && PERIODS[end] && start <= end;
  $("#time-preview").textContent = valid
    ? `${PERIODS[start].start}–${PERIODS[end].end}`
    : "结束节次不能早于开始节次";
  $("#time-preview").classList.toggle("is-error", !valid);
}

function openCourseDialog(course = null) {
  const dialog = $("#course-dialog");
  $("#course-dialog-title").textContent = course ? "编辑课程" : "新增课程";
  $("#course-id").value = course?.id || "";
  $("#course-name").value = course?.name || "";
  $("#course-weekday").value = String(course?.weekday || 1);
  $("#period-start").value = String(course?.periodStart || 1);
  $("#period-end").value = String(course?.periodEnd || 2);
  $("#course-location").value = course?.location || "";
  $("#course-online").checked = Boolean(course?.online);
  setSelectedTone(course?.tone || toneForCourse(""));
  setSelectedWeeks(course?.activeWeeks || Array.from({ length: TERM.totalWeeks }, (_, index) => index + 1));
  $("#form-error").hidden = true;
  updateTimePreview();
  dialog.showModal();
  $("#course-name").focus();
}

function closeCourseDialog() {
  $("#course-dialog").close();
}

function deleteCourse(course) {
  if (!window.confirm(`删除“${course.name}”这条安排？`)) return;
  activeCourses = activeCourses.filter((item) => item.id !== course.id);
  const persisted = saveCourses(activeCourses);
  refreshSchedule();
  showToast(persisted ? "课程已删除" : "已删除，但无法保存到本设备");
}

function saveCourse(event) {
  event.preventDefault();
  const id = $("#course-id").value;
  const existing = activeCourses.find((course) => course.id === id);
  const name = $("#course-name").value.trim();
  const location = $("#course-location").value.trim();
  const activeWeeks = [...document.querySelectorAll('[name="activeWeeks"]:checked')].map((item) =>
    Number(item.value),
  );
  const periodStart = Number($("#period-start").value);
  const periodEnd = Number($("#period-end").value);

  let error = "";
  if (!name) error = "请填写课程名称";
  else if (!location) error = "请填写地点";
  else if (periodStart > periodEnd) error = "结束节次不能早于开始节次";
  else if (!activeWeeks.length) error = "请至少选择一个上课周次";

  const errorNode = $("#form-error");
  if (error) {
    errorNode.textContent = error;
    errorNode.hidden = false;
    return;
  }

  const updated = hydrateCourse({
    ...existing,
    id: id || makeCourseId(),
    name,
    shortName: existing?.name === name ? existing.shortName : undefined,
    weekday: Number($("#course-weekday").value),
    periodStart,
    periodEnd,
    activeWeeks,
    location,
    online: $("#course-online").checked,
    tone: document.querySelector('[name="courseTone"]:checked')?.value || toneForCourse(name),
  });
  const candidate = existing
    ? activeCourses.map((course) => (course.id === existing.id ? updated : course))
    : [...activeCourses, updated];
  const validationErrors = validateScheduleData(candidate);
  if (validationErrors.length) {
    errorNode.textContent = validationErrors[0];
    errorNode.hidden = false;
    return;
  }

  activeCourses = candidate;
  const persisted = saveCourses(activeCourses);
  closeCourseDialog();
  refreshSchedule();
  showToast(
    persisted
      ? existing
        ? "课程已更新"
        : "课程已添加"
      : "已更新，但无法保存到本设备",
  );
}

function applyWeekPreset(preset) {
  const weeks = Array.from({ length: TERM.totalWeeks }, (_, index) => index + 1);
  const selected =
    preset === "all"
      ? weeks
      : preset === "odd"
        ? weeks.filter((week) => week % 2 === 1)
        : preset === "even"
          ? weeks.filter((week) => week % 2 === 0)
          : [];
  setSelectedWeeks(selected);
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

$("#manage-courses").addEventListener("click", openManager);
$("#close-manager").addEventListener("click", () => setView(currentView));
$("#add-course").addEventListener("click", () => openCourseDialog());
$("#close-course-dialog").addEventListener("click", closeCourseDialog);
$("#cancel-course").addEventListener("click", closeCourseDialog);
$("#course-form").addEventListener("submit", saveCourse);
$("#period-start").addEventListener("change", updateTimePreview);
$("#period-end").addEventListener("change", updateTimePreview);
$("#course-online").addEventListener("change", (event) => {
  if (event.target.checked && !$("#course-location").value.trim()) {
    $("#course-location").value = "线上课程";
  }
});
document.querySelectorAll("[data-week-preset]").forEach((button) => {
  button.addEventListener("click", () => applyWeekPreset(button.dataset.weekPreset));
});
$("#reset-courses").addEventListener("click", () => {
  if (!window.confirm("恢复初始课表？本设备上的课程修改将被清除。")) return;
  activeCourses = resetCourses();
  refreshSchedule();
  showToast("已恢复初始课表");
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  activeCourses = loadCourses();
  refreshSchedule();
});

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

for (let period = 1; period <= 10; period += 1) {
  $("#period-start").append(new Option(`第 ${period} 节`, String(period)));
  $("#period-end").append(new Option(`第 ${period} 节`, String(period)));
}

for (let week = 1; week <= TERM.totalWeeks; week += 1) {
  const label = element("label", "week-checkbox");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.name = "activeWeeks";
  checkbox.value = String(week);
  label.append(checkbox, element("span", "", String(week)));
  $("#week-checkboxes").append(label);
}

for (const tone of COURSE_TONES) {
  const label = element("label", `tone-option tone-${tone}`);
  label.title = TONE_LABELS[tone];
  const radio = element("input");
  radio.type = "radio";
  radio.name = "courseTone";
  radio.value = tone;
  radio.setAttribute("aria-label", TONE_LABELS[tone]);
  const swatch = element("span", "tone-swatch");
  swatch.setAttribute("aria-hidden", "true");
  label.append(radio, swatch);
  $("#course-tones").append(label);
}

refreshSchedule();
updateNetworkState();

setInterval(renderToday, 60_000);
