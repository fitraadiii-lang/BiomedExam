import React, { useState } from 'react';
import { DB } from '../services/db';
import { UserRole } from '../types';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  
  // Logo handling state
  const [logoSrc, setLogoSrc] = useState("https://siakad.unkaha.ac.id/assets/img/logo.png");
  const [logoError, setLogoError] = useState(false);

  // Google Simulation State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleStep, setGoogleStep] = useState<'EMAIL' | 'DETAILS'>('EMAIL');
  const [gEmail, setGEmail] = useState('');
  const [gName, setGName] = useState('');
  const [gRole, setGRole] = useState<UserRole>(UserRole.STUDENT);

  const handleLogoError = () => {
    // Fallback chain: SIAKAD -> WordPress -> SVG Placeholder
    if (logoSrc === "https://siakad.unkaha.ac.id/assets/img/logo.png") {
      setLogoSrc("https://unkaha.ac.id/wp-content/uploads/2022/07/LOGO-UNKAHA-1.png");
    } else {
      setLogoError(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;

    if (isLogin) {
      const user = DB.login(email);
      if (user) {
        DB.setCurrentUser(user);
        onLogin();
      } else {
        alert('User tidak ditemukan. Silakan daftar terlebih dahulu.');
      }
    } else {
      if (!name) return;
      try {
        const newUser = DB.register({
          id: Date.now().toString(),
          email,
          name,
          role,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        });
        DB.setCurrentUser(newUser);
        onLogin();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Google Login Handlers
  const handleGoogleClick = () => {
    setShowGoogleModal(true);
    setGoogleStep('EMAIL');
    setGEmail('');
    setGName('');
    setGRole(UserRole.STUDENT);
  };

  const handleGoogleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gEmail.trim()) return;
    if (!gEmail.endsWith('@gmail.com')) {
      alert("Harap gunakan alamat email @gmail.com untuk menggunakan Login Google.");
      return;
    }
    
    const existingUser = DB.login(gEmail);
    if (existingUser) {
      // Login Succcess
      DB.setCurrentUser(existingUser);
      onLogin();
    } else {
      // Need Registration Details
      setGoogleStep('DETAILS');
    }
  };

  const handleGoogleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName.trim()) return;
    
    try {
      const newUser = DB.register({
        id: Date.now().toString(),
        email: gEmail,
        name: gName,
        role: gRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(gName)}&background=random`
      });
      DB.setCurrentUser(newUser);
      onLogin();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/50 backdrop-blur-sm">
        <div className="text-center mb-8">
          {logoError ? (
             <div className="mx-auto h-32 w-32 mb-6 flex flex-col items-center justify-center bg-green-50 rounded-full border-4 border-yellow-400 shadow-md animate-fade-in">
                <svg className="w-16 h-16 text-green-700 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-bold text-green-800 text-xs tracking-widest">UNKAHA</span>
             </div>
          ) : (
            <img 
              src={logoSrc}
              onError={handleLogoError}
              alt="Logo Universitas Karya Husada Semarang" 
              className="mx-auto h-32 w-auto mb-6 hover:scale-105 transition-transform duration-300 drop-shadow-md object-contain" 
            />
          )}
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Universitas Karya Husada</h2>
          <p className="text-sm text-green-600 font-medium mt-1">Portal Ujian Ilmu Biomedis</p>
        </div>

        <button 
          onClick={handleGoogleClick}
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors mb-6 shadow-sm hover:shadow-md"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Masuk dengan Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Atau gunakan email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peran</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center text-sm border rounded p-2 cursor-pointer hover:bg-green-50 transition-colors has-[:checked]:bg-green-100 has-[:checked]:border-green-500">
                    <input 
                      type="radio" 
                      checked={role === UserRole.STUDENT} 
                      onChange={() => setRole(UserRole.STUDENT)} 
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-1 font-medium">Mhs</span>
                  </label>
                  <label className="flex items-center text-sm border rounded p-2 cursor-pointer hover:bg-green-50 transition-colors has-[:checked]:bg-green-100 has-[:checked]:border-green-500">
                    <input 
                      type="radio" 
                      checked={role === UserRole.LECTURER} 
                      onChange={() => setRole(UserRole.LECTURER)} 
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-1 font-medium">Dosen</span>
                  </label>
                  <label className="flex items-center text-sm border rounded p-2 cursor-pointer hover:bg-green-50 transition-colors has-[:checked]:bg-green-100 has-[:checked]:border-green-500">
                    <input 
                      type="radio" 
                      checked={role === UserRole.ADMIN} 
                      onChange={() => setRole(UserRole.ADMIN)} 
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-1 font-medium">Admin</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-2.5 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {isLogin ? 'Masuk' : 'Daftar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-green-600 hover:text-green-800 font-medium hover:underline transition-all"
          >
            {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>
        </div>
      </div>

      {/* Google Simulation Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 relative animate-[scaleIn_0.2s_ease-out]">
             <button 
               onClick={() => setShowGoogleModal(false)}
               className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
             >
               ✕
             </button>
             
             <div className="text-center mb-6">
                <svg className="h-10 w-10 mx-auto mb-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Sign in with Google</h3>
                <p className="text-sm text-gray-500">to continue to Universitas Karya Husada</p>
             </div>

             {googleStep === 'EMAIL' ? (
               <form onSubmit={handleGoogleNext}>
                 <div className="mb-4">
                   <label className="block text-xs font-medium text-gray-700 mb-1">Email or phone</label>
                   <input
                     type="email"
                     className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                     placeholder="email@gmail.com"
                     autoFocus
                     value={gEmail}
                     onChange={(e) => setGEmail(e.target.value)}
                   />
                 </div>
                 <div className="flex justify-end">
                   <button 
                     type="submit"
                     className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 text-sm transition-colors"
                   >
                     Next
                   </button>
                 </div>
               </form>
             ) : (
               <form onSubmit={handleGoogleComplete}>
                 <div className="mb-4 bg-blue-50 p-3 rounded text-sm text-blue-800">
                   Akun baru terdeteksi! Silakan lengkapi data diri.
                 </div>
                 <div className="mb-4">
                   <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                   <input type="text" disabled value={gEmail} className="w-full px-3 py-2 bg-gray-100 border rounded text-gray-500" />
                 </div>
                 <div className="mb-4">
                   <label className="block text-xs font-medium text-gray-700 mb-1">Nama Lengkap</label>
                   <input
                     type="text"
                     required
                     className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                     value={gName}
                     onChange={(e) => setGName(e.target.value)}
                   />
                 </div>
                 <div className="mb-6">
                   <label className="block text-xs font-medium text-gray-700 mb-2">Saya adalah seorang:</label>
                   <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center text-sm cursor-pointer border p-2 rounded hover:bg-gray-50">
                        <input 
                          type="radio" 
                          className="mr-2"
                          checked={gRole === UserRole.STUDENT}
                          onChange={() => setGRole(UserRole.STUDENT)}
                        />
                        Mahasiswa
                      </label>
                      <label className="flex items-center text-sm cursor-pointer border p-2 rounded hover:bg-gray-50">
                        <input 
                          type="radio" 
                          className="mr-2"
                          checked={gRole === UserRole.LECTURER}
                          onChange={() => setGRole(UserRole.LECTURER)}
                        />
                        Dosen
                      </label>
                       <label className="flex items-center text-sm cursor-pointer border p-2 rounded hover:bg-gray-50">
                        <input 
                          type="radio" 
                          className="mr-2"
                          checked={gRole === UserRole.ADMIN}
                          onChange={() => setGRole(UserRole.ADMIN)}
                        />
                        Admin
                      </label>
                   </div>
                 </div>
                 <div className="flex justify-end">
                   <button 
                     type="submit"
                     className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 text-sm transition-colors"
                   >
                     Create Account & Sign In
                   </button>
                 </div>
               </form>
             )}
          </div>
        </div>
      )}
    </div>
  );
};