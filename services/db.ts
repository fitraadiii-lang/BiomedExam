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

// Helper untuk menangani error Firebase dengan pesan yang jelas
const handleFirebaseError = (e: any) => {
  console.error("Firebase Error Full:", e);
  if (e.code === 'permission-denied') {
    throw new Error("AKSES DITOLAK: Database dikunci. Buka Firebase Console > Firestore Database > Rules tab > Ubah menjadi 'allow read, write: if true;'");
  }
  if (e.code === 'failed-precondition' || e.code === 'unavailable') {
    throw new Error("DATABASE BELUM SIAP: Pastikan Anda sudah klik 'Create Database' di menu Firestore Database pada Firebase Console.");
  }
  throw e;
};

// --- HYBRID DATABASE SERVICE ---
export const DB = {
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
    if (!isFirebaseConfigured) {
       return LS.find<User>(KEYS.LS_USERS, u => u.email === email);
    }
    try {
      const q = query(collection(db, KEYS.USERS), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return undefined;
      return querySnapshot.docs[0].data() as User;
    } catch (e) {
      handleFirebaseError(e);
      return undefined;
    }
  },

  register: async (user: User): Promise<User> => {
    // Check duplication
    const existing = await DB.login(user.email);
    if (existing) throw new Error('User already exists');

    if (!isFirebaseConfigured) {
      LS.add(KEYS.LS_USERS, user);
      return user;
    }
    
    try {
      await setDoc(doc(db, KEYS.USERS, user.id), sanitize(user));
      return user;
    } catch (e) {
      handleFirebaseError(e);
      throw e;
    }
  },
  
  getStudents: async (): Promise<User[]> => {
    if (!isFirebaseConfigured) {
      return LS.filter<User>(KEYS.LS_USERS, u => u.role === UserRole.STUDENT);
    }
    try {
      const q = query(collection(db, KEYS.USERS), where("role", "==", UserRole.STUDENT));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as User);
    } catch (e) {
      console.error("Get Students Error", e);
      return [];
    }
  },

  // === EXAMS ===
  saveExam: async (exam: Exam) => {
    if (!isFirebaseConfigured) {
      LS.add(KEYS.LS_EXAMS, exam);
      return;
    }
    try {
      await setDoc(doc(db, KEYS.EXAMS, exam.id), sanitize(exam));
    } catch (e) {
      handleFirebaseError(e);
    }
  },

  getExams: async (): Promise<Exam[]> => {
    if (!isFirebaseConfigured) {
      return LS.get<Exam>(KEYS.LS_EXAMS);
    }
    try {
      const querySnapshot = await getDocs(collection(db, KEYS.EXAMS));
      return querySnapshot.docs.map(d => d.data() as Exam);
    } catch (e) {
      console.error("Get Exams Error (Initial Load)", e);
      // Jangan throw di sini agar halaman tidak crash total saat load awal
      return []; 
    }
  },

  getExamById: async (id: string): Promise<Exam | undefined> => {
    if (!isFirebaseConfigured) {
      return LS.find<Exam>(KEYS.LS_EXAMS, e => e.id === id);
    }
    try {
      const docRef = doc(db, KEYS.EXAMS, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Exam) : undefined;
    } catch (e) {
      handleFirebaseError(e);
      return undefined;
    }
  },

  deleteExam: async (id: string) => {
    if (!isFirebaseConfigured) {
      LS.remove(KEYS.LS_EXAMS, id);
      return;
    }
    try {
      await deleteDoc(doc(db, KEYS.EXAMS, id));
    } catch (e) {
      handleFirebaseError(e);
    }
  },

  // === SUBMISSIONS ===
  saveSubmission: async (submission: Submission) => {
    if (!isFirebaseConfigured) {
      LS.add(KEYS.LS_SUBMISSIONS, submission);
      return;
    }
    try {
      await setDoc(doc(db, KEYS.SUBMISSIONS, submission.id), sanitize(submission));
    } catch (e) {
      handleFirebaseError(e);
    }
  },

  getSubmissions: async (): Promise<Submission[]> => {
    if (!isFirebaseConfigured) {
      return LS.get<Submission>(KEYS.LS_SUBMISSIONS);
    }
    try {
      const querySnapshot = await getDocs(collection(db, KEYS.SUBMISSIONS));
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
       console.error("Get Subs Error", e);
       return [];
    }
  },

  getSubmissionsByExam: async (examId: string): Promise<Submission[]> => {
    if (!isFirebaseConfigured) {
      return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.examId === examId);
    }
    try {
      const q = query(collection(db, KEYS.SUBMISSIONS), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
      console.error("Get Subs by Exam Error", e);
      return [];
    }
  },
  
  getSubmissionsByStudent: async (studentId: string): Promise<Submission[]> => {
    if (!isFirebaseConfigured) {
      return LS.filter<Submission>(KEYS.LS_SUBMISSIONS, s => s.studentId === studentId);
    }
    try {
      const q = query(collection(db, KEYS.SUBMISSIONS), where("studentId", "==", studentId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as Submission);
    } catch (e) {
      console.error("Get Subs by Student Error", e);
      return [];
    }
  },

  // === LIVE SESSIONS ===
  updateSession: async (session: ExamSession) => {
    const sessionId = `${session.examId}_${session.studentId}`;
    if (!isFirebaseConfigured) {
      // Mock session update in LS
      const sessions = LS.get<ExamSession>(KEYS.LS_SESSIONS);
      const idx = sessions.findIndex(s => `${s.examId}_${s.studentId}` === sessionId);
      if (idx >= 0) sessions[idx] = session;
      else sessions.push(session);
      LS.set(KEYS.LS_SESSIONS, sessions);
      return;
    }
    // Fire and forget, but catch errors to avoid crashing exam
    setDoc(doc(db, KEYS.SESSIONS, sessionId), sanitize(session)).catch(e => console.error("Session update error (non-fatal)", e));
  },

  getSessionsByExam: async (examId: string): Promise<ExamSession[]> => {
    if (!isFirebaseConfigured) {
      return LS.filter<ExamSession>(KEYS.LS_SESSIONS, s => s.examId === examId);
    }
    try {
      const q = query(collection(db, KEYS.SESSIONS), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as ExamSession);
    } catch (e) {
      console.error("Get Sessions Error", e);
      return [];
    }
  }
};