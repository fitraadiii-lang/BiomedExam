import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, QuestionType, Answer, GradedAnswer, Submission, Question } from '../types';
import { DB } from '../services/db';

interface ExamRunnerProps {
  user: User;
  exam: Exam;
  onFinish: () => void;
}

const MAX_VIOLATIONS = 3;
// UPDATE: Interval diubah ke 20 detik agar SANGAT HEMAT kuota Firebase Free Tier (20k writes/day)
const HEARTBEAT_INTERVAL = 20000; 

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
  
  // State untuk Fullscreen Trap
  const [isFullScreenBroken, setIsFullScreenBroken] = useState(false);

  const [inputName, setInputName] = useState(user.name);
  const [inputNim, setInputNim] = useState('');
  
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);

  // Initial Setup: Shuffle & Load Draft
  useEffect(() => {
    // 1. Shuffle Questions
    const shuffled = shuffleArray(exam.questions);
    setShuffledQuestions(shuffled);

    // 2. Initialize Answers
    const initialAnswers = exam.questions.map(q => ({ questionId: q.id, selectedOptionIndex: undefined, essayText: '' }));
    
    // 3. Check for Auto-Saved Draft (Crash Protection)
    const savedDraft = localStorage.getItem(`EXAM_DRAFT_${exam.id}_${user.id}`);
    if (savedDraft) {
       try {
         const parsedDraft = JSON.parse(savedDraft);
         // Merge draft answers with structure
         const mergedAnswers = initialAnswers.map(init => {
            const found = parsedDraft.find((d: Answer) => d.questionId === init.questionId);
            return found || init;
         });
         setAnswers(mergedAnswers);
         // Restore name/nim if saved
         const savedMeta = localStorage.getItem(`EXAM_META_${exam.id}_${user.id}`);
         if (savedMeta) {
            const meta = JSON.parse(savedMeta);
            setInputName(meta.name || user.name);
            setInputNim(meta.nim || '');
            setHasStarted(true); // Auto-resume
         }
       } catch (e) {
         setAnswers(initialAnswers);
       }
    } else {
       setAnswers(initialAnswers);
    }
    setIsLoadingDraft(false);
  }, [exam.id, user.id]);

  // Auto-Save Effect
  useEffect(() => {
    if (!hasStarted || isLocked) return;
    const timer = setTimeout(() => {
       localStorage.setItem(`EXAM_DRAFT_${exam.id}_${user.id}`, JSON.stringify(answers));
       localStorage.setItem(`EXAM_META_${exam.id}_${user.id}`, JSON.stringify({ name: inputName, nim: inputNim }));
    }, 1000); // Save 1 second after last change
    return () => clearTimeout(timer);
  }, [answers, inputName, inputNim, hasStarted, isLocked]);

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

  // Live Session Heartbeat
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;
    updateLiveSession(); // Initial update immediately
    const interval = setInterval(updateLiveSession, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [hasStarted, isLocked, isTerminated, violationCount, inputName]);

  const updateLiveSession = async () => {
    // Only update to cloud, fire and forget
    DB.updateSession({
      examId: exam.id,
      studentId: user.id,
      studentName: inputName,
      startedAt: new Date().toISOString(), 
      lastHeartbeat: new Date().toISOString(),
      violationCount: violationCount
    }).catch(e => console.error("Session update failed", e));
  };

  // --- SECURITY ENHANCEMENT: FULLSCREEN TRAP & KEYBOARD LOCK ---
  useEffect(() => {
    if (!hasStarted || isLocked || isTerminated) return;

    // 1. Fullscreen Change Listener
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // User exited fullscreen (pressed ESC or switched app)
        setIsFullScreenBroken(true);
        recordViolation("Keluar dari Mode Layar Penuh (ESC ditekan)");
      } else {
        setIsFullScreenBroken(false);
      }
    };

    // 2. Visibility & Blur
    const handleVisibilityChange = () => { if (document.hidden) recordViolation("Meninggalkan tab ujian/Membuka aplikasi lain."); };
    const handleBlur = () => recordViolation("Kehilangan fokus layar.");
    
    // 3. Prevent Context Menu
    const handleContextMenu = (e: Event) => e.preventDefault();
    
    // 4. Prevent Copy Paste
    const handleCopyPaste = (e: Event) => {
        e.preventDefault();
        alert("Copy/Paste dinonaktifkan!");
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    
    // Try to lock keyboard (Chrome only feature)
    if ('keyboard' in navigator && 'lock' in (navigator as any).keyboard) {
        (navigator as any).keyboard.lock(['Escape', 'Alt', 'Tab', 'Meta']).catch((e: any) => console.log("Keyboard lock failed", e));
    }
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
    };
  }, [hasStarted, isLocked, isTerminated]);

  const recordViolation = (msg: string) => {
    if (isTerminated || isLocked) return;
    
    setViolationCount(prev => {
      const newCount = prev + 1;
      // Force update immediately on violation
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
      
      // Jika violation karena fullscreen broken, jangan alert, karena akan ada overlay modal
      if (!isFullScreenBroken) {
         // alert(`PELANGGARAN (${newCount}/${MAX_VIOLATIONS}):\n${msg}`);
      }
      return newCount;
    });
  };

  const reEnterFullscreen = async () => {
     try {
        await document.documentElement.requestFullscreen();
        setIsFullScreenBroken(false);
     } catch (e) {
        alert("Gagal masuk fullscreen. Mohon gunakan browser Chrome/Edge terbaru.");
     }
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
    
    // Unlock everything
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if ('keyboard' in navigator && 'unlock' in (navigator as any).keyboard) {
        (navigator as any).keyboard.unlock();
    }

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
      id: `${exam.id}_${user.id}_${Date.now()}`,
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
        // Clean up Draft only on successful submission
        localStorage.removeItem(`EXAM_DRAFT_${exam.id}_${user.id}`);
        localStorage.removeItem(`EXAM_META_${exam.id}_${user.id}`);
        alert(isViolationTermination ? "Sistem mendeteksi kecurangan berulang. Ujian dihentikan otomatis." : "Jawaban berhasil terkirim ke Cloud!");
    } catch (e) {
        alert("Gagal menyimpan ke cloud. Jawaban akan disimpan lokal sebagai backup.");
        console.error(e);
    }
    onFinish();
  };

  if (isLoadingDraft) return <div className="p-8 text-center">Memuat data ujian...</div>;

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 z-50">
        <div className="bg-white max-w-lg w-full rounded p-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-4">Identitas Peserta</h2>
          <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 mb-4 border border-yellow-200">
             Mode Ujian Aman Aktif: Fullscreen Wajib. Jangan tinggalkan halaman ini.
          </div>
          <input className="w-full border p-2 mb-2 rounded" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Nama Lengkap" />
          <input className="w-full border p-2 mb-4 rounded" value={inputNim} onChange={e => setInputNim(e.target.value)} placeholder="NIM" />
          <button onClick={startExam} className="w-full bg-green-600 text-white py-3 rounded font-bold shadow-lg hover:bg-green-700 transition-transform transform active:scale-95">
             Mulai Ujian
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto select-none" onContextMenu={(e) => e.preventDefault()}>
      
      {/* FULLSCREEN TRAP OVERLAY */}
      {isFullScreenBroken && !isTerminated && !isLocked && (
          <div className="fixed inset-0 z-[100000] bg-white flex flex-col items-center justify-center p-10 text-center animate-fade-in">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-red-600 mb-2">PELANGGARAN TERDETEKSI</h1>
              <p className="text-xl text-gray-800 mb-8 max-w-md">
                 Anda dilarang keluar dari mode Fullscreen. Sistem telah mencatat aktivitas ini sebagai kecurangan.
              </p>
              <button 
                  onClick={reEnterFullscreen}
                  className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-red-700 transition-transform transform hover:scale-105"
              >
                  KEMBALI KE UJIAN SEKARANG
              </button>
              <p className="mt-4 text-sm text-gray-500">Klik tombol di atas untuk melanjutkan pengerjaan.</p>
          </div>
      )}

      <div className="sticky top-0 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div>
           <div className="font-bold">{exam.courseName}</div>
           <div className="text-xs text-slate-300">{inputName} ({inputNim})</div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-xs text-green-400 bg-slate-800 px-2 py-1 rounded">
               ● Auto-Save Aktif
            </div>
            <div className={`text-xl font-mono font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
               {formatTime(timeLeft)}
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 pb-32">
        {shuffledQuestions.map((q, idx) => (
            <div key={q.id} className="bg-slate-50 p-6 rounded-xl border mb-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="font-bold text-slate-500">{idx + 1}.</div>
                <div className="flex-1">
                  <p className="mb-4 whitespace-pre-wrap text-lg font-medium text-slate-800">{q.text}</p>
                  {q.type === QuestionType.MULTIPLE_CHOICE ? (
                    <div className="space-y-3">
                      {q.options?.map((opt, optIdx) => (
                        <label key={optIdx} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${answers.find(a => a.questionId === q.id)?.selectedOptionIndex === optIdx ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-white bg-slate-50 border-slate-200'}`}>
                          <input type="radio" name={`q-${q.id}`} checked={answers.find(a => a.questionId === q.id)?.selectedOptionIndex === optIdx} onChange={() => handleUpdateAnswer(q.id, optIdx, q.type)} className="w-4 h-4 text-green-600 focus:ring-green-500 mr-3" />
                          <span className="text-slate-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                        className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-inner bg-white" 
                        rows={6} 
                        placeholder="Ketik jawaban uraian Anda di sini..."
                        value={answers.find(a => a.questionId === q.id)?.essayText || ''} 
                        onChange={(e) => handleUpdateAnswer(q.id, e.target.value, q.type)} 
                    />
                  )}
                </div>
              </div>
            </div>
        ))}
      </div>

      <div className="fixed bottom-0 w-full bg-white/90 backdrop-blur-sm p-4 border-t flex justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button onClick={() => setShowConfirmModal(true)} className="bg-green-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition-all transform hover:-translate-y-1">
           Kumpulkan Jawaban
        </button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full transform transition-all scale-100">
                <h3 className="text-xl font-bold mb-2">Sudah yakin?</h3>
                <p className="text-gray-600 mb-6 text-sm">Jawaban yang sudah dikirim tidak dapat diubah lagi.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowConfirmModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Periksa Lagi</button>
                    <button onClick={() => {setShowConfirmModal(false); handleSubmit();}} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Ya, Kumpulkan</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};