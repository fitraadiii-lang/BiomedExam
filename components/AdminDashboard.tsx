import React, { useState, useEffect } from 'react';
import { User, Exam, Submission, QuestionType } from '../types';
import { DB } from '../services/db';

interface AdminDashboardProps {
  user: User;
  onOpenLecturerView?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onOpenLecturerView }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState({ activeExams: 0, totalExams: 0, totalStudents: 0 });
  const [allStudents, setAllStudents] = useState<User[]>([]);
  
  const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allExams = await DB.getExams();
    const students = await DB.getStudents();
    setExams(allExams);
    setAllStudents(students);
    setStats({
      activeExams: allExams.filter(e => e.isActive).length,
      totalExams: allExams.length,
      totalStudents: students.length
    });
  };

  const toggleExamStatus = async (exam: Exam) => {
    const updated = { ...exam, isActive: !exam.isActive };
    await DB.saveExam(updated);
    loadData();
  };

  const deleteExam = async (id: string) => {
    if (confirm("Hapus ujian ini permanen dari cloud?")) {
        await DB.deleteExam(id);
        loadData();
    }
  };

  const handleOpenDetail = async (exam: Exam) => {
    setSelectedExam(exam);
    const subs = await DB.getSubmissionsByExam(exam.id);
    setSubmissions(subs);
    setView('DETAIL');
  };

  if (view === 'DETAIL' && selectedExam) {
     return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <button onClick={() => setView('LIST')} className="mb-4 text-blue-600">← Kembali</button>
            <h1 className="text-2xl font-bold mb-4">Detail: {selectedExam.courseName}</h1>
            <div className="bg-white p-4 rounded shadow border">
               <h2 className="font-bold mb-2">Daftar Submit ({submissions.length})</h2>
               {submissions.map(sub => (
                   <div key={sub.id} className="border-b p-2 flex justify-between">
                       <span>{sub.studentName} ({sub.studentNim})</span>
                       <span className="font-bold text-green-600">{sub.totalScore}</span>
                   </div>
               ))}
            </div>
        </div>
     );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 bg-slate-900 text-white p-8 rounded-xl shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Panel Admin Prodi</h1>
          <p className="text-slate-400">Monitoring seluruh aktivitas ujian prodi Ilmu Biomedis.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                  <span className="block text-3xl font-bold text-green-400">{stats.activeExams}</span>
                  <span className="text-xs uppercase font-bold text-slate-400">Ujian Sedang Berjalan</span>
              </div>
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                  <span className="block text-3xl font-bold text-blue-400">{stats.totalStudents}</span>
                  <span className="text-xs uppercase font-bold text-slate-400">Total Mahasiswa</span>
              </div>
              <div className="bg-slate-800 p-4 rounded border border-slate-700 flex flex-col justify-center">
                  <button 
                    onClick={onOpenLecturerView}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Kelola Ujian (View Dosen)
                  </button>
                  <span className="text-[10px] text-center text-slate-500 mt-2">Masuk ke mode dosen untuk membuat/edit ujian</span>
              </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
         <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg text-gray-800">Daftar Semua Ujian (Database)</h2>
            <button onClick={loadData} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               Refresh Data
            </button>
         </div>
         <div className="overflow-x-auto">
             <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                   <tr>
                      <th className="p-3">Judul / Mata Kuliah</th>
                      <th className="p-3">Dosen Pembuat</th>
                      <th className="p-3">Kode</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {exams.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">Tidak ada data ujian.</td></tr>
                   ) : exams.map(e => (
                       <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                             <div className="font-bold text-gray-900">{e.courseName}</div>
                             <div className="text-xs text-gray-500">{e.title}</div>
                          </td>
                          <td className="p-3 text-sm text-gray-600">{e.lecturerName || 'Unknown'}</td>
                          <td className="p-3"><code className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{e.accessCode}</code></td>
                          <td className="p-3">
                             <span className={`px-2 py-1 text-xs rounded-full font-bold ${e.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{e.isActive ? 'Active' : 'Hidden'}</span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                             <button onClick={() => toggleExamStatus(e)} className="text-blue-600 text-xs font-bold hover:underline">
                                {e.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                             </button>
                             <button onClick={() => handleOpenDetail(e)} className="text-green-600 text-xs font-bold hover:underline">Detail</button>
                             <button onClick={() => deleteExam(e.id)} className="text-red-600 text-xs font-bold hover:underline">Hapus</button>
                          </td>
                       </tr>
                   ))}
                </tbody>
             </table>
         </div>
      </div>
    </div>
  );
};