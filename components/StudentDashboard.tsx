import React, { useState, useEffect } from 'react';
import { User, Exam } from '../types';
import { DB } from '../services/db';

interface StudentDashboardProps {
  user: User;
  onStartExam: (examId: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onStartExam }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [completedExamIds, setCompletedExamIds] = useState<Set<string>>(new Set());
  const [accessCode, setAccessCode] = useState('');

  useEffect(() => {
    refreshExams();
    const interval = setInterval(refreshExams, 15000); // Check every 15s from Cloud
    return () => clearInterval(interval);
  }, [user.id]);

  const refreshExams = async () => {
    const allExams = await DB.getExams();
    setExams(allExams.filter(e => e.isActive));

    const mySubs = await DB.getSubmissionsByStudent(user.id);
    setCompletedExamIds(new Set(mySubs.map(s => s.examId)));
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return;
    
    // Fetch latest exams to ensure validity
    const allExams = await DB.getExams(); 
    const targetExam = allExams.find(ex => ex.accessCode === accessCode.trim().toUpperCase());

    if (!targetExam) {
      alert("Kode ujian tidak valid atau belum dipublish oleh Dosen.");
      return;
    }

    validateAndStart(targetExam);
  };

  const validateAndStart = (exam: Exam) => {
    if (!exam.isActive) {
        alert("Ujian ini tidak aktif.");
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portal Ujian Mahasiswa</h1>
        <p className="text-gray-600">Semangat mengerjakan UTS dan UAS!</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-10 border border-green-100 relative overflow-hidden">
         <div className="relative z-10 max-w-lg">
            <h2 className="text-xl font-bold text-green-900 mb-2">Masuk ke Ujian Khusus</h2>
            <form onSubmit={handleJoinByCode} className="flex gap-2">
               <input 
                 type="text" 
                 placeholder="Kode Ujian"
                 className="flex-1 border-2 border-green-200 rounded-lg px-4 py-2 uppercase tracking-wider font-bold"
                 value={accessCode}
                 onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
               />
               <button type="submit" className="bg-green-600 text-white font-bold px-6 py-2 rounded-lg">Masuk</button>
            </form>
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
              <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg ${exam.type === 'UTS' ? 'bg-blue-500' : 'bg-purple-500'}`}>
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
      </div>
    </div>
  );
};