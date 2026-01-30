import { User, Exam, Submission, UserRole, ExamSession } from '../types';

const KEYS = {
  USERS: 'biomed_users',
  EXAMS: 'biomed_exams',
  SUBMISSIONS: 'biomed_submissions',
  SESSIONS: 'biomed_sessions', // New key for live sessions
  CURRENT_USER: 'biomed_current_user',
};

// Helper to get data
const get = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

// Helper to save data
const save = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const DB = {
  // Auth & Users
  login: (email: string): User | undefined => {
    const users = get<User>(KEYS.USERS);
    return users.find(u => u.email === email);
  },

  register: (user: User) => {
    const users = get<User>(KEYS.USERS);
    if (users.find(u => u.email === user.email)) {
      throw new Error('User already exists');
    }
    users.push(user);
    save(KEYS.USERS, users);
    return user;
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },
  
  getStudents: (): User[] => {
    const users = get<User>(KEYS.USERS);
    return users.filter(u => u.role === UserRole.STUDENT);
  },

  // Exams
  saveExam: (exam: Exam) => {
    const exams = get<Exam>(KEYS.EXAMS);
    const index = exams.findIndex(e => e.id === exam.id);
    if (index >= 0) {
      exams[index] = exam;
    } else {
      exams.push(exam);
    }
    save(KEYS.EXAMS, exams);
  },

  getExams: (): Exam[] => {
    return get<Exam>(KEYS.EXAMS);
  },

  getExamById: (id: string): Exam | undefined => {
    const exams = get<Exam>(KEYS.EXAMS);
    return exams.find(e => e.id === id);
  },

  // Submissions
  saveSubmission: (submission: Submission) => {
    const subs = get<Submission>(KEYS.SUBMISSIONS);
    const index = subs.findIndex(s => s.id === submission.id);
    if (index >= 0) {
      subs[index] = submission;
    } else {
      subs.push(submission);
    }
    save(KEYS.SUBMISSIONS, subs);
  },

  getSubmissions: (): Submission[] => {
    return get<Submission>(KEYS.SUBMISSIONS);
  },

  getSubmissionsByExam: (examId: string): Submission[] => {
    const subs = get<Submission>(KEYS.SUBMISSIONS);
    return subs.filter(s => s.examId === examId);
  },
  
  getSubmissionsByStudent: (studentId: string): Submission[] => {
    const subs = get<Submission>(KEYS.SUBMISSIONS);
    return subs.filter(s => s.studentId === studentId);
  },

  // Live Sessions
  updateSession: (session: ExamSession) => {
    const sessions = get<ExamSession>(KEYS.SESSIONS);
    // Remove old session for this user/exam if exists
    const filtered = sessions.filter(s => !(s.examId === session.examId && s.studentId === session.studentId));
    filtered.push(session);
    save(KEYS.SESSIONS, filtered);
  },

  getSessionsByExam: (examId: string): ExamSession[] => {
    const sessions = get<ExamSession>(KEYS.SESSIONS);
    return sessions.filter(s => s.examId === examId);
  }
};