import React, { useState, useEffect } from 'react';
import { User, UserRole, Exam } from './types';
import { DB } from './services/db';
import { Auth } from './components/Auth';
import { LecturerDashboard } from './components/LecturerDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ExamRunner } from './components/ExamRunner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  
  // State khusus Admin untuk pindah view
  const [adminViewMode, setAdminViewMode] = useState<'ADMIN_DASHBOARD' | 'LECTURER_VIEW'>('ADMIN_DASHBOARD');

  useEffect(() => {
    const currentUser = DB.getCurrentUser();
    if (currentUser) setUser(currentUser);
  }, []);

  const handleLogin = () => {
    const currentUser = DB.getCurrentUser();
    setUser(currentUser);
    setAdminViewMode('ADMIN_DASHBOARD');
  };

  const handleLogout = () => {
    DB.setCurrentUser(null);
    setUser(null);
    setActiveExamId(null);
    setAdminViewMode('ADMIN_DASHBOARD');
  };

  // Render Logic
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  // Jika Mahasiswa sedang ujian
  if (activeExamId && user.role === UserRole.STUDENT) {
    const exam = DB.getExamById(activeExamId);
    if (!exam) return <div>Error loading exam</div>;
    return <ExamRunner user={user} exam={exam} onFinish={() => setActiveExamId(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className={`border-b sticky top-0 z-30 ${user.role === UserRole.ADMIN ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo dihapus sesuai permintaan */}
              
              <div className="flex flex-col">
                <span className={`font-bold text-lg leading-none ${user.role === UserRole.ADMIN ? 'text-white' : 'text-green-900'}`}>
                  BioMed Exam
                </span>
                <span className={`text-[10px] font-bold tracking-widest ${user.role === UserRole.ADMIN ? 'text-slate-400' : 'text-slate-500'}`}>
                  UNKAHA SEMARANG {user.role === UserRole.ADMIN && '| ADMIN'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* ADMIN VIEW TOGGLE */}
              {user.role === UserRole.ADMIN && (
                <div className="hidden md:flex bg-slate-800 rounded-lg p-1">
                   <button 
                     onClick={() => setAdminViewMode('ADMIN_DASHBOARD')}
                     className={`px-3 py-1 text-xs font-bold rounded ${adminViewMode === 'ADMIN_DASHBOARD' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
                   >
                     Panel Admin
                   </button>
                   <button 
                     onClick={() => setAdminViewMode('LECTURER_VIEW')}
                     className={`px-3 py-1 text-xs font-bold rounded ${adminViewMode === 'LECTURER_VIEW' ? 'bg-green-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                   >
                     Mode Dosen
                   </button>
                </div>
              )}

              {/* OFFLINE INDICATOR */}
              {DB.isOfflineMode() && (
                 <span className="hidden md:inline-block bg-yellow-400 text-yellow-900 text-xs font-extrabold px-3 py-1 rounded shadow-sm animate-pulse">
                   OFFLINE / DEMO MODE
                 </span>
              )}
              
              <div className="flex items-center gap-2">
                 <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}`} alt="" className="h-8 w-8 rounded-full" />
                 <span className={`text-sm font-medium ${user.role === UserRole.ADMIN ? 'text-slate-300' : 'text-slate-700'}`}>
                    {user.name} ({user.role})
                 </span>
              </div>
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-red-500 hover:text-red-400"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {user.role === UserRole.ADMIN ? (
          adminViewMode === 'ADMIN_DASHBOARD' ? (
            <AdminDashboard user={user} onOpenLecturerView={() => setAdminViewMode('LECTURER_VIEW')} />
          ) : (
            <LecturerDashboard user={user} />
          )
        ) : user.role === UserRole.LECTURER ? (
          <LecturerDashboard user={user} />
        ) : (
          <StudentDashboard user={user} onStartExam={setActiveExamId} />
        )}
      </main>
    </div>
  );
}