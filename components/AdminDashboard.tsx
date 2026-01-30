import React, { useState, useEffect } from 'react';
import { User, Exam, UserRole } from '../types';
import { DB } from '../services/db';

interface AdminDashboardProps {
  user: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState({ activeExams: 0, totalExams: 0, totalStudents: 0 });
  const [allStudents, setAllStudents] = useState<User[]>([]);
  
  // Monitoring State
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [selectedExamForMonitor, setSelectedExamForMonitor] = useState<Exam | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allExams = DB.getExams();
    const students = DB.getStudents();
    
    setExams(allExams);
    setAllStudents(students);
    setStats({
      activeExams: allExams.filter(e => e.isActive).length,
      totalExams: allExams.length,
      totalStudents: students.length
    });
  };

  const toggleExamStatus = (exam: Exam) => {
    const updated = { ...exam, isActive: !exam.isActive };
    DB.saveExam(updated);
    loadData();
  };

  const deleteExam = (id: string) => {
    if (confirm("PERINGATAN ADMIN: Menghapus ujian ini akan menghapus akses mahasiswa. Lanjutkan?")) {
        const allExams = DB.getExams();
        const filtered = allExams.filter(e => e.id !== id);
        localStorage.setItem('biomed_exams', JSON.stringify(filtered));
        loadData();
    }
  };

  const handleOpenMonitor = (exam: Exam) => {
    setSelectedExamForMonitor(exam);
    setShowMonitorModal(true);
  };

  const getMonitorData = () => {
    if (!selectedExamForMonitor) return { submitted: [], notSubmitted: [] };
    
    const subs = DB.getSubmissionsByExam(selectedExamForMonitor.id);
    const submittedIds = new Set(subs.map(s => s.studentId));
    
    const submitted = subs;
    const notSubmitted = allStudents.filter(s => !submittedIds.has(s.id));

    return { submitted, notSubmitted };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 bg-slate-900 text-white p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Panel Admin Prodi</h1>
        <p className="text-slate-300">Kontrol Pusat Ujian Universitas Karya Husada</p>
        
        <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="bg-slate-800 p-4 rounded-lg">
                <span className="block text-2xl font-bold">{stats.activeExams}</span>
                <span className="text-xs uppercase tracking-wider opacity-70">Ujian Berjalan</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
                <span className="block text-2xl font-bold">{stats.totalExams}</span>
                <span className="text-xs uppercase tracking-wider opacity-70">Total Bank Soal</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
                <span className="block text-2xl font-bold">{stats.totalStudents}</span>
                <span className="text-xs uppercase tracking-wider opacity-70">Mahasiswa Terdaftar</span>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Manajemen Ujian</h2>
            <button onClick={loadData} className="text-blue-600 text-sm hover:underline">Refresh Data</button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mata Kuliah / Judul</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jadwal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Akses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {exams.map(exam => (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{exam.courseName}</div>
                    <div className="text-sm text-gray-500">{exam.title}</div>
                    <div className="text-xs text-gray-400">Oleh: {exam.lecturerName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                     <div className="flex flex-col gap-1">
                        <span className="bg-green-50 text-green-700 px-2 rounded text-xs w-fit">Start: {new Date(exam.startTime).toLocaleString('id-ID', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                        <span className="bg-red-50 text-red-700 px-2 rounded text-xs w-fit">End: {new Date(exam.endTime).toLocaleString('id-ID', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800 font-bold">{exam.accessCode || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                     <button 
                      onClick={() => toggleExamStatus(exam)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${exam.isActive ? 'bg-green-500' : 'bg-gray-200'}`}
                     >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${exam.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
                      onClick={() => handleOpenMonitor(exam)}
                      className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-full"
                    >
                      Pantau
                    </button>
                    <button onClick={() => deleteExam(exam.id)} className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-full">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {/* Monitoring Modal */}
      {showMonitorModal && selectedExamForMonitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Monitoring: {selectedExamForMonitor.courseName}</h3>
                <p className="text-sm text-slate-400">Batas Waktu: {new Date(selectedExamForMonitor.endTime).toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => setShowMonitorModal(false)} className="text-white hover:text-gray-300 font-bold text-xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
               <div className="grid grid-cols-2 gap-8">
                  {/* Submitted Column */}
                  <div>
                    <h4 className="font-bold text-green-700 bg-green-50 p-2 rounded mb-3 flex justify-between items-center">
                      Sudah Mengumpulkan
                      <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded text-sm">{getMonitorData().submitted.length}</span>
                    </h4>
                    <ul className="space-y-2">
                      {getMonitorData().submitted.map(sub => {
                         const submitTime = new Date(sub.submittedAt);
                         const endTime = new Date(selectedExamForMonitor.endTime);
                         const isLate = submitTime > endTime; // Technically difficult due to auto-close, but possible with slight drift

                         return (
                            <li key={sub.id} className="border border-green-100 rounded p-3 flex justify-between items-center">
                              <div>
                                <div className="font-bold text-gray-800">{sub.studentName}</div>
                                <div className="text-xs text-gray-500">
                                  {submitTime.toLocaleTimeString()} 
                                  {sub.violationCount && sub.violationCount > 0 ? <span className="text-red-600 font-bold ml-1"> (⚠ {sub.violationCount})</span> : ''}
                                </div>
                              </div>
                              <div className="font-bold text-green-600">{sub.totalScore}</div>
                            </li>
                         );
                      })}
                      {getMonitorData().submitted.length === 0 && <p className="text-sm text-gray-400 italic">Belum ada data.</p>}
                    </ul>
                  </div>

                  {/* Not Submitted Column */}
                  <div>
                    <h4 className="font-bold text-red-700 bg-red-50 p-2 rounded mb-3 flex justify-between items-center">
                      Belum Mengumpulkan
                      <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded text-sm">{getMonitorData().notSubmitted.length}</span>
                    </h4>
                     <ul className="space-y-2">
                      {getMonitorData().notSubmitted.map(user => (
                        <li key={user.id} className="border border-red-100 rounded p-3 flex items-center gap-3 bg-red-50/50">
                          <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold text-xs">
                             {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </li>
                      ))}
                      {getMonitorData().notSubmitted.length === 0 && <p className="text-sm text-gray-400 italic">Semua telah mengumpulkan.</p>}
                    </ul>
                  </div>
               </div>
            </div>
            
            <div className="p-4 bg-gray-50 text-right border-t">
              <button onClick={() => setShowMonitorModal(false)} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};