const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Database = require('better-sqlite3');

const DB_PATH = path.join(app.getPath('userData'), 'teacher_app.db');
const USER_DB_DIR = path.join(app.getPath('userData'), 'user-databases');

function sanitizeUserId(userId = '') {
  return String(userId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'default';
}

function getDbPathForUser(userId = '') {
  if (!userId) return DB_PATH;
  return path.join(USER_DB_DIR, `teacher_app_${sanitizeUserId(userId)}.db`);
}

class AppDatabase {
  constructor(options = {}) {
    this.userId = options.userId || '';
    this.dbPath = options.dbPath || getDbPathForUser(this.userId);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._init();
  }

  static getDefaultPath() {
    return DB_PATH;
  }

  static getPathForUser(userId = '') {
    return getDbPathForUser(userId);
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        gender TEXT DEFAULT '',
        birth_date TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        parent_phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        period INTEGER DEFAULT 0,
        status TEXT DEFAULT '출석',
        category TEXT DEFAULT '출석',
        reason TEXT DEFAULT '',
        note TEXT DEFAULT '',
        UNIQUE(student_id, date, period),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS counseling (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        date TEXT NOT NULL,
        type TEXT DEFAULT '개인',
        content TEXT DEFAULT '',
        result TEXT DEFAULT '',
        follow_up TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        date TEXT NOT NULL,
        subject TEXT DEFAULT '',
        content TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        subject TEXT DEFAULT '',
        period INTEGER DEFAULT 1,
        topic TEXT DEFAULT '',
        content TEXT DEFAULT '',
        homework TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT DEFAULT '',
        type TEXT DEFAULT '수행',
        date TEXT DEFAULT '',
        max_score REAL DEFAULT 100,
        weight REAL DEFAULT 1,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS assessment_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        score REAL DEFAULT 0,
        note TEXT DEFAULT '',
        UNIQUE(assessment_id, student_id),
        FOREIGN KEY(assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT DEFAULT '',
        due_date TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS submission_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        submitted INTEGER DEFAULT 0,
        submitted_at TEXT DEFAULT '',
        note TEXT DEFAULT '',
        UNIQUE(submission_id, student_id),
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        deadline TEXT DEFAULT '',
        priority TEXT DEFAULT '보통',
        category TEXT DEFAULT '기타',
        is_done INTEGER DEFAULT 0,
        is_ai_generated INTEGER DEFAULT 0,
        source_text TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS ddays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        target_date TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL,
        period INTEGER NOT NULL,
        subject TEXT DEFAULT '',
        teacher TEXT DEFAULT '',
        room TEXT DEFAULT '',
        is_my_class INTEGER DEFAULT 0,
        UNIQUE(day_of_week, period)
      );
      CREATE TABLE IF NOT EXISTS daily_memo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        content TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    this._ensureTodoCalendarColumn();
    this._ensureCounselingColumns();
  }

  _ensureTodoCalendarColumn() {
    try {
      this.db.exec('ALTER TABLE todos ADD COLUMN gcal_event_id TEXT');
    } catch (_) {}
  }

  _ensureCounselingColumns() {
    const columns = {
      topic: "TEXT DEFAULT ''",
      teacher_role: "TEXT DEFAULT '담임교사'",
      domain: "TEXT DEFAULT ''",
      summary: "TEXT DEFAULT ''",
      mood: "TEXT DEFAULT ''",
      risk_level: "TEXT DEFAULT '낮음'",
      risk_flags: "TEXT DEFAULT ''",
      next_action: "TEXT DEFAULT ''",
      next_date: "TEXT DEFAULT ''",
      status: "TEXT DEFAULT '진행'",
      confidential_note: "TEXT DEFAULT ''",
      updated_at: "TEXT DEFAULT ''"
    };
    Object.keys(columns).forEach((name) => {
      try {
        this.db.exec(`ALTER TABLE counseling ADD COLUMN ${name} ${columns[name]}`);
      } catch (_) {}
    });
  }

  getPath() {
    return this.dbPath;
  }

  async backupTo(targetPath) {
    await this.db.backup(targetPath);
    return targetPath;
  }

  close() {
    this.db.close();
  }

  getSetting(key, def = '') {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? row.value : def;
  }

  setSetting(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(key, String(value));
    return true;
  }

  getAllSettings() {
    const rows = this.db.prepare('SELECT key,value FROM settings').all();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  getStudents() {
    return this.db.prepare('SELECT * FROM students ORDER BY number').all();
  }

  addStudent(data) {
    const result = this.db.prepare(
      'INSERT INTO students(number,name,gender,birth_date,phone,parent_phone,address,note) VALUES(?,?,?,?,?,?,?,?)'
    ).run(
      data.number,
      data.name,
      data.gender || '',
      data.birth_date || '',
      data.phone || '',
      data.parent_phone || '',
      data.address || '',
      data.note || ''
    );
    return result.lastInsertRowid;
  }

  updateStudent(id, data) {
    this.db.prepare(
      'UPDATE students SET number=?,name=?,gender=?,birth_date=?,phone=?,parent_phone=?,address=?,note=? WHERE id=?'
    ).run(
      data.number,
      data.name,
      data.gender || '',
      data.birth_date || '',
      data.phone || '',
      data.parent_phone || '',
      data.address || '',
      data.note || '',
      id
    );
    return true;
  }

  deleteStudent(id) {
    this.db.prepare('DELETE FROM students WHERE id=?').run(id);
    return true;
  }

  importStudentsCSV(rows) {
    this.db.prepare('DELETE FROM students').run();
    const insert = this.db.prepare(
      'INSERT INTO students(number,name,gender,birth_date,phone,parent_phone,address,note) VALUES(?,?,?,?,?,?,?,?)'
    );
    const transaction = this.db.transaction((items) => {
      for (const row of items) {
        insert.run(
          row.number,
          row.name,
          row.gender || '',
          row.birth_date || '',
          row.phone || '',
          row.parent_phone || '',
          row.address || '',
          row.note || ''
        );
      }
    });
    transaction(rows);
    return true;
  }

  getAttendance(date) {
    return this.db.prepare(
      'SELECT a.*, s.name, s.number FROM attendance a JOIN students s ON a.student_id=s.id WHERE a.date=? ORDER BY s.number'
    ).all(date);
  }

  getAttendanceRange(start, end) {
    return this.db.prepare(
      'SELECT a.*, s.name, s.number FROM attendance a JOIN students s ON a.student_id=s.id WHERE a.date>=? AND a.date<=? ORDER BY a.date, s.number'
    ).all(start, end);
  }

  setAttendance(data) {
    this.db.prepare(
      'INSERT OR REPLACE INTO attendance(student_id,date,period,status,category,reason,note) VALUES(?,?,?,?,?,?,?)'
    ).run(
      data.student_id,
      data.date,
      data.period || 0,
      data.status || '출석',
      data.category || '출석',
      data.reason || '',
      data.note || ''
    );
    return true;
  }

  getAttendanceStats(year, month) {
    const prefix = month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`;
    return this.db.prepare(`
      SELECT s.id, s.number, s.name,
        SUM(CASE WHEN a.category='출석인정' AND a.period=0 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN a.category='미인정' AND a.period=0 THEN 1 ELSE 0 END) as unapproved,
        SUM(CASE WHEN a.category='질병' AND a.period=0 THEN 1 ELSE 0 END) as disease,
        SUM(CASE WHEN a.status='결석' AND a.period=0 THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status='결과' AND a.period=0 THEN 1 ELSE 0 END) as result,
        SUM(CASE WHEN a.status='지각' AND a.period=0 THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status='조퇴' AND a.period=0 THEN 1 ELSE 0 END) as early
      FROM students s
      LEFT JOIN attendance a ON s.id=a.student_id AND a.date LIKE ?
      GROUP BY s.id
      ORDER BY s.number
    `).all(`${prefix}%`);
  }

  getCounseling(filter = {}) {
    this._ensureCounselingColumns();
    let query = 'SELECT c.*, s.name, s.number FROM counseling c LEFT JOIN students s ON c.student_id=s.id WHERE 1=1';
    const params = [];
    if (filter.student_id) {
      query += ' AND c.student_id=?';
      params.push(filter.student_id);
    }
    if (filter.date_from) {
      query += ' AND c.date>=?';
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      query += ' AND c.date<=?';
      params.push(filter.date_to);
    }
    if (filter.status) {
      query += ' AND c.status=?';
      params.push(filter.status);
    }
    if (filter.teacher_role) {
      query += ' AND c.teacher_role=?';
      params.push(filter.teacher_role);
    }
    if (filter.domain) {
      query += ' AND c.domain=?';
      params.push(filter.domain);
    }
    if (filter.risk_level) {
      query += ' AND c.risk_level=?';
      params.push(filter.risk_level);
    }
    if (filter.search) {
      query += ' AND (s.name LIKE ? OR c.type LIKE ? OR c.teacher_role LIKE ? OR c.domain LIKE ? OR c.topic LIKE ? OR c.content LIKE ? OR c.summary LIKE ? OR c.follow_up LIKE ? OR c.next_action LIKE ?)';
      const keyword = `%${filter.search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }
    query += " ORDER BY CASE WHEN c.status='진행' THEN 0 ELSE 1 END, CASE c.risk_level WHEN '높음' THEN 0 WHEN '중간' THEN 1 ELSE 2 END, c.date DESC, c.id DESC";
    return this.db.prepare(query).all(...params);
  }

  addCounseling(data) {
    this._ensureCounselingColumns();
    const result = this.db.prepare(
      `INSERT INTO counseling(
        student_id,date,type,teacher_role,domain,topic,summary,content,result,follow_up,mood,risk_level,risk_flags,next_action,next_date,status,confidential_note,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
    ).run(
      data.student_id || null,
      data.date,
      data.type || '개인',
      data.teacher_role || '담임교사',
      data.domain || '',
      data.topic || '',
      data.summary || '',
      data.content || '',
      data.result || '',
      data.follow_up || '',
      data.mood || '',
      data.risk_level || '낮음',
      data.risk_flags || '',
      data.next_action || '',
      data.next_date || '',
      data.status || '진행',
      data.confidential_note || ''
    );
    return result.lastInsertRowid;
  }

  updateCounseling(id, data) {
    this._ensureCounselingColumns();
    this.db.prepare(
      `UPDATE counseling SET
        student_id=?,date=?,type=?,teacher_role=?,domain=?,topic=?,summary=?,content=?,result=?,follow_up=?,
        mood=?,risk_level=?,risk_flags=?,next_action=?,next_date=?,status=?,confidential_note=?,updated_at=datetime('now')
       WHERE id=?`
    ).run(
      data.student_id || null,
      data.date,
      data.type || '개인',
      data.teacher_role || '담임교사',
      data.domain || '',
      data.topic || '',
      data.summary || '',
      data.content || '',
      data.result || '',
      data.follow_up || '',
      data.mood || '',
      data.risk_level || '낮음',
      data.risk_flags || '',
      data.next_action || '',
      data.next_date || '',
      data.status || '진행',
      data.confidential_note || '',
      id
    );
    return true;
  }

  deleteCounseling(id) {
    this.db.prepare('DELETE FROM counseling WHERE id=?').run(id);
    return true;
  }

  getObservations(filter = {}) {
    let query = 'SELECT o.*, s.name, s.number FROM observations o LEFT JOIN students s ON o.student_id=s.id WHERE 1=1';
    const params = [];
    if (filter.student_id) {
      query += ' AND o.student_id=?';
      params.push(filter.student_id);
    }
    query += ' ORDER BY o.date DESC';
    return this.db.prepare(query).all(...params);
  }

  addObservation(data) {
    const result = this.db.prepare(
      'INSERT INTO observations(student_id,date,subject,content) VALUES(?,?,?,?)'
    ).run(data.student_id || null, data.date, data.subject || '', data.content || '');
    return result.lastInsertRowid;
  }

  updateObservation(id, data) {
    this.db.prepare(
      'UPDATE observations SET student_id=?,date=?,subject=?,content=? WHERE id=?'
    ).run(data.student_id || null, data.date, data.subject || '', data.content || '', id);
    return true;
  }

  deleteObservation(id) {
    this.db.prepare('DELETE FROM observations WHERE id=?').run(id);
    return true;
  }

  getLessons(filter = {}) {
    let query = 'SELECT * FROM lessons WHERE 1=1';
    const params = [];
    if (filter.subject) {
      query += ' AND subject=?';
      params.push(filter.subject);
    }
    if (filter.date_from) {
      query += ' AND date>=?';
      params.push(filter.date_from);
    }
    query += ' ORDER BY date DESC, period ASC';
    return this.db.prepare(query).all(...params);
  }

  addLesson(data) {
    const result = this.db.prepare(
      'INSERT INTO lessons(date,subject,period,topic,content,homework) VALUES(?,?,?,?,?,?)'
    ).run(data.date, data.subject || '', data.period || 1, data.topic || '', data.content || '', data.homework || '');
    return result.lastInsertRowid;
  }

  updateLesson(id, data) {
    this.db.prepare(
      'UPDATE lessons SET date=?,subject=?,period=?,topic=?,content=?,homework=? WHERE id=?'
    ).run(data.date, data.subject || '', data.period || 1, data.topic || '', data.content || '', data.homework || '', id);
    return true;
  }

  deleteLesson(id) {
    this.db.prepare('DELETE FROM lessons WHERE id=?').run(id);
    return true;
  }

  getAssessments() {
    return this.db.prepare('SELECT * FROM assessments ORDER BY date DESC').all();
  }

  addAssessment(data) {
    const result = this.db.prepare(
      'INSERT INTO assessments(name,subject,type,date,max_score,weight,note) VALUES(?,?,?,?,?,?,?)'
    ).run(data.name, data.subject || '', data.type || '수행', data.date || '', data.max_score || 100, data.weight || 1, data.note || '');
    return result.lastInsertRowid;
  }

  updateAssessment(id, data) {
    this.db.prepare(
      'UPDATE assessments SET name=?,subject=?,type=?,date=?,max_score=?,weight=?,note=? WHERE id=?'
    ).run(data.name, data.subject || '', data.type || '수행', data.date || '', data.max_score || 100, data.weight || 1, data.note || '', id);
    return true;
  }

  deleteAssessment(id) {
    this.db.prepare('DELETE FROM assessments WHERE id=?').run(id);
    return true;
  }

  getAssessmentScores(assessmentId) {
    return this.db.prepare(
      'SELECT sc.*, s.name, s.number FROM assessment_scores sc JOIN students s ON sc.student_id=s.id WHERE sc.assessment_id=? ORDER BY s.number'
    ).all(assessmentId);
  }

  setAssessmentScore(data) {
    this.db.prepare(
      'INSERT OR REPLACE INTO assessment_scores(assessment_id,student_id,score,note) VALUES(?,?,?,?)'
    ).run(data.assessment_id, data.student_id, data.score || 0, data.note || '');
    return true;
  }

  getSubmissions() {
    return this.db.prepare('SELECT * FROM submissions ORDER BY due_date DESC').all();
  }

  addSubmission(data) {
    const result = this.db.prepare(
      'INSERT INTO submissions(name,subject,due_date,note) VALUES(?,?,?,?)'
    ).run(data.name, data.subject || '', data.due_date || '', data.note || '');
    return result.lastInsertRowid;
  }

  updateSubmission(id, data) {
    this.db.prepare(
      'UPDATE submissions SET name=?,subject=?,due_date=?,note=? WHERE id=?'
    ).run(data.name, data.subject || '', data.due_date || '', data.note || '', id);
    return true;
  }

  deleteSubmission(id) {
    this.db.prepare('DELETE FROM submissions WHERE id=?').run(id);
    return true;
  }

  getSubmissionStatus(submissionId) {
    return this.db.prepare(
      'SELECT ss.*, s.name, s.number FROM submission_status ss JOIN students s ON ss.student_id=s.id WHERE ss.submission_id=? ORDER BY s.number'
    ).all(submissionId);
  }

  setSubmissionStatus(data) {
    this.db.prepare(
      'INSERT OR REPLACE INTO submission_status(submission_id,student_id,submitted,submitted_at,note) VALUES(?,?,?,?,?)'
    ).run(data.submission_id, data.student_id, data.submitted ? 1 : 0, data.submitted_at || '', data.note || '');
    return true;
  }

  getTodos(includeDone = false) {
    this._ensureTodoCalendarColumn();
    return includeDone
      ? this.db.prepare('SELECT * FROM todos ORDER BY is_done, created_at DESC').all()
      : this.db.prepare('SELECT * FROM todos WHERE is_done=0 ORDER BY created_at DESC').all();
  }

  addTodo(data) {
    this._ensureTodoCalendarColumn();
    const result = this.db.prepare(
      'INSERT INTO todos(title,deadline,priority,category,is_ai_generated,source_text) VALUES(?,?,?,?,?,?)'
    ).run(data.title, data.deadline || '', data.priority || '보통', data.category || '기타', data.is_ai_generated ? 1 : 0, data.source_text || '');
    return result.lastInsertRowid;
  }

  updateTodo(id, data) {
    this._ensureTodoCalendarColumn();
    this.db.prepare(
      'UPDATE todos SET title=?,deadline=?,priority=?,category=? WHERE id=?'
    ).run(data.title, data.deadline || '', data.priority || '보통', data.category || '기타', id);
    return true;
  }

  setTodoGcalId(id, gcalEventId) {
    this._ensureTodoCalendarColumn();
    this.db.prepare('UPDATE todos SET gcal_event_id=? WHERE id=?').run(gcalEventId, id);
    return true;
  }

  getTodoGcalId(id) {
    this._ensureTodoCalendarColumn();
    const row = this.db.prepare('SELECT gcal_event_id FROM todos WHERE id=?').get(id);
    return row ? row.gcal_event_id : null;
  }

  toggleTodo(id) {
    this.db.prepare('UPDATE todos SET is_done=CASE WHEN is_done=0 THEN 1 ELSE 0 END WHERE id=?').run(id);
    return true;
  }

  deleteTodo(id) {
    this.db.prepare('DELETE FROM todos WHERE id=?').run(id);
    return true;
  }

  replaceTodos(items = []) {
    this._ensureTodoCalendarColumn();
    const replaceAll = this.db.transaction((rows) => {
      this.db.prepare('DELETE FROM todos').run();
      const insert = this.db.prepare(
        'INSERT INTO todos(id,title,deadline,priority,category,is_done,is_ai_generated,source_text,created_at,gcal_event_id) VALUES(?,?,?,?,?,?,?,?,?,?)'
      );
      for (const row of rows) {
        insert.run(
          row.id,
          row.title || '',
          row.deadline || '',
          row.priority || '보통',
          row.category || '기타',
          row.is_done ? 1 : 0,
          row.is_ai_generated ? 1 : 0,
          row.source_text || '',
          row.created_at || '',
          row.gcal_event_id || ''
        );
      }
    });
    replaceAll(items);
    return true;
  }

  getDdays() {
    return this.db.prepare('SELECT * FROM ddays ORDER BY target_date').all();
  }

  addDday(data) {
    const result = this.db.prepare(
      'INSERT INTO ddays(title,target_date,color) VALUES(?,?,?)'
    ).run(data.title, data.target_date, data.color || '#6366f1');
    return result.lastInsertRowid;
  }

  deleteDday(id) {
    this.db.prepare('DELETE FROM ddays WHERE id=?').run(id);
    return true;
  }

  getTimetable() {
    return this.db.prepare('SELECT * FROM timetable ORDER BY day_of_week, period').all();
  }

  setTimetableCell(data) {
    this.db.prepare(
      'INSERT OR REPLACE INTO timetable(day_of_week,period,subject,teacher,room,is_my_class) VALUES(?,?,?,?,?,?)'
    ).run(data.day_of_week, data.period, data.subject || '', data.teacher || '', data.room || '', data.is_my_class ? 1 : 0);
    return true;
  }

  clearTimetable() {
    this.db.prepare('DELETE FROM timetable').run();
    return true;
  }

  replaceTimetable(items = []) {
    const replaceAll = this.db.transaction((rows) => {
      this.db.prepare('DELETE FROM timetable').run();
      const insert = this.db.prepare(
        'INSERT INTO timetable(day_of_week,period,subject,teacher,room,is_my_class) VALUES(?,?,?,?,?,?)'
      );
      for (const row of rows) {
        insert.run(
          row.day_of_week,
          row.period,
          row.subject || '',
          row.teacher || '',
          row.room || '',
          row.is_my_class ? 1 : 0
        );
      }
    });
    replaceAll(items);
    return true;
  }

  getDailyMemo(date) {
    const row = this.db.prepare('SELECT content FROM daily_memo WHERE date=?').get(date);
    return row ? row.content : '';
  }

  setDailyMemo(date, content) {
    this.db.prepare(
      "INSERT OR REPLACE INTO daily_memo(date,content,updated_at) VALUES(?,?,datetime('now'))"
    ).run(date, content);
    return true;
  }

  getDailyMemos(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return this.db.prepare('SELECT date, content FROM daily_memo WHERE date LIKE ? ORDER BY date').all(`${prefix}%`);
  }
}

module.exports = AppDatabase;
