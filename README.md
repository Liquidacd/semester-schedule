# 本学期课表

面向手机的 2026-2027 学年第 1 学期静态课表。页面会以北京时间自动计算教学周，处理分段周次、单双周和第 6-9 周金工实训，可作为 PWA 添加到桌面并离线使用。

## 本地预览

在项目目录启动任意静态文件服务器，例如：

```powershell
python -m http.server 4173
```

打开 `http://127.0.0.1:4173/`。

## 测试

```powershell
npm test
```

课程安排集中在 `schedule-data.js`，日期与周次逻辑位于 `schedule-core.js`。

## 修改课表

日常变动只需编辑 `schedule-data.js` 中的 `COURSES` 列表，不需要修改页面或日期算法。每门课的结构如下：

```js
makeCourse({
  id: "course-id",          // 保持唯一
  name: "课程名称",
  weekday: 3,               // 周一至周五对应 1-5
  periodStart: 3,
  periodEnd: 4,
  activeWeeks: range(2, 12),
  location: "1 教 101",
  tone: "green",
})
```

- 改教室：修改 `location`。
- 改上课周：连续周使用 `range(起始周, 结束周)`；多个区间使用 `weeks(range(1, 5), range(10, 14))`。
- 新增课程：复制一条记录并修改字段，确保 `id` 不重复。
- 单双周：直接列出周次，例如单周使用 `[1, 3, 5, 7, 9, 11, 13, 15]`。
- 实践周：编辑 `PRACTICE_COURSES`。

修改后运行 `npm test`。数据校验会检查重复 ID、无效星期、无效节次、缺失地点和超出学期范围的周次。部署到 GitHub Pages 后，设备在线打开页面即可获取最新课表；离线时继续使用最后一次成功加载的版本。
