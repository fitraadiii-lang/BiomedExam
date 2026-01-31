import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  variant?: 'color' | 'white'; // 'color' untuk background putih, 'white' untuk background gelap
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10 w-auto", variant = 'color' }) => {
  const [imgError, setImgError] = useState(false);

  // --- KONFIGURASI URL LOGO ---
  // Menggunakan Link Google Drive yang diberikan
  const RAW_URL = "https://drive.google.com/file/d/1OLEStcBi4jEFM6wShJNTumrQitW4ltEL/view?usp=sharing";
  // ----------------------------

  // Fungsi helper pintar untuk memproses URL
  const getDirectUrl = (url: string) => {
    // 1. Deteksi & Proses Google Drive Link
    // Mengubah link "view?usp=sharing" menjadi link gambar langsung via lh3.googleusercontent.com
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
       const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
       if (idMatch && idMatch[1]) {
         return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
       }
    }
    
    // 2. Fallback untuk URL asli UNKAHA (jika masih dipakai) menggunakan Proxy
    if (url.includes('unkaha.ac.id')) {
        return `https://wsrv.nl/?url=${url}&w=200&output=png`;
    }

    // 3. Return URL biasa jika tidak ada kondisi khusus
    return url;
  };

  const finalUrl = getDirectUrl(RAW_URL);

  if (imgError) {
    // FALLBACK SVG: Tampil jika gambar gagal dimuat (Perisai UKH)
    return (
      <svg 
        viewBox="0 0 100 100" 
        className={`${className} ${variant === 'white' ? 'text-white' : 'text-green-700'}`} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield Shape */}
        <path 
          d="M50 95C50 95 85 80 85 50V20L50 5L15 20V50C15 80 50 95 50 95Z" 
          fill="currentColor" 
          stroke={variant === 'white' ? 'none' : '#15803d'}
          strokeWidth="2"
        />
        {/* Inner Outline */}
        <path 
          d="M50 88C50 88 78 75 78 50V25L50 12L22 25V50C22 75 50 88 50 88Z" 
          stroke={variant === 'white' ? '#16a34a' : 'white'} 
          strokeWidth="3"
          fill="none"
        />
        {/* Text UKH */}
        <text 
          x="50" 
          y="60" 
          fontSize="32" 
          fontWeight="bold" 
          fill={variant === 'white' ? '#16a34a' : 'white'} 
          textAnchor="middle" 
          fontFamily="serif"
        >
          UKH
        </text>
      </svg>
    );
  }

  return (
    <img 
      src={finalUrl} 
      alt="Logo UNKAHA" 
      className={`${className} ${variant === 'white' ? 'brightness-0 invert' : ''}`}
      onError={() => setImgError(true)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous" // Penting untuk gambar dari Google Drive
    />
  );
};