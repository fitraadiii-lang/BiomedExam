import React, { useState, useEffect, useCallback } from 'react';
import { User, Exam, QuestionType, Answer, GradedAnswer, Submission, Question } from '../types';
import { DB } from '../services/db';

interface ExamRunnerProps {
  user: User;
  exam: Exam;
  onFinish: () => void;
}

const MAX_VIOLATIONS = 3;

// Fisher-Yates Shuffle
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
  
  // Student Identity State
  const [inputName, setInputName] = useState(user.name);
  const [inputNim, setInputNim] = useState('');
  
  // Exam State
  const [hasStarted, setHasStarted] = useState(false);

  // Initialize: Shuffle questions on mount only
  useEffect(() => {
    // Randomize order for this specific student session
    const shuffled = shuffleArray(exam.questions);
    setShuffledQuestions(shuffled);
    
    setAnswers(exam.questions.map(q => ({
      questionId: q.id,
      selectedOptionIndex: undefined,
      essayText: ''
    })));
  }, [exam.questions]);

  // Timer Logic: Absolute Time
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;

    const interval = setInterval(() => {
        const now = Date.now();
        const endTime = new Date(exam.endTime).getTime();
        const diff = Math.floor((endTime - now) / 1000);

        if (diff <= 0) {
            clearInterval(interval);
            setTimeLeft(0);
            handleSubmit(true); // Auto Submit on Time Limit
        } else {
            setTimeLeft(diff);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, exam.endTime, isLocked, isTerminated]);

  // Live Session Heartbeat
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;

    // Initial session create
    updateLiveSession();

    // Heartbeat every 10 seconds
    const interval = setInterval(updateLiveSession, 10000);

    return () => clearInterval(interval);
  }, [hasStarted, isLocked, isTerminated, violationCount, inputName]);

  const updateLiveSession = () => {
    DB.updateSession({
      examId: exam.id,
      studentId: user.id,
      studentName: inputName,
      startedAt: new Date().toISOString(), // Keep updating or store initial separate? For simplicity we use this for "Active" status
      lastHeartbeat: new Date().toISOString(),
      violationCount: violationCount
    });
  };

  // Security & Event Listeners
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      const message = "Peringatan: Ujian sedang berlangsung.";
      e.returnValue = message; 
      return message;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) recordViolation("Meninggalkan tab ujian.");
    };

    const handleBlur = () => recordViolation("Kehilangan fokus layar.");

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isLocked && !isTerminated) {
        recordViolation("Keluar dari fullscreen.");
      }
    };

    const preventRestrictedActions = (e: Event) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.key === 'c') || 
        (e.ctrlKey && e.key === 'v') || 
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        recordViolation("Tombol terlarang terdeteksi.");
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', preventRestrictedActions);
    document.addEventListener('copy', preventRestrictedActions);
    document.addEventListener('paste', preventRestrictedActions);
    document.addEventListener('cut', preventRestrictedActions);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', preventRestrictedActions);
      document.removeEventListener('copy', preventRestrictedActions);
      document.removeEventListener('paste', preventRestrictedActions);
      document.removeEventListener('cut', preventRestrictedActions);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasStarted, isLocked, isTerminated]);

  const recordViolation = (msg: string) => {
    if (isTerminated || isLocked) return;

    setViolationCount(prev => {
      const newCount = prev + 1;
      
      // Force update session immediately on violation
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
    if (!inputName.trim() || !inputNim.trim()) {
      alert("Lengkapi identitas terlebih dahulu.");
      return;
    }

    const now = Date.now();
    const endTime = new Date(exam.endTime).getTime();
    if (now > endTime) {
        alert("Waktu ujian sudah habis.");
        onFinish();
        return;
    }

    try {
      await document.documentElement.requestFullscreen();
      setHasStarted(true);
    } catch (err) {
      alert("Wajib Fullscreen untuk memulai.");
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (err) {}
    }

    // Basic auto grading for MCQ
    let totalScore = 0;
    const gradedAnswers: GradedAnswer[] = answers.map(ans => {
      const q = exam.questions.find(q => q.id === ans.questionId);
      let score = 0;
      if (q && q.type === QuestionType.MULTIPLE_CHOICE) {
        if (ans.selectedOptionIndex === q.correctOptionIndex) {
          score = q.points;
        }
      }
      totalScore += score;
      return { ...ans, score };
    });

    const submission: Submission = {
      id: Date.now().toString(),
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

    DB.saveSubmission(submission);
    
    if (isViolationTermination) {
      // Show red screen (Terminated)
    } else if (autoSubmit) {
        alert('Waktu Habis! Jawaban tersimpan otomatis.');
        onFinish();
    } else {
        alert('Ujian Selesai! Jawaban tersimpan.');
        onFinish();
    }
  };

  // 1. Pre-Start
  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white max-w-lg w-full rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Persiapan Ujian</h2>
            <p className="text-sm text-gray-500 mt-2">
                Soal akan diacak oleh sistem. Waktu ujian mengikuti jadwal server.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
              <input type="text" className="w-full border p-2 rounded" value={inputName} onChange={(e) => setInputName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIM</label>
              <input type="text" className="w-full border p-2 rounded" placeholder="NIM" value={inputNim} onChange={(e) => setInputNim(e.target.value)} />
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 mb-6">
             <p className="font-bold">Ketentuan:</p>
             <ul className="list-disc ml-4">
                 <li>Wajib Fullscreen & dilarang pindah tab.</li>
                 <li>Ujian otomatis tertutup pada {new Date(exam.endTime).toLocaleTimeString('id-ID')}.</li>
                 <li>Soal antar mahasiswa berbeda urutan.</li>
             </ul>
          </div>

          <button 
            onClick={startExam}
            disabled={!inputName || !inputNim}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Mulai Ujian
          </button>
        </div>
      </div>
    );
  }

  // 2. Terminated
  if (isTerminated) {
    return (
      <div className="fixed inset-0 bg-red-900 flex items-center justify-center p-4 z-[9999]">
         <div className="bg-white max-w-lg w-full rounded p-8 text-center">
            <h2 className="text-3xl font-bold text-red-700 mb-4">DISKUALIFIKASI</h2>
            <p className="mb-6">Sistem mendeteksi kecurangan berulang kali.</p>
            <button onClick={onFinish} className="bg-gray-800 text-white px-6 py-2 rounded">Keluar</button>
         </div>
      </div>
    );
  }

  // 3. Main Exam
  return (
    <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="sticky top-0 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div>
          <h2 className="text-xl font-bold truncate max-w-md">{exam.courseName}</h2>
          <p className="text-xs text-slate-300">Selesai Pukul: {new Date(exam.endTime).toLocaleTimeString('id-ID')}</p>
        </div>
        <div className="text-right">
            <span className="block text-xs text-slate-400">Sisa Waktu</span>
            <span className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
               {formatTime(timeLeft)}
            </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 pb-32">
        {violationCount > 0 && (
          <div className="mb-6 bg-red-100 text-red-800 p-3 rounded font-bold text-center">
             PELANGGARAN TERDETEKSI: {violationCount}/{MAX_VIOLATIONS}
          </div>
        )}

        <div className="space-y-8">
          {shuffledQuestions.map((q, idx) => (
            <div key={q.id} className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex gap-4">
                <div className="bg-slate-200 w-8 h-8 flex items-center justify-center rounded-full font-bold text-slate-700 shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-medium text-slate-800 mb-4 whitespace-pre-wrap">{q.text}</p>
                  
                  {q.type === QuestionType.MULTIPLE_CHOICE && (
                    <div className="space-y-3">
                      {q.options?.map((opt, optIdx) => (
                        <label key={optIdx} className="flex items-center p-3 border rounded-lg hover:bg-white cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                          <input 
                            type="radio" 
                            name={`q-${q.id}`} 
                            className="w-4 h-4 text-blue-600"
                            checked={answers.find(a => a.questionId === q.id)?.selectedOptionIndex === optIdx}
                            onChange={() => handleUpdateAnswer(q.id, optIdx, q.type)}
                          />
                          <span className="ml-3 text-slate-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === QuestionType.ESSAY && (
                    <textarea 
                      className="w-full p-4 border rounded-lg outline-none"
                      rows={6}
                      placeholder="Jawaban Essay..."
                      value={answers.find(a => a.questionId === q.id)?.essayText || ''}
                      onChange={(e) => handleUpdateAnswer(q.id, e.target.value, q.type)}
                      onPaste={(e) => e.preventDefault()}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center shadow-lg z-20">
        <button 
          onClick={() => setShowConfirmModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-3 px-12 rounded-full shadow-lg"
        >
          Kumpulkan Jawaban
        </button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                <h3 className="text-2xl font-bold mb-2 text-center">Kumpulkan?</h3>
                <p className="text-center text-gray-600 mb-6">Jawaban tidak dapat diubah setelah ini.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 bg-gray-100 rounded hover:bg-gray-200">Batal</button>
                    <button onClick={() => {setShowConfirmModal(false); handleSubmit();}} className="flex-1 py-3 bg-green-600 text-white rounded hover:bg-green-700">Ya, Kumpulkan</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};