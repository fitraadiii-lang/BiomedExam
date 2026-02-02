import { User, Exam, Submission, UserRole, ExamSession } from '../types';
import { db, isFirebaseConfigured } from '../src/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where,
  deleteDoc
} from 'firebase/firestore';

const KEYS = {
  // Key untuk Firestore (Collection Names)
  USERS: 'users',
  EXAMS: 'exams',
  SUBMISSIONS: 'submissions',
  SESSIONS: 'sessions',
  
  // Key untuk LocalStorage (Offline Mode)
  LS_USERS: 'biomed_users',
  LS_EXAMS: 'biomed_exams',
  LS_SUBMISSIONS: 'biomed_submissions',
  LS_SESSIONS: 'biomed_sessions',
  
  CURRENT_USER: 'biomed_current_user',
};

// --- OFFLINE MODE CONTROL ---
let forceOffline = false;

export const setForceOffline = (enabled: boolean) => {
  forceOffline = enabled;
  if (enabled) {
      console.warn("⚠️ APP SWITCHED TO OFFLINE MODE");
  }
};

// Helper to check effective mode
const isOffline = () => !isFirebaseConfigured || forceOffline;

// Helper to remove undefined values (Firestore rejects undefined)
const sanitize = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

// --- HELPER LOCAL STORAGE (OFFLINE MODE) ---
const LS = {
  get: <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data)),
  add: <T extends { id: string }>(key: string, item: T) => {
    const data = LS.get<T>(key);
    const idx = data.findIndex(d => d.id === item.id);
    if (idx >= 0) data[idx] = item; // Update
    else data.push(item); // Insert
    LS.set(key, data);
  },
  find: <T>(key: string, predicate: (item: T) => boolean) => LS.get<T>(key).find(predicate),
  filter: <T>(key: string, predicate: (item: T) => boolean) => LS.get<T>(key).filter(predicate),
  remove: <T extends { id: string }>(key: string, id: string) => {
    const data = LS.get<T>(key).filter(d => d.id !== id);
    LS.set(key, data);
  }
};

// Unified error handler that triggers offline mode on permission issues
const handleDbError = (e: any, context: string) => {
  const msg = e.message || '';
  const code = e.code || '';
  
  // Detect permission denied or general unavailability
  if (code === 'permission-denied' || code === 'unavailable' || msg.includes('Missing or insufficient permissions')) {
    if (!forceOffline) {
        console.warn(`[Auto-Recovery] Switching to Offline Mode due to Firestore error in ${context}: ${code}`);
        setForceOffline(true);
    }
    return true; // signal that we switched to offline/should use fallback
  }
  
  console.error(`${context} Error:`, e);
  return false;
};

// --- HYBRID DATABASE SERVICE ---
export const DB = {
  isOfflineMode: () => isOffline(),

  // Session selalu di LocalStorage (Browser Session)
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

  // === AUTH & USERS ===
  login: async (email: string): Promise<User | undefined> => {
    // Attempt local first if forced
    if (isOffline()) {
       return LS.find<User>(KEYS.LS_USERS, u => u.email === email);
    }
    try {
      const q = query(collection(db, KEYS.USERS), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return undefined;
      return querySnapshot.docs[0].data() as User;
    } catch (e: any) {
      if (handleDbError(e, "Login")) {
         // Retry locally
         return LS.find<User>(KEYS.LS_USERS, u => u.email === email);
      }
      return undefined;
    }
  },

  register: async (user: User): Promise<User> => {
    const existing = await DB.login(user.email);
    if (existing) throw new Error('User already exists');

    if (isOffline()) {
      LS.add(KEYS.LS_USERS, user);
      return user;
    }
    
    try {
      await setDoc(doc(db, KEYS.USERS, user.id), sanitize(user));
      return user;
    } catch (e) {
      if (handleDbError(e, "Register")) {
        LS.add(KEYS.LS_USERS, user);
        return user;
      }
      throw e;
    }
  },
  
  getStudents: async (): Promise<User[]> => {
    if (isOffline()) {
      return LS.filter<User>(KEYS.LS_USERS, u => u.role === UserRole.STUDENT);
    }
    try {
      const q = query(collection(db, KEYS.USERS), where("role", "==", UserRole.STUDENT));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as User);
    } catch (e) {
      if (handleDbError(e, "Get Students")) {
         return LS.filter<User>(KEYS.LS_USERS, u => u.role === UserRole.STUDENT);
      }
      return [];
    }
  },

  // === EXAMS ===
  saveExam: async (exam: Exam) => {
    if (isOffline()) {
      LS.add(KEYS.LS_EXAMS, exam);
      return;
    }
    try {
      await setDoc(doc(db, KEYS.EXAMS, exam.id), sanitize(exam));
    } catch (e) {
      if (handleDbError(e, "Save Exam")) {
        LS.add(KEYS.LS_EXAMS, exam);
        return;
      }
    }
  },

  getExams: async (): Promise<Exam[]> => {
    if (isOffline()) {
      return LS.get<Exam>(KEYS.LS_EXAMS);
    }
    try {
      const querySnapshot = await getDocs(collection(db, KEYS.EXAMS));
      return querySnapshot.docs.map(d => d.data() as Exam);
    } catch (e) {
      if (handleDbError(e, "Get Exams")) {
         return LS.get<Exam>(KEYS.LS_EXAMS);
      }
      return []; 
    }
  },

  getExamById: async (id: string): Promise<Exam | undefined> => {
    if (isOffline()) {
      return LS.find<Exam>(KEYS.LS_EXAMS, e => e.id === id);
    }
    try {
      const docRef = doc(db, KEYS.EXAMS, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Exam) : undefined;
    } catch (e) {
       if (handleDbError(e, "Get Exam By ID")) {
         return LS.find<Exam>(KEYS.LS_EXAMS, ex => ex.id === id);
       }
      return undefined;
    }
  },

  deleteExam: async (id: string) => {
    if (isOffline()) {
      LS.remove(KEYS.LS_EXAMS, id);
      return;
    }
    try {
      await deleteDoc(doc(db, KEYS.EXAMS, id));
    } catch (e) {
       if (handleDbError(e, "Delete Exam")) {
          LS.remove(KEYS.LS_EXAMS, id);
          return;
       }
    }
  },

  // === SUBMISSIONS ===
  saveSubmission: async (submission: Submission) => {
    if (isOffline()) {
      LS.add(KEYS.LS_SUBMISSIONS, submission);
      return;
    }
    try {
      await setDoc(doc(db, KEYS.SUBMISSIONS, submission.id), sanitize(submission));
    } catch (e) {
       if (handleDbError(e, "Save Submission")) {
          LS.add(KEYS.LS_SUBMISSIONS, submission);
          return;
       }
    }
  },

  getSubmissions: async (): Promise<Submission[]> => {
    if (isOffline()) {
      return LS.get<Submission>(KEYS.LS_SUBMISSIONS);
    }
    try {
      const querySnapshot = await getDocs(collection(db, KEYS.SUBMISSIONS));
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
       if (handleDbError(e, "Get Submissions")) {
          return LS.get<Submission>(KEYS.LS_SUBMISSIONS);
       }
       return [];
    }
  },

  getSubmissionsByExam: async (examId: string): Promise<Submission[]> => {
    if (isOffline()) {
      return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.examId === examId);
    }
    try {
      const q = query(collection(db, KEYS.SUBMISSIONS), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
       if (handleDbError(e, "Get Submissions By Exam")) {
          return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.examId === examId);
       }
      return [];
    }
  },
  
  getSubmissionsByStudent: async (studentId: string): Promise<Submission[]> => {
    if (isOffline()) {
      return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.studentId === studentId);
    }
    try {
      const q = query(collection(db, KEYS.SUBMISSIONS), where("studentId", "==", studentId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
       if (handleDbError(e, "Get Submissions By Student")) {
          return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.studentId === studentId);
       }
      return [];
    }
  },

  // === LIVE SESSIONS ===
  updateSession: async (session: ExamSession) => {
    const sessionId = `${session.examId}_${session.studentId}`;
    if (isOffline()) {
      const sessions = LS.get<ExamSession>(KEYS.LS_SESSIONS);
      const idx = sessions.findIndex(s => `${s.examId}_${s.studentId}` === sessionId);
      if (idx >= 0) sessions[idx] = session;
      else sessions.push(session);
      LS.set(KEYS.LS_SESSIONS, sessions);
      return;
    }
    
    try {
        await setDoc(doc(db, KEYS.SESSIONS, sessionId), sanitize(session));
    } catch (e) {
         // Non-fatal, silent fail or switch
         handleDbError(e, "Update Session");
         // Always fallback to LS for session to ensure continuity locally
         const sessions = LS.get<ExamSession>(KEYS.LS_SESSIONS);
         const idx = sessions.findIndex(s => `${s.examId}_${s.studentId}` === sessionId);
         if (idx >= 0) sessions[idx] = session;
         else sessions.push(session);
         LS.set(KEYS.LS_SESSIONS, sessions);
    }
  },

  getSessionsByExam: async (examId: string): Promise<ExamSession[]> => {
    if (isOffline()) {
      return LS.filter<ExamSession>(KEYS.LS_SESSIONS, s => s.examId === examId);
    }
    try {
      const q = query(collection(db, KEYS.SESSIONS), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as ExamSession);
    } catch (e) {
       if (handleDbError(e, "Get Sessions")) {
          return LS.filter<ExamSession>(KEYS.LS_SESSIONS, s => s.examId === examId);
       }
      return [];
    }
  }
};