import React, { useState, useEffect } from 'react';
import { User, Exam, Submission, QuestionType } from '../types';
import { DB } from '../services/db';

interface AdminDashboardProps {
  user: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
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
      <div className="mb-8 bg-slate-900 text-white p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Panel Admin Prodi</h1>
        <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-slate-800 p-4 rounded">
                <span className="block text-2xl font-bold">{stats.activeExams}</span>
                <span className="text-xs uppercase opacity-70">Ujian Berjalan</span>
            </div>
            <div className="bg-slate-800 p-4 rounded">
                <span className="block text-2xl font-bold">{stats.totalStudents}</span>
                <span className="text-xs uppercase opacity-70">Mahasiswa</span>
            </div>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
         <div className="flex justify-between mb-4">
            <h2 className="font-bold text-lg">Manajemen Ujian</h2>
            <button onClick={loadData} className="text-sm text-blue-600">Refresh Cloud Data</button>
         </div>
         <table className="w-full">
            <thead className="bg-gray-50 text-left">
               <tr>
                  <th className="p-2">Judul</th>
                  <th className="p-2">Dosen</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Aksi</th>
               </tr>
            </thead>
            <tbody>
               {exams.map(e => (
                   <tr key={e.id} className="border-t">
                      <td className="p-2">{e.courseName}</td>
                      <td className="p-2">{e.lecturerName}</td>
                      <td className="p-2">
                         <span className={`px-2 text-xs rounded ${e.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{e.isActive ? 'Active' : 'Hidden'}</span>
                      </td>
                      <td className="p-2 text-right space-x-2">
                         <button onClick={() => toggleExamStatus(e)} className="text-blue-600 text-xs">Toggle</button>
                         <button onClick={() => handleOpenDetail(e)} className="text-green-600 text-xs">Detail</button>
                         <button onClick={() => deleteExam(e.id)} className="text-red-600 text-xs">Hapus</button>
                      </td>
                   </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};