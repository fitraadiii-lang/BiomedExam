import React, { useState, useEffect } from 'react';
import { User, Exam, ExamType } from '../types';
import { DB } from '../services/db';

interface StudentDashboardProps {
  user: User;
  onStartExam: (examId: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onStartExam }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [completedExamIds, setCompletedExamIds] = useState<Set<string>>(new Set());
  const [accessCode, setAccessCode] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshExams();
    const interval = setInterval(refreshExams, 15000); // Check every 15s from Cloud
    return () => clearInterval(interval);
  }, [user.id]);

  const refreshExams = async () => {
    setIsRefreshing(true);
    try {
      const allExams = await DB.getExams();
      setExams(allExams.filter(e => e.isActive));

      const mySubs = await DB.getSubmissionsByStudent(user.id);
      setCompletedExamIds(new Set(mySubs.map(s => s.examId)));
    } catch (e) {
      console.error("Failed to refresh exams", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return;
    
    // FETCH DATA TERBARU DARI CLOUD UNTUK MEMASTIKAN KONEKTIVITAS
    const allExams = await DB.getExams(); 
    const targetExam = allExams.find(ex => ex.accessCode === accessCode.trim().toUpperCase());

    if (!targetExam) {
      if (DB.isOfflineMode()) {
        alert("⚠️ KODE TIDAK DITEMUKAN (OFFLINE MODE)\n\nAnda saat ini berada dalam Mode Demo/Offline. Ujian yang dibuat Dosen secara Online tidak dapat diakses dari sini.\n\nSOLUSI:\n1. Logout.\n2. Pastikan domain ini terdaftar di Firebase Console.\n3. Login menggunakan tombol 'Masuk dengan Google' (Jangan pakai Mode Demo).");
      } else {
        alert("Kode ujian tidak valid atau belum dipublish oleh Dosen.\n\nTips:\n1. Pastikan Dosen sudah tekan tombol 'Publish'.\n2. Periksa kembali huruf besar/kecil.\n3. Pastikan koneksi internet lancar.");
      }
      return;
    }

    validateAndStart(targetExam);
  };

  const validateAndStart = (exam: Exam) => {
    if (!exam.isActive) {
        alert("Ujian ini tidak aktif/disembunyikan oleh Dosen.");
        return;
    }
    
    if (completedExamIds.has(exam.id)) {
        alert("Anda sudah mengerjakan ujian ini.");
        return;
    }

    const now = new Date();
    const start = new Date(exam.startTime);
    const end = new Date(exam.endTime);

    if (now < start) {
        alert(`Ujian belum dimulai. Harap kembali pada ${start.toLocaleString('id-ID')}`);
        return;
    }

    if (now > end) {
        alert("Waktu ujian telah berakhir.");
        return;
    }

    if (confirm(`Mulai ujian "${exam.courseName}"?`)) {
       onStartExam(exam.id);
    }
  };

  const getBadgeColor = (type: ExamType) => {
    switch(type) {
       case ExamType.UTS: return 'bg-blue-500';
       case ExamType.UAS: return 'bg-purple-500';
       case ExamType.QUIZ: return 'bg-orange-500';
       default: return 'bg-gray-500';
    }
 };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Portal Ujian Mahasiswa</h1>
           <p className="text-gray-600">Semangat mengerjakan UTS, UAS dan Kuis!</p>
        </div>
        <button onClick={refreshExams} className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1 font-bold">
           <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           {isRefreshing ? 'Memuat...' : 'Refresh Data'}
        </button>
      </div>
        
        {DB.isOfflineMode() && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-bold">PERHATIAN: MODE DEMO (OFFLINE)</span><br/>
                  Anda tidak terhubung ke Database Pusat. Anda tidak akan bisa menemukan ujian yang dibuat oleh Dosen secara Online. Silakan Logout dan masuk menggunakan akun Google resmi.
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-10 border border-green-100 relative overflow-hidden">
         <div className="relative z-10 max-w-lg">
            <h2 className="text-xl font-bold text-green-900 mb-2">Masuk ke Ujian Khusus</h2>
            <form onSubmit={handleJoinByCode} className="flex gap-2">
               <input 
                 type="text" 
                 placeholder="KODE UJIAN (Contoh: X8K9L2)"
                 className="flex-1 border-2 border-green-200 rounded-lg px-4 py-2 uppercase tracking-wider font-bold"
                 value={accessCode}
                 onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
               />
               <button type="submit" className="bg-green-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">Masuk</button>
            </form>
            <p className="text-xs text-gray-400 mt-2 italic">*Kode diberikan oleh Dosen Pengampu saat jam ujian dimulai.</p>
         </div>
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-4">Jadwal Ujian (Publik)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map(exam => {
          const isDone = completedExamIds.has(exam.id);
          const now = new Date();
          const start = new Date(exam.startTime);
          const end = new Date(exam.endTime);
          
          let statusLabel = "Belum Mulai";
          let statusColor = "bg-yellow-100 text-yellow-800";
          let canEnter = false;

          if (isDone) {
             statusLabel = "Selesai";
             statusColor = "bg-gray-100 text-gray-600";
          } else if (now > end) {
             statusLabel = "Ditutup";
             statusColor = "bg-red-100 text-red-800";
          } else if (now >= start && now <= end) {
             statusLabel = "Berlangsung";
             statusColor = "bg-green-100 text-green-800 animate-pulse";
             canEnter = true;
          }

          return (
            <div key={exam.id} className="bg-white rounded-xl shadow-sm border p-6 flex flex-col relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg ${getBadgeColor(exam.type)}`}>
                {exam.type}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{exam.courseName}</h3>
              <p className="text-sm text-gray-500 mb-4">{exam.title}</p>
              
              <div className="text-sm mb-4 space-y-1">
                 <div>Mulai: {start.toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                 <div>Selesai: {end.toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-auto">
                 <span className={`px-3 py-1.5 rounded text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                 {!isDone && canEnter && (
                    <button onClick={() => validateAndStart(exam)} className="bg-green-600 text-white font-bold py-1.5 px-4 rounded hover:bg-green-700 text-sm">Kerjakan</button>
                 )}
              </div>
            </div>
          );
        })}
        {exams.length === 0 && (
           <div className="col-span-full text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
              Belum ada ujian yang dijadwalkan secara publik.
           </div>
        )}
      </div>
    </div>
  );
};