import React, { useState } from 'react';
import { DB, setForceOffline } from '../services/db';
import { UserRole } from '../types';
import { isFirebaseConfigured, auth, googleProvider } from '../src/firebase';
import { signInWithPopup } from 'firebase/auth';

interface AuthProps {
  onLogin: () => void;
}

// Konfigurasi Super Admin & Kode Dosen
const SUPER_ADMIN_EMAIL = 'fitraadi@unkaha.ac.id';
const LECTURER_SECRET_CODE = 'UNKAHA'; // Kode rahasia untuk daftar jadi Dosen

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  
  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.STUDENT);
  const [regLecturerCode, setRegLecturerCode] = useState(''); // State untuk kode verifikasi dosen
  const [regEmail, setRegEmail] = useState('');
  const [regUid, setRegUid] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    setDomainError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // 1. Cek Super Admin Hardcoded
      if (user.email === SUPER_ADMIN_EMAIL) {
         // Force register/update as ADMIN
         const adminUser = await DB.register({
            id: user.uid,
            email: user.email,
            name: user.displayName || 'Super Admin',
            role: UserRole.ADMIN,
            avatarUrl: user.photoURL || undefined
         });
         DB.setCurrentUser(adminUser);
         onLogin();
         return;
      }

      // 2. Cek User Biasa
      const existingUser = await DB.login(user.email || '');
      
      if (existingUser) {
        // SUDAH TERDAFTAR: Langsung masuk
        DB.setCurrentUser(existingUser);
        onLogin();
      } else {
        // BELUM TERDAFTAR: Arahkan ke form registrasi
        setRegEmail(user.email || '');
        setRegName(user.displayName || '');
        setRegUid(user.uid);
        setIsRegistering(true);
      }
    } catch (error: any) {
      console.error(error);
      
      // Handle Unauthorized Domain (Deployment Issue)
      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setDomainError(currentDomain);
      }
      else if (error.code === 'auth/popup-closed-by-user') {
        // Ignore normal close
      }
      // Handle permission error
      else if (error.code === 'permission-denied') {
        setAuthError("Akses Database Ditolak. Pastikan Firestore Rules diset ke 'allow read, write: if true;' di Firebase Console.");
      } else {
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchToOfflineMode = async () => {
     setForceOffline(true);
     setDomainError(null);
     setAuthError(null);
     
     // Simulate login with a dummy user for testing
     const dummyEmail = "demo@unkaha.ac.id";
     const existing = await DB.login(dummyEmail);
     
     if (existing) {
         DB.setCurrentUser(existing);
         onLogin();
     } else {
         setRegEmail(dummyEmail);
         setRegName("Mahasiswa Demo");
         setRegUid("demo-123");
         setIsRegistering(true);
     }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName) return;

    // Validasi Kode Dosen
    if (regRole === UserRole.LECTURER && regLecturerCode !== LECTURER_SECRET_CODE) {
        alert("Kode Verifikasi Dosen SALAH.\nHubungi Admin Prodi jika Anda benar-benar Dosen.");
        return;
    }

    setLoading(true);
    try {
      const newUser = await DB.register({
        id: regUid || Date.now().toString(),
        email: regEmail,
        name: regName,
        role: regRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(regName)}&background=random&color=fff`
      });
      DB.setCurrentUser(newUser);
      onLogin();
    } catch (error: any) {
      alert("Gagal Registrasi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      {/* LEFT SIDE: Branding / Information */}
      <div className="md:w-1/2 bg-slate-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-green-600 rounded-full blur-[100px] opacity-20"></div>
        <div className="relative z-10">
           <div className="flex items-center gap-3 mb-6">
             <div className="font-bold tracking-wider text-sm">UNIVERSITAS KARYA HUSADA</div>
           </div>
           
           <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
             Portal Ujian <br/>
             <span className="text-green-400">Ilmu Biomedis</span>
           </h1>
           <p className="text-slate-400 text-lg max-w-md">
             Platform ujian online terintegrasi dengan teknologi AI Grading dan monitoring real-time untuk integritas akademik.
           </p>
        </div>

        <div className="relative z-10 mt-10 md:mt-0">
           <div className="flex items-center gap-4 text-xs text-slate-500">
             <span>&copy; 2024 TIM DOSEN ILMU BIOMEDIS UNKAHA</span>
             <span>•</span>
             <span>Versi 2.0 (Stable)</span>
           </div>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md">
          
          {/* Domain Configuration Error (Critical for Deployment) */}
          {domainError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-5 shadow-lg animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Akses Web Belum Diizinkan
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                   Domain aplikasi ini <b>belum didaftarkan</b> di Google/Firebase Console. Login Google diblokir demi keamanan.
                </p>
                <div className="bg-white border rounded p-3 flex justify-between items-center mb-4">
                    <code className="text-sm font-mono text-gray-600 truncate flex-1 mr-2">{domainError}</code>
                    <button 
                        onClick={() => {navigator.clipboard.writeText(domainError); alert("Domain disalin!");}}
                        className="text-xs bg-gray-100 px-3 py-1.5 rounded border hover:bg-gray-200 font-medium"
                    >
                        Salin
                    </button>
                </div>
                <div className="flex gap-2">
                   <button onClick={switchToOfflineMode} className="flex-1 bg-red-600 text-white py-2 rounded text-sm font-bold hover:bg-red-700 shadow-md">
                      Lewati (Mode Demo)
                   </button>
                </div>
            </div>
          )}

          {authError && !domainError && (
             <div className="mb-6 bg-orange-50 text-orange-800 p-4 rounded-lg border border-orange-200 text-sm flex gap-3 items-start">
               <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <div>
                  <span className="font-bold block mb-1">Gagal Masuk</span>
                  {authError}
               </div>
             </div>
          )}

          {!isRegistering ? (
             <div className="animate-fade-in">
                <div className="text-center mb-8">
                   <h2 className="text-2xl font-bold text-gray-900">Selamat Datang</h2>
                   <p className="text-gray-500">Silakan masuk untuk mengakses ujian.</p>
                </div>

                <div className="space-y-4">
                   <button 
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3.5 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow-md group"
                   >
                     {loading ? (
                        <span className="flex items-center gap-2">
                           <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           Memproses...
                        </span>
                     ) : (
                        <>
                           <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                           Masuk dengan Google
                        </>
                     )}
                   </button>

                   <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                      <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">Pilihan Lain</span></div>
                   </div>

                   <button onClick={switchToOfflineMode} className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      Masuk Mode Demo / Offline
                   </button>
                </div>
             </div>
          ) : (
             <div className="animate-scaleIn">
                <div className="mb-6">
                   <h2 className="text-2xl font-bold text-gray-900">Lengkapi Profil</h2>
                   <p className="text-gray-500 text-sm">Selesaikan pendaftaran akun baru.</p>
                </div>

                <form onSubmit={handleCompleteRegistration} className="space-y-5">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                      <input 
                         type="text" 
                         value={regName} 
                         onChange={e => setRegName(e.target.value)} 
                         className="w-full border-gray-300 border p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                         placeholder="Contoh: Budi Santoso"
                         required
                      />
                   </div>

                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Daftar Sebagai</label>
                      <div className="grid grid-cols-2 gap-4">
                         <div 
                           onClick={() => { setRegRole(UserRole.STUDENT); setRegLecturerCode(''); }}
                           className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-center ${regRole === UserRole.STUDENT ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200'}`}
                         >
                            <div className="font-bold text-sm">MAHASISWA</div>
                            <div className="text-[10px] opacity-70">Peserta Ujian</div>
                         </div>
                         <div 
                           onClick={() => setRegRole(UserRole.LECTURER)}
                           className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-center ${regRole === UserRole.LECTURER ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200'}`}
                         >
                            <div className="font-bold text-sm">DOSEN</div>
                            <div className="text-[10px] opacity-70">Pengajar</div>
                         </div>
                      </div>
                   </div>

                   {/* Field Tambahan untuk Proteksi Dosen */}
                   {regRole === UserRole.LECTURER && (
                      <div className="animate-fade-in bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                         <label className="block text-xs font-bold text-yellow-800 mb-1">Kode Verifikasi Dosen (Proteksi)</label>
                         <input 
                            type="password"
                            value={regLecturerCode}
                            onChange={e => setRegLecturerCode(e.target.value)}
                            className="w-full border-gray-300 border p-2 rounded text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                            placeholder="Masukkan Kode Rahasia"
                         />
                         <p className="text-[10px] text-yellow-700 mt-1">Kode: <b>UNKAHA</b></p>
                      </div>
                   )}

                   <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all mt-4">
                      {loading ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
                   </button>
                   <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-center text-sm text-gray-500 py-2 hover:text-gray-900">
                      Batal
                   </button>
                </form>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};