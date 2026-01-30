export enum UserRole {
  STUDENT = 'STUDENT',
  LECTURER = 'LECTURER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export enum ExamType {
  UTS = 'UTS',
  UAS = 'UAS',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  ESSAY = 'ESSAY',
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For Multiple Choice
  correctOptionIndex?: number; // For Multiple Choice
  referenceAnswer?: string; // For Essay (used by AI)
  points: number;
}

export interface Exam {
  id: string;
  accessCode: string; // Token unique for students to join
  title: string;
  description: string;
  courseName: string; // Mata Kuliah
  type: ExamType;
  lecturerId: string;
  lecturerName?: string;
  questions: Question[];
  startTime: string; // ISO String
  endTime: string;   // ISO String
  isActive: boolean; // Controls if exam is logically deleted/hidden manually
  createdAt: string;
}

export interface Answer {
  questionId: string;
  selectedOptionIndex?: number;
  essayText?: string;
}

export interface GradedAnswer extends Answer {
  score: number;
  feedback?: string;
}

export interface Submission {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNim?: string; 
  answers: GradedAnswer[];
  totalScore: number;
  submittedAt: string;
  isGraded: boolean;
  violationCount?: number; // Added to track cheating attempts
}

// Track active sessions for live monitoring
export interface ExamSession {
  examId: string;
  studentId: string;
  studentName: string;
  startedAt: string;
  lastHeartbeat: string; // To check if online
  violationCount: number;
}

// AI Service Types
export interface GradingResult {
  score: number;
  feedback: string;
}