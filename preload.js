const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  alwaysOnTop: (flag) => ipcRenderer.send('window-always-on-top', flag),
  setOpacity: (val) => ipcRenderer.send('window-set-opacity', val),
  getOpacity: () => ipcRenderer.invoke('window-get-opacity'),
  widgetMode: (flag) => ipcRenderer.send('window-widget-mode', flag),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateStatus: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // Settings
  getSetting: (key, def) => ipcRenderer.invoke('get-setting', key, def),
  setSetting: (key, val) => ipcRenderer.invoke('set-setting', key, val),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  switchUserDatabase: (uid, options) => ipcRenderer.invoke('switch-user-database', uid, options),
  getAppMeta: () => ipcRenderer.invoke('get-app-meta'),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: () => ipcRenderer.invoke('import-backup'),

  // Students
  getStudents: () => ipcRenderer.invoke('get-students'),
  addStudent: (d) => ipcRenderer.invoke('add-student', d),
  updateStudent: (id, d) => ipcRenderer.invoke('update-student', id, d),
  deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
  importStudentsCSV: (rows) => ipcRenderer.invoke('import-students-csv', rows),

  // Attendance
  getAttendance: (date) => ipcRenderer.invoke('get-attendance', date),
  getAttendanceRange: (s, e) => ipcRenderer.invoke('get-attendance-range', s, e),
  setAttendance: (d) => ipcRenderer.invoke('set-attendance', d),
  getAttendanceStats: (y, m) => ipcRenderer.invoke('get-attendance-stats', y, m),

  // Counseling
  getCounseling: (f) => ipcRenderer.invoke('get-counseling', f),
  addCounseling: (d) => ipcRenderer.invoke('add-counseling', d),
  updateCounseling: (id, d) => ipcRenderer.invoke('update-counseling', id, d),
  deleteCounseling: (id) => ipcRenderer.invoke('delete-counseling', id),

  // Observations
  getObservations: (f) => ipcRenderer.invoke('get-observations', f),
  addObservation: (d) => ipcRenderer.invoke('add-observation', d),
  updateObservation: (id, d) => ipcRenderer.invoke('update-observation', id, d),
  deleteObservation: (id) => ipcRenderer.invoke('delete-observation', id),

  // Lessons
  getLessons: (f) => ipcRenderer.invoke('get-lessons', f),
  addLesson: (d) => ipcRenderer.invoke('add-lesson', d),
  updateLesson: (id, d) => ipcRenderer.invoke('update-lesson', id, d),
  deleteLesson: (id) => ipcRenderer.invoke('delete-lesson', id),

  // Assessments
  getAssessments: () => ipcRenderer.invoke('get-assessments'),
  addAssessment: (d) => ipcRenderer.invoke('add-assessment', d),
  updateAssessment: (id, d) => ipcRenderer.invoke('update-assessment', id, d),
  deleteAssessment: (id) => ipcRenderer.invoke('delete-assessment', id),
  getAssessmentScores: (id) => ipcRenderer.invoke('get-assessment-scores', id),
  setAssessmentScore: (d) => ipcRenderer.invoke('set-assessment-score', d),

  // Submissions
  getSubmissions: (f) => ipcRenderer.invoke('get-submissions', f),
  addSubmission: (d) => ipcRenderer.invoke('add-submission', d),
  updateSubmission: (id, d) => ipcRenderer.invoke('update-submission', id, d),
  deleteSubmission: (id) => ipcRenderer.invoke('delete-submission', id),
  getSubmissionStatus: (id) => ipcRenderer.invoke('get-submission-status', id),
  setSubmissionStatus: (d) => ipcRenderer.invoke('set-submission-status', d),

  // Todos
  getTodos: (done) => ipcRenderer.invoke('get-todos', done),
  addTodo: (d) => ipcRenderer.invoke('add-todo', d),
  updateTodo: (id, d) => ipcRenderer.invoke('update-todo', id, d),
  toggleTodo: (id) => ipcRenderer.invoke('toggle-todo', id),
  deleteTodo: (id) => ipcRenderer.invoke('delete-todo', id),
  replaceTodos: (items) => ipcRenderer.invoke('replace-todos', items),
  setTodoGcalId: (id, gcalId) => ipcRenderer.invoke('set-todo-gcal-id', id, gcalId),
  getTodoGcalId: (id) => ipcRenderer.invoke('get-todo-gcal-id', id),

  // Google Calendar
  gcalOAuthStart: (cid, csec) => ipcRenderer.invoke('gcal-oauth-start', cid, csec),
  gcalRefreshToken: (cid, csec, rt) => ipcRenderer.invoke('gcal-refresh-token', cid, csec, rt),
  gcalAddEvent: (token, event) => ipcRenderer.invoke('gcal-add-event', token, event),
  gcalDeleteEvent: (token, eventId) => ipcRenderer.invoke('gcal-delete-event', token, eventId),

  // D-Day
  getDdays: () => ipcRenderer.invoke('get-ddays'),
  addDday: (d) => ipcRenderer.invoke('add-dday', d),
  deleteDday: (id) => ipcRenderer.invoke('delete-dday', id),

  // Timetable
  getTimetable: () => ipcRenderer.invoke('get-timetable'),
  setTimetableCell: (d) => ipcRenderer.invoke('set-timetable-cell', d),
  clearTimetable: () => ipcRenderer.invoke('clear-timetable'),
  replaceTimetable: (items) => ipcRenderer.invoke('replace-timetable', items),

  // Daily memo
  getDailyMemo: (date) => ipcRenderer.invoke('get-daily-memo', date),
  setDailyMemo: (date, c) => ipcRenderer.invoke('set-daily-memo', date, c),
  getDailyMemos: (y, m) => ipcRenderer.invoke('get-daily-memos', y, m),

  // External open
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openPath: (path) => ipcRenderer.invoke('open-path', path),

  // NEIS
  neisGetMeal: (edu, sch, date) => ipcRenderer.invoke('neis-get-meal', edu, sch, date),
  neisGetCalendar: (edu, sch, ym) => ipcRenderer.invoke('neis-get-calendar', edu, sch, ym),
  neisSearchSchools: (keyword) => ipcRenderer.invoke('neis-search-schools', keyword),
  neisGetWeather: (region) => ipcRenderer.invoke('neis-get-weather', region),

  // AI
  aiExtractTodos: (key, model, provider, text) =>
    ipcRenderer.invoke('ai-extract-todos', key, model, provider, text),
  aiGenerateOfficialDoc: (key, model, provider, inputJson) =>
    ipcRenderer.invoke('ai-generate-official-doc', key, model, provider, inputJson),
  aiExtractTimetable: (key, model, provider, text) =>
    ipcRenderer.invoke('ai-extract-timetable', key, model, provider, text),
  aiExtractTimetableImage: (key, model, provider, image) =>
    ipcRenderer.invoke('ai-extract-timetable-image', key, model, provider, image),
  aiExtractEstimateImage: (key, model, provider, image) =>
    ipcRenderer.invoke('ai-extract-estimate-image', key, model, provider, image),
  parseExcelEstimate: (bufferData) =>
    ipcRenderer.invoke('parse-excel-estimate', bufferData),
  importClassTimetableExcel: (payload) =>
    ipcRenderer.invoke('import-class-timetable-excel', payload),
  applyAppPatch: () => ipcRenderer.invoke('apply-app-patch'),

  // 에듀파인 매크로
  macroGetMousePos: () => ipcRenderer.invoke('macro-get-mouse-pos'),
  macroStop: () => ipcRenderer.invoke('macro-stop'),
  macroRunEdufine: (config) => ipcRenderer.invoke('macro-run-edufine', config),
});
