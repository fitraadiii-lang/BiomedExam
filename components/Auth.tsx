import React, { useState, useEffect } from 'react';
import { DB } from '../services/db';
import { UserRole } from '../types';
import { isFirebaseConfigured, auth, googleProvider, db } from '../src/firebase';
import { signInWithPopup } from 'firebase/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [dbStatus, setDbStatus] = useState<'CHECKING' | 'CONNECTED' | 'ERROR'>('CHECKING');
  
  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.STUDENT);
  const [regEmail, setRegEmail] = useState('');
  const [regUid, setRegUid] = useState('');

  useEffect(() => {
    checkDatabaseConnection();
  }, []);

  const checkDatabaseConnection = async () => {
    if (!isFirebaseConfigured) {
      setDbStatus('CONNECTED'); 
      return;
    }
    try {
      await getDocs(query(collection(db, 'users'), limit(1)));
      setDbStatus('CONNECTED');
    } catch (e: any) {
      console.error("DB Check Failed:", e);
      setDbStatus('ERROR');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Cek apakah user sudah terdaftar di database kita
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
      alert("Gagal Login Google: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName) return;

    setLoading(true);
    try {
      const newUser = await DB.register({
        id: regUid || Date.now().toString(),
        email: regEmail,
        name: regName,
        role: regRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(regName)}&background=random`
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-green-600 animate-fade-in">
        <div className="text-center mb-8">
          {!logoError ? (
            <img 
              src="https://unkaha.ac.id/wp-content/uploads/2022/07/LOGO-UNKAHA-1.png"
              onError={() => setLogoError(true)}
              alt="Logo UNKAHA" 
              className="mx-auto h-24 w-auto mb-4 object-contain" 
            />
          ) : (
             <div className="mx-auto h-20 w-20 mb-4 flex items-center justify-center bg-green-100 text-green-800 font-bold rounded-full">UNKAHA</div>
          )}
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Sistem Ujian Online</h1>
          <h2 className="text-lg font-semibold text-green-700">Prodi Ilmu Biomedis</h2>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Universitas Karya Husada Semarang</p>
        </div>

        {/* Status Database */}
        {dbStatus === 'ERROR' && (
          <div className="bg-red-50 text-red-800 text-xs p-3 rounded mb-4 border border-red-200">
             ⚠️ Database belum siap. Pastikan Firestore Rules sudah dibuka.
          </div>
        )}

        {!isRegistering ? (
          /* TAMPILAN LOGIN UTAMA */
          <div>
            <div className="bg-green-50 border border-green-100 p-4 rounded-lg mb-6 text-center">
              <p className="text-sm text-green-800 mb-1 font-medium">Selamat Datang di Portal Ujian</p>
              <p className="text-xs text-gray-500">Silakan masuk menggunakan akun Google Universitas atau Pribadi.</p>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading || dbStatus === 'ERROR'}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="animate-pulse">Menghubungkan Google...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Masuk dengan Google
                </>
              )}
            </button>
            
            <p className="text-[10px] text-center text-gray-400 mt-4">
              © 2024 Tim IT Universitas Karya Husada Semarang.
            </p>
          </div>
        ) : (
          /* TAMPILAN REGISTRASI (Pertama Kali Login) */
          <form onSubmit={handleCompleteRegistration} className="space-y-4 animate-scaleIn">
             <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-4">
                👋 Halo <b>{regName}</b>! Ini pertama kalinya Anda masuk. Mohon lengkapi data berikut:
             </div>
             
             <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap (Sesuai KTM/KTP)</label>
                <input type="text" required value={regName} onChange={e => setRegName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" />
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Status Akademik</label>
                <div className="grid grid-cols-2 gap-3">
                   <label className={`cursor-pointer border p-3 rounded text-center transition-all ${regRole === UserRole.STUDENT ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <input type="radio" className="hidden" checked={regRole === UserRole.STUDENT} onChange={() => setRegRole(UserRole.STUDENT)} />
                      <div className="font-bold">Mahasiswa</div>
                      <div className="text-[10px] opacity-80">Peserta Ujian</div>
                   </label>
                   <label className={`cursor-pointer border p-3 rounded text-center transition-all ${regRole === UserRole.LECTURER ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <input type="radio" className="hidden" checked={regRole === UserRole.LECTURER} onChange={() => setRegRole(UserRole.LECTURER)} />
                      <div className="font-bold">Dosen</div>
                      <div className="text-[10px] opacity-80">Pembuat Soal</div>
                   </label>
                </div>
             </div>

             <div className="pt-2">
                <button type="submit" disabled={loading} className="w-full bg-green-700 text-white font-bold py-3 rounded-lg hover:bg-green-800 shadow-lg">
                   {loading ? 'Menyimpan Data...' : 'Simpan & Masuk Portal'}
                </button>
                <button type="button" onClick={() => setIsRegistering(false)} className="w-full mt-2 text-gray-500 text-sm hover:underline">Batal</button>
             </div>
          </form>
        )}
      </div>
    </div>
  );
};