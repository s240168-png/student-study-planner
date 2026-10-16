# Student Study Planner and Exam Preparation Tracker

**Aim:** A browser-based tool to plan study sessions, track topics and exams, and measure preparation progress. Built for the Third Year CSE (Cyber Security) Software Engineering and Agile Practices lab mini-project.

## Problem Statement
Students juggle many subjects, topics and exam dates, and often lose track of what is pending or overdue. This app gives one place to plan sessions, track exam countdowns and see completion statistics, with no server or account needed.

## Features
- Dashboard: six live summary cards, today's plan, upcoming exams, recent sessions, subject-wise progress
- Subjects (add/edit/delete, topic and session counts) with confirmed cascade deletion
- Topics grouped by subject, mark completed/pending, edit, delete
- Study sessions: add/edit/delete, complete/pending toggle, filters (subject, status, priority), date sort, overdue highlighting, dependent topic dropdown, validation
- Exam tracker: add/edit/delete, days remaining, exams within 7 days highlighted
- Analytics: completion %, completed vs pending, subject-wise topic completion, planned vs completed time (CSS bars)
- localStorage persistence, Load Sample Data (additive), Reset Demo Data (with confirmation)
- User text is rendered with `textContent` (no `innerHTML`)

## Technology Stack
HTML5, CSS3, vanilla JavaScript, browser localStorage. No frameworks, backend or database.

## File Structure
```
study-planner/
  index.html   structure and forms
  style.css    responsive styling
  script.js    logic, validation, storage, rendering
  README.md
```

## Run Locally (Windows)
1. Download and unzip the `study-planner` folder.
2. Double-click `index.html` (opens in Chrome, Edge or Firefox). No installation needed.
3. Optional: right-click the page > Inspect > Console to confirm there are no errors.

## Load Sample Data
Click **Load Sample Data** in the sidebar (or the Menu button on mobile). It adds 4 subjects, 11 topics, 10 sessions (including completed, pending and one overdue) and 4 exams, tagged with a "Sample" badge. Existing records are kept. Dates are relative to today, so countdowns always look realistic. Clicking it twice shows a message instead of duplicating.

## How localStorage Works
All data is saved as one JSON string under the key `studyPlannerData.v1` after every add, edit, delete or status change, and loaded on startup. Malformed or invalid stored records are discarded safely. Data stays in that browser profile on that computer; clearing site data or using a private window removes it. View it in DevTools > Application > Local Storage.

## Known Limitations
- Single browser only; no sync or export
- No real notifications (countdowns are visual)
- Overdue is based on the device's current date
- Opening `index.html` from different folders/browsers gives separate storage
- Duration limit is 24 hours per session

## Testing Instructions (manual checklist)
1. Open `index.html`: no console errors; dashboard shows the empty banner and zero values.
2. Add, edit and delete a subject; add a topic and toggle it completed.
3. Add a session; try an empty title, duration `0` and `-5` (all rejected with a message).
4. Toggle a session Completed/Pending; edit it; delete it (confirmation appears).
5. Load Sample Data: confirm the overdue session is red-highlighted and dashboard totals match the lists.
6. Add, edit and delete an exam; check countdown text.
7. Refresh the page: data remains.
8. Click Reset Demo Data: confirmation dialog appears; Cancel keeps data.
9. Resize the window below 800px (or use DevTools device mode): menu collapses and layout stacks.
10. Enter `<b>test</b>` as a title: it appears as plain text.

## Screenshot Guide
1. Dashboard after loading sample data. 2. Subjects & Topics. 3. Study Planner list. 4. Session form (scroll to top of planner). 5. Exam Tracker. 6. Progress & Analytics. 7. Submit an empty session form to show the error. 8. Refresh and capture the retained data. 9. Narrow viewport (DevTools device toolbar).
