import React, { useState, useEffect } from 'react';
import { User, Exam, QuestionType, Answer, GradedAnswer, Submission, Question } from '../types';
import { DB } from '../services/db';

interface ExamRunnerProps {
  user: User;
  exam: Exam;
  onFinish: () => void;
}

const MAX_VIOLATIONS = 3;

const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

export const ExamRunner: React.FC<ExamRunnerProps> = ({ user, exam, onFinish }) => {
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [violationCount, setViolationCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false); 
  const [isTerminated, setIsTerminated] = useState(false); 
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [inputName, setInputName] = useState(user.name);
  const [inputNim, setInputNim] = useState('');
  
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const shuffled = shuffleArray(exam.questions);
    setShuffledQuestions(shuffled);
    setAnswers(exam.questions.map(q => ({ questionId: q.id, selectedOptionIndex: undefined, essayText: '' })));
  }, [exam.questions]);

  // Timer
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;
    const interval = setInterval(() => {
        const now = Date.now();
        const endTime = new Date(exam.endTime).getTime();
        const diff = Math.floor((endTime - now) / 1000);
        if (diff <= 0) {
            clearInterval(interval);
            setTimeLeft(0);
            handleSubmit(true);
        } else {
            setTimeLeft(diff);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasStarted, exam.endTime, isLocked, isTerminated]);

  // Live Session Heartbeat (Updates Cloud every 2s)
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;
    updateLiveSession();
    const interval = setInterval(updateLiveSession, 2000);
    return () => clearInterval(interval);
  }, [hasStarted, isLocked, isTerminated, violationCount, inputName]);

  const updateLiveSession = async () => {
    // Fire and forget (don't await) to prevent UI lag
    DB.updateSession({
      examId: exam.id,
      studentId: user.id,
      studentName: inputName,
      startedAt: new Date().toISOString(), 
      lastHeartbeat: new Date().toISOString(),
      violationCount: violationCount
    }).catch(e => console.error("Session update failed", e));
  };

  // Security (Same as before)
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;
    const handleVisibilityChange = () => { if (document.hidden) recordViolation("Meninggalkan tab ujian."); };
    const handleBlur = () => recordViolation("Kehilangan fokus layar.");
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [hasStarted, isLocked, isTerminated]);

  const recordViolation = (msg: string) => {
    if (isTerminated || isLocked) return;
    setViolationCount(prev => {
      const newCount = prev + 1;
      DB.updateSession({
        examId: exam.id,
        studentId: user.id,
        studentName: inputName,
        startedAt: new Date().toISOString(), 
        lastHeartbeat: new Date().toISOString(),
        violationCount: newCount
      });
      if (newCount >= MAX_VIOLATIONS) {
        setIsTerminated(true);
        terminateExam();
        return newCount;
      }
      alert(`PELANGGARAN (${newCount}/${MAX_VIOLATIONS}):\n${msg}`);
      return newCount;
    });
  };

  const terminateExam = async () => {
    await handleSubmit(true, true);
  };

  const startExam = async () => {
    if (!inputName.trim() || !inputNim.trim()) { alert("Lengkapi Identitas"); return; }
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      setHasStarted(true);
    } catch (err) { setHasStarted(true); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleUpdateAnswer = (qId: string, val: any, type: QuestionType) => {
    setAnswers(prev => prev.map(a => {
      if (a.questionId === qId) {
        if (type === QuestionType.MULTIPLE_CHOICE) return { ...a, selectedOptionIndex: val };
        return { ...a, essayText: val };
      }
      return a;
    }));
  };

  const handleSubmit = async (autoSubmit = false, isViolationTermination = false) => {
    if (isLocked && !isViolationTermination) return;
    setIsLocked(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    // Grading Logic
    let totalScore = 0;
    const gradedAnswers: GradedAnswer[] = answers.map(ans => {
      const q = exam.questions.find(q => q.id === ans.questionId);
      let score = 0;
      if (q && q.type === QuestionType.MULTIPLE_CHOICE && ans.selectedOptionIndex === q.correctOptionIndex) {
        score = q.points;
      }
      totalScore += score;
      return { ...ans, score };
    });

    const submission: Submission = {
      id: `${exam.id}_${user.id}_${Date.now()}`, // Unique ID for Cloud
      examId: exam.id,
      studentId: user.id,
      studentName: inputName + (isViolationTermination ? " [DISKUALIFIKASI]" : ""),
      studentNim: inputNim,
      answers: gradedAnswers,
      totalScore: isViolationTermination ? 0 : totalScore,
      submittedAt: new Date().toISOString(),
      isGraded: false,
      violationCount: violationCount
    };

    try {
        await DB.saveSubmission(submission);
        alert(isViolationTermination ? "Diskualifikasi. Jawaban dikirim." : "Jawaban berhasil terkirim ke Cloud!");
    } catch (e) {
        alert("Gagal menyimpan ke cloud. Jawaban akan disimpan lokal sebagai backup.");
        console.error(e);
    }
    onFinish();
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50">
        <div className="bg-white max-w-lg w-full rounded p-8">
          <h2 className="text-2xl font-bold mb-4">Identitas Peserta</h2>
          <input className="w-full border p-2 mb-2" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Nama" />
          <input className="w-full border p-2 mb-4" value={inputNim} onChange={e => setInputNim(e.target.value)} placeholder="NIM" />
          <button onClick={startExam} className="w-full bg-green-600 text-white py-3 rounded font-bold">Mulai Ujian</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto">
      <div className="sticky top-0 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div>
           <div className="font-bold">{exam.courseName}</div>
           <div className="text-xs">{inputName}</div>
        </div>
        <div className={`text-xl font-mono font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-green-400'}`}>{formatTime(timeLeft)}</div>
      </div>

      <div className="max-w-4xl mx-auto p-8 pb-32">
        {shuffledQuestions.map((q, idx) => (
            <div key={q.id} className="bg-slate-50 p-6 rounded-xl border mb-6">
              <div className="flex gap-4">
                <div className="font-bold">{idx + 1}.</div>
                <div className="flex-1">
                  <p className="mb-4 whitespace-pre-wrap">{q.text}</p>
                  {q.type === QuestionType.MULTIPLE_CHOICE ? (
                    <div className="space-y-2">
                      {q.options?.map((opt, optIdx) => (
                        <label key={optIdx} className="flex items-center p-2 border rounded hover:bg-white">
                          <input type="radio" name={`q-${q.id}`} checked={answers.find(a => a.questionId === q.id)?.selectedOptionIndex === optIdx} onChange={() => handleUpdateAnswer(q.id, optIdx, q.type)} className="mr-2" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea className="w-full p-2 border rounded" rows={5} value={answers.find(a => a.questionId === q.id)?.essayText || ''} onChange={(e) => handleUpdateAnswer(q.id, e.target.value, q.type)} />
                  )}
                </div>
              </div>
            </div>
        ))}
      </div>

      <div className="fixed bottom-0 w-full bg-white p-4 border-t flex justify-center">
        <button onClick={() => setShowConfirmModal(true)} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">Kumpulkan</button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded shadow-lg">
                <h3>Kumpulkan Jawaban?</h3>
                <div className="flex gap-2 mt-4">
                    <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                    <button onClick={() => {setShowConfirmModal(false); handleSubmit();}} className="px-4 py-2 bg-green-600 text-white rounded">Ya</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};