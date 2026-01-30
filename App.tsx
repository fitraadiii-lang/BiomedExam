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

  useEffect(() => {
    const currentUser = DB.getCurrentUser();
    if (currentUser) setUser(currentUser);
  }, []);

  const handleLogin = () => {
    const currentUser = DB.getCurrentUser();
    setUser(currentUser);
  };

  const handleLogout = () => {
    DB.setCurrentUser(null);
    setUser(null);
    setActiveExamId(null);
  };

  // Render Logic
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

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
              <div className={`h-8 w-8 rounded flex items-center justify-center font-bold ${user.role === UserRole.ADMIN ? 'bg-white text-slate-900' : 'bg-green-600 text-white'}`}>
                {user.role === UserRole.ADMIN ? 'A' : 'UKH'}
              </div>
              <span className={`font-bold text-xl ${user.role === UserRole.ADMIN ? 'text-white' : 'text-green-900'}`}>
                BioMed Exam {user.role === UserRole.ADMIN && 'Admin'}
              </span>
            </div>
            <div className="flex items-center gap-4">
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
          <AdminDashboard user={user} />
        ) : user.role === UserRole.LECTURER ? (
          <LecturerDashboard user={user} />
        ) : (
          <StudentDashboard user={user} onStartExam={setActiveExamId} />
        )}
      </main>
    </div>
  );
}