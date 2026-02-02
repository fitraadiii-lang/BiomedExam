import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, ExamType, Question, QuestionType, Submission, ExamSession, UserRole } from '../types';
import { DB } from '../services/db';
import { AIService } from '../services/ai';

interface LecturerDashboardProps {
  user: User;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'submissions' | 'my-exams'>('my-exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  
  // Create/Edit Exam State
  const [editingExamId, setEditingExamId] = useState<string | null>(null); // State untuk mode edit
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState<ExamType>(ExamType.UTS);
  const [accessCode, setAccessCode] = useState(''); // Untuk menyimpan kode lama saat edit
  
  // Time Scheduling State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Question Form State (Manual Input)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [qPoints, setQPoints] = useState(10);
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qRefAnswer, setQRefAnswer] = useState('');

  // Grading & Monitoring State
  const [selectedExamIdForGrading, setSelectedExamIdForGrading] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradingLoading, setGradingLoading] = useState<number | null>(null);
  
  // Live Monitor State
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const [liveMonitorExam, setLiveMonitorExam] = useState<Exam | null>(null);
  const [liveSessions, setLiveSessions] = useState<ExamSession[]>([]);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === UserRole.ADMIN;

  useEffect(() => {
    loadData();
  }, []);

  // Poll for live monitor updates when modal is open
  useEffect(() => {
    let interval: any;
    if (showLiveMonitor && liveMonitorExam) {
      const fetchLive = async () => {
         const sessions = await DB.getSessionsByExam(liveMonitorExam.id);
         const subs = await DB.getSubmissionsByExam(liveMonitorExam.id);
         setLiveSessions(sessions);
         setSubmissions(subs);
      };
      
      fetchLive(); // Initial fetch
      interval = setInterval(fetchLive, 3000); // Poll every 3 seconds from Cloud
    }
    return () => clearInterval(interval);
  }, [showLiveMonitor, liveMonitorExam]);

  const loadData = async () => {
    const allExams = await DB.getExams();
    
    // UPDATE: Jika Admin, tampilkan SEMUA ujian. Jika Dosen, hanya ujiannya sendiri.
    if (isAdmin) {
      setExams(allExams);
    } else {
      setExams(allExams.filter(e => e.lecturerId === user.id));
    }
    
    // Fetch all submissions
    const allSubs = await DB.getSubmissions();
    
    // Filter submissions: Admin sees ALL. Lecturer sees ONLY for their exams.
    if (isAdmin) {
       setSubmissions(allSubs);
    } else {
       const myExamIds = new Set(allExams.filter(e => e.lecturerId === user.id).map(e => e.id));
       setSubmissions(allSubs.filter(s => myExamIds.has(s.examId)));
    }

    const students = await DB.getStudents();
    setAllStudents(students);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const clearQuestionForm = () => {
    setEditingQuestionIndex(null);
    setQText('');
    setQRefAnswer('');
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setQPoints(10);
  };

  const addQuestion = () => {
    if (!qText.trim()) return;

    const newQ: Question = {
      id: editingQuestionIndex !== null ? questions[editingQuestionIndex].id : Date.now().toString(),
      text: qText,
      type: qType,
      points: qPoints,
    };

    if (qType === QuestionType.MULTIPLE_CHOICE) {
      newQ.options = [...qOptions];
      newQ.correctOptionIndex = qCorrect;
    } else {
      newQ.referenceAnswer = qRefAnswer;
    }

    if (editingQuestionIndex !== null) {
        // Update Mode
        const updatedQuestions = [...questions];
        updatedQuestions[editingQuestionIndex] = newQ;
        setQuestions(updatedQuestions);
        setEditingQuestionIndex(null);
    } else {
        // Add Mode
        setQuestions([...questions, newQ]);
    }
    
    // Reset Form
    clearQuestionForm();
  };

  const deleteQuestion = (idx: number) => {
    const newQ = [...questions];
    newQ.splice(idx, 1);
    setQuestions(newQ);
    if (editingQuestionIndex === idx) clearQuestionForm();
  };

  const editQuestionInDraft = (idx: number) => {
    const q = questions[idx];
    setQText(q.text);
    setQType(q.type);
    setQPoints(q.points);

    if (q.type === QuestionType.MULTIPLE_CHOICE) {
        setQOptions(q.options || ['', '', '', '']);
        setQCorrect(q.correctOptionIndex || 0);
    } else {
        setQRefAnswer(q.referenceAnswer || '');
    }

    setEditingQuestionIndex(idx);
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setDescription(exam.description);
    setCourse(exam.courseName);
    setType(exam.type);
    setQuestions(exam.questions);
    setAccessCode(exam.accessCode);
    
    // Convert ISO to Datetime Local value (YYYY-MM-DDTHH:mm)
    const toLocalISO = (iso: string) => {
       const d = new Date(iso);
       const pad = (n: number) => n < 10 ? '0'+n : n;
       return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    
    setStartTime(toLocalISO(exam.startTime));
    setEndTime(toLocalISO(exam.endTime));
    
    setActiveTab('create');
  };

  const cancelEdit = () => {
     setEditingExamId(null);
     setTitle('');
     setDescription('');
     setCourse('');
     setStartTime('');
     setEndTime('');
     setQuestions([]);
     setAccessCode('');
     clearQuestionForm();
  };

  const handleCreateOrUpdateExam = async () => {
    if (!startTime || !endTime) {
      alert("Harap tentukan Waktu Mulai dan Waktu Selesai ujian.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      alert("Waktu Selesai harus setelah Waktu Mulai.");
      return;
    }

    // Logic Preservasi Owner: Jika sedang edit, ambil owner asli dari object exam yang ada
    // Agar jika Admin mengedit, ID dosen tidak tertimpa ID Admin
    const originalExam = editingExamId ? exams.find(e => e.id === editingExamId) : null;
    
    const examId = editingExamId || Date.now().toString();
    const code = editingExamId ? accessCode : generateCode();
    const createdDate = originalExam ? originalExam.createdAt : new Date().toISOString();

    const newExam: Exam = {
      id: examId,
      accessCode: code,
      title,
      description,
      courseName: course,
      type,
      lecturerId: originalExam ? originalExam.lecturerId : user.id, 
      lecturerName: originalExam ? originalExam.lecturerName : user.name,
      questions,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      isActive: true,
      createdAt: createdDate
    };
    
    await DB.saveExam(newExam);
    await loadData();
    
    const action = editingExamId ? "Diupdate" : "Dibuat";
    alert(`Ujian berhasil ${action}!\n\nKODE AKSES: ${newExam.accessCode}`);
    
    cancelEdit(); // Reset form
    setActiveTab('my-exams');
  };

  const handleToggleActive = async (exam: Exam) => {
    const updatedExam = { ...exam, isActive: !exam.isActive };
    await DB.saveExam(updatedExam);
    loadData();
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm("Apakah anda yakin ingin menghapus ujian ini?")) {
        await DB.deleteExam(id);
        loadData();
    }
  }

  // Helper to apply template
  const applyTemplate = (templateType: 'UTS' | 'UAS' | 'QUIZ') => {
      setType(templateType === 'UTS' ? ExamType.UTS : templateType === 'UAS' ? ExamType.UAS : ExamType.QUIZ);
      
      if (templateType === 'QUIZ') {
        setTitle('Kuis Harian / Pre-Test');
        setDescription('Waktu pengerjaan 30 menit. Kerjakan dengan jujur.');
      } else {
        setTitle(templateType === 'UTS' ? 'Ujian Tengah Semester Ganjil 2024/2025' : 'Ujian Akhir Semester Ganjil 2024/2025');
        setDescription(templateType === 'UTS' 
          ? 'Waktu pengerjaan 90 menit. Sifat ujian: Tutup Buku. Dilarang bekerjasama.' 
          : 'Waktu pengerjaan 100 menit. Mencakup seluruh materi semester ini.');
      }
      
      // Set default time to tomorrow 08:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      
      const tomorrowEnd = new Date(tomorrow);
      // If quiz, default 30 mins, else 2 hours
      if (templateType === 'QUIZ') {
         tomorrowEnd.setMinutes(30);
      } else {
         tomorrowEnd.setHours(10, 0, 0, 0);
      }
      
      const pad = (n: number) => n < 10 ? '0'+n : n;
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

      setStartTime(fmt(tomorrow));
      setEndTime(fmt(tomorrowEnd));
  };

  // Helper for badges color
  const getBadgeColor = (type: ExamType) => {
     switch(type) {
        case ExamType.UTS: return 'bg-blue-500';
        case ExamType.UAS: return 'bg-purple-500';
        case ExamType.QUIZ: return 'bg-orange-500';
        default: return 'bg-gray-500';
     }
  }

  // Helper untuk menghitung nilai skala 100
  const getNormalizedScore = (rawScore: number, examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return "0.0";
    const maxPoints = exam.questions.reduce((sum, q) => sum + q.points, 0) || 1;
    // Rumus: (Skor Mahasiswa / Total Max Poin) * 100
    return ((rawScore / maxPoints) * 100).toFixed(1);
  };

  // AI Grading Logic
  const handleAutoGrade = async (submission: Submission, question: Question, answerIndex: number) => {
    const answer = submission.answers[answerIndex];
    if (question.type !== QuestionType.ESSAY || !answer.essayText) return;

    setGradingLoading(answerIndex);
    const ref = question.referenceAnswer || "Jawaban harus relevan dengan biomedis.";
    
    const result = await AIService.gradeEssay(question.text, ref, answer.essayText, question.points);
    
    // Update State & DB
    await updateSubmissionScore(submission, answerIndex, result.score, result.feedback);
    setGradingLoading(null);
  };

  const handleManualScoreChange = (submission: Submission, answerIndex: number, newScore: number) => {
     const updatedSubmission = { ...submission };
     updatedSubmission.answers[answerIndex].score = newScore;
     updatedSubmission.totalScore = updatedSubmission.answers.reduce((acc, curr) => acc + (curr.score || 0), 0);
     setSelectedSubmission(updatedSubmission);
  };

  const saveManualGrade = async (submission: Submission) => {
     const toSave = { ...submission, isGraded: true };
     await DB.saveSubmission(toSave);
     setSubmissions(prev => prev.map(s => s.id === toSave.id ? toSave : s));
     alert("Nilai berhasil disimpan ke Cloud!");
  };

  const updateSubmissionScore = async (submission: Submission, answerIndex: number, score: number, feedback?: string) => {
    const updatedSubmission = { ...submission };
    updatedSubmission.answers[answerIndex] = {
      ...updatedSubmission.answers[answerIndex],
      score: score,
      feedback: feedback || updatedSubmission.answers[answerIndex].feedback
    };
    updatedSubmission.totalScore = updatedSubmission.answers.reduce((acc, curr) => acc + (curr.score || 0), 0);
    updatedSubmission.isGraded = true; 
    
    await DB.saveSubmission(updatedSubmission);
    setSelectedSubmission(updatedSubmission);
    setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? updatedSubmission : s));
  };

  const handleExportXLS = () => {
    if (!selectedExamIdForGrading) return;
    const examSubs = getExamSubmissions(selectedExamIdForGrading);
    const exam = exams.find(e => e.id === selectedExamIdForGrading);
    
    if (examSubs.length === 0) {
      alert("Belum ada data pengumpulan untuk didownload.");
      return;
    }

    // 1. Calculate Total Possible Score for the Exam
    // Ini digunakan untuk normalisasi nilai ke range 0-100
    const maxExamPoints = exam?.questions.reduce((sum, q) => sum + q.points, 0) || 1; // Avoid divide by zero

    // 2. Generate XML Spreadsheet (Excel 2003 format) which supports multiple sheets
    // Header XML
    let xmlContent = `<?xml version="1.0"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40">
      <Styles>
        <Style ss:ID="sHeader">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#EFEFEF" ss:Pattern="Solid"/>
          <Borders>
             <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="sData">
           <Borders>
             <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
      </Styles>`;

    // --- SHEET 1: REKAP NILAI (No, NIM, Nama, Nilai 0-100) ---
    // SESUAI PERMINTAAN: HANYA KOLOM PENTING
    xmlContent += `<Worksheet ss:Name="REKAP NILAI (0-100)"><Table>`;
    
    // Header Row
    xmlContent += `<Row>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">No</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">NIM</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">NAMA</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">NILAI AKHIR</Data></Cell>
    </Row>`;

    // Data Rows
    examSubs.forEach((sub, index) => {
        // Rumus Konversi: (Skor Mahasiswa / Total Poin Ujian) * 100
        const finalScore = ((sub.totalScore / maxExamPoints) * 100);
        
        xmlContent += `<Row>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${index + 1}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${sub.studentNim || '-'}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${sub.studentName}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${finalScore.toFixed(2)}</Data></Cell>
        </Row>`;
    });

    xmlContent += `</Table></Worksheet>`;

    // --- SHEET 2: DETAIL LENGKAP (Backup) ---
    xmlContent += `<Worksheet ss:Name="DETAIL & LOG"><Table>`;
    xmlContent += `<Row>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">No</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">NIM</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Nama</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Waktu Submit</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Status Koreksi</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Pelanggaran</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Poin Mentah (Max ${maxExamPoints})</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Nilai Akhir (1-100)</Data></Cell>
    </Row>`;

    examSubs.forEach((sub, index) => {
        const finalScore = ((sub.totalScore / maxExamPoints) * 100);
        const status = sub.isGraded ? "Sudah Dinilai" : "Belum/Sedang Dinilai";

        xmlContent += `<Row>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${index + 1}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${sub.studentNim || '-'}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${sub.studentName}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${new Date(sub.submittedAt).toLocaleString('id-ID')}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="String">${status}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${sub.violationCount || 0}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${sub.totalScore}</Data></Cell>
          <Cell ss:StyleID="sData"><Data ss:Type="Number">${finalScore.toFixed(2)}</Data></Cell>
        </Row>`;
    });

    xmlContent += `</Table></Worksheet></Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REKAP_${exam?.courseName.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files) as File[];
    
    setIsImporting(true);
    try {
      const filePromises = fileList.map(file => {
        return new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            resolve({ data: base64Data, mimeType: file.type });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const processedFiles = await Promise.all(filePromises);
      const generatedQuestions = await AIService.generateQuestionsFromDocument(processedFiles);
      setQuestions([...questions, ...generatedQuestions]);
      alert(`Berhasil mengimpor ${generatedQuestions.length} soal dari dokumen.`);
    } catch (error: any) {
      console.error(error);
      alert(`Gagal memproses file: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getExamSubmissions = (examId: string) => submissions.filter(s => s.examId === examId);
  
  const getStudentStatus = (student: User, examId: string) => {
    const sub = submissions.find(s => s.examId === examId && s.studentId === student.id);
    if (sub) return { status: 'SUBMITTED', data: sub };

    const session = liveSessions.find(s => s.examId === examId && s.studentId === student.id);
    if (session) {
         const lastHeartbeat = new Date(session.lastHeartbeat).getTime();
         const now = Date.now();
         if (now - lastHeartbeat > 30000) return { status: 'OFFLINE', data: session };
         return { status: 'ACTIVE', data: session };
    }
    return { status: 'NOT_STARTED', data: null };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Dashboard Dosen
            {isAdmin && <span className="text-xs bg-slate-900 text-white px-2 py-1 rounded uppercase tracking-wide">Admin Access</span>}
          </h1>
          <p className="text-gray-600">Selamat datang, {user.name}</p>
        </div>
        <div className="space-x-2">
          <button onClick={() => { setActiveTab('my-exams'); cancelEdit(); }} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'my-exams' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}>Bank Ujian</button>
          <button onClick={() => { setActiveTab('create'); cancelEdit(); }} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'create' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}>Buat Ujian</button>
          <button onClick={() => { setActiveTab('submissions'); setSelectedExamIdForGrading(null); setSelectedSubmission(null); }} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'submissions' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}>Monitoring & Nilai</button>
        </div>
      </div>

      {activeTab === 'my-exams' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
           {/* Table Exam List */}
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Mata Kuliah / Judul</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Waktu</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                 <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Aksi</th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-200">
               {exams.map(exam => (
                 <tr key={exam.id}>
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getBadgeColor(exam.type)}`}>{exam.type}</span>
                       <div className="font-bold">{exam.courseName}</div>
                     </div>
                     <div className="text-sm text-gray-500">{exam.title}</div>
                     <div className="flex gap-2 mt-1">
                        <div className="text-xs text-gray-400">Kode: <span className="font-mono bg-gray-100 px-1 rounded text-gray-700 font-bold select-all">{exam.accessCode}</span></div>
                        {isAdmin && <div className="text-xs bg-slate-100 px-1 rounded text-slate-500">Oleh: {exam.lecturerName}</div>}
                     </div>
                   </td>
                   <td className="px-6 py-4 text-sm">
                      {new Date(exam.startTime).toLocaleString('id-ID')}
                   </td>
                   <td className="px-6 py-4">
                     <span className={`px-2 py-1 text-xs rounded-full font-bold ${exam.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{exam.isActive ? 'Active' : 'Hidden'}</span>
                   </td>
                   <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button onClick={() => { setLiveMonitorExam(exam); setShowLiveMonitor(true); }} className="text-blue-600 hover:underline">Monitor</button>
                      <button onClick={() => handleEditExam(exam)} className="text-orange-600 hover:underline font-bold">Edit</button>
                      <button onClick={() => handleToggleActive(exam)} className="text-indigo-600 hover:underline">{exam.isActive ? 'Stop' : 'Publish'}</button>
                      <button onClick={() => handleDeleteExam(exam.id)} className="text-red-600 hover:underline">Hapus</button>
                   </td>
                 </tr>
               ))}
               {exams.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada ujian.</td></tr>}
             </tbody>
           </table>
        </div>
      )}

      {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 space-y-6">
                {/* Template Shortcut (Only show if not editing) */}
                {!editingExamId && (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <p className="text-sm font-bold text-green-800 mb-2">Jalan Pintas (Template)</p>
                    <div className="flex gap-2">
                        <button onClick={() => applyTemplate('QUIZ')} className="flex-1 bg-orange-500 text-white text-sm py-2 rounded font-medium hover:bg-orange-600">Set Quiz</button>
                        <button onClick={() => applyTemplate('UTS')} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded font-medium hover:bg-blue-700">Set UTS</button>
                        <button onClick={() => applyTemplate('UAS')} className="flex-1 bg-purple-600 text-white text-sm py-2 rounded font-medium hover:bg-purple-700">Set UAS</button>
                    </div>
                    </div>
                )}
                
                {editingExamId && (
                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex justify-between items-center">
                       <span className="text-orange-800 font-bold text-sm">Mode Edit Ujian</span>
                       <button onClick={cancelEdit} className="text-xs bg-white border px-2 py-1 rounded text-gray-600 hover:bg-gray-100">Batal Edit</button>
                   </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <h2 className="font-bold mb-4">{editingExamId ? 'Edit Data Ujian' : 'Setting Ujian Baru'}</h2>
                    {/* Inputs */}
                    <div className="mb-2">
                        <label className="text-xs text-gray-500 block">Tipe Ujian</label>
                        <select className="w-full p-2 border rounded" value={type} onChange={e => setType(e.target.value as ExamType)}>
                            <option value={ExamType.QUIZ}>Kuis Harian / Quiz</option>
                            <option value={ExamType.UTS}>UTS (Tengah Semester)</option>
                            <option value={ExamType.UAS}>UAS (Akhir Semester)</option>
                        </select>
                    </div>
                    <input className="w-full p-2 border rounded mb-2" placeholder="Judul Ujian" value={title} onChange={e => setTitle(e.target.value)} />
                    <input className="w-full p-2 border rounded mb-2" placeholder="Mata Kuliah" value={course} onChange={e => setCourse(e.target.value)} />
                    <textarea className="w-full p-2 border rounded mb-2" placeholder="Deskripsi / Peraturan" value={description} onChange={e => setDescription(e.target.value)} />
                    <div className="mb-2">
                       <label className="text-xs font-bold block mb-1">Mulai</label>
                       <input type="datetime-local" className="w-full p-2 border rounded" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                    <div className="mb-4">
                       <label className="text-xs font-bold block mb-1">Selesai</label>
                       <input type="datetime-local" className="w-full p-2 border rounded" value={endTime} onChange={e => setEndTime(e.target.value)} />
                    </div>
                    {/* Import AI */}
                    <div className="bg-blue-50 p-4 rounded border border-blue-200">
                        <p className="text-sm text-blue-800 mb-2 font-bold">Import Soal (AI)</p>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full bg-white border text-blue-600 py-1 rounded text-sm hover:bg-blue-50">
                           {isImporting ? 'Sedang Memproses PDF...' : 'Upload Bank Soal (PDF/Img)'}
                        </button>
                        <input type="file" hidden ref={fileInputRef} multiple onChange={handleFileChange} />
                    </div>
                </div>
                {/* Manual Input */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                   <h3 className="font-bold text-sm mb-2">{editingQuestionIndex !== null ? 'Edit Soal (Mode Edit)' : 'Input Manual Soal Baru'}</h3>
                   <textarea className="w-full p-2 border rounded mb-2" placeholder="Pertanyaan" value={qText} onChange={e=>setQText(e.target.value)} />
                   <div className="flex gap-2 mb-2">
                      <select className="border p-1 rounded" value={qType} onChange={e=>setQType(e.target.value as any)}>
                         <option value={QuestionType.MULTIPLE_CHOICE}>Pilihan Ganda</option>
                         <option value={QuestionType.ESSAY}>Esai / Uraian</option>
                      </select>
                      <input type="number" className="w-16 border p-1 rounded" placeholder="Poin" value={qPoints} onChange={e=>setQPoints(Number(e.target.value))} />
                   </div>
                   {qType === QuestionType.MULTIPLE_CHOICE && qOptions.map((o,i)=>(
                      <div key={i} className="flex gap-1 mb-1"><input type="radio" checked={qCorrect===i} onChange={()=>setQCorrect(i)} /><input className="border w-full p-1 text-sm" value={o} onChange={e=>{const n=[...qOptions];n[i]=e.target.value;setQOptions(n)}} placeholder={`Opsi ${i+1}`} /></div>
                   ))}
                   {qType === QuestionType.ESSAY && <textarea className="w-full border p-2 mb-2 bg-yellow-50 text-sm" placeholder="Kunci Jawaban (Untuk AI)" value={qRefAnswer} onChange={e=>setQRefAnswer(e.target.value)} />}
                   
                   <div className="flex gap-2 mt-2">
                       <button onClick={addQuestion} className={`flex-1 p-2 rounded text-sm font-bold transition-colors ${editingQuestionIndex !== null ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-gray-100 hover:bg-gray-200'}`}>
                           {editingQuestionIndex !== null ? 'Update Soal' : 'Tambah ke Draft'}
                       </button>
                       {editingQuestionIndex !== null && (
                           <button onClick={clearQuestionForm} className="px-4 bg-red-100 text-red-600 rounded text-sm font-bold hover:bg-red-200 border border-red-200">
                               Batal
                           </button>
                       )}
                   </div>
                </div>
             </div>
             <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-xl shadow-sm border h-full flex flex-col">
                    <h2 className="font-bold mb-4">Draft Soal ({questions.length})</h2>
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded mb-4">
                        {questions.length === 0 ? (
                           <div className="text-center text-gray-400 py-10">Belum ada soal. Upload PDF atau input manual.</div>
                        ) : questions.map((q,i)=>(
                           <div key={i} className={`mb-2 p-3 bg-white border rounded hover:shadow-sm relative group ${editingQuestionIndex === i ? 'ring-2 ring-orange-300 border-orange-300' : ''}`}>
                              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border">
                                  <button onClick={() => editQuestionInDraft(i)} className="text-blue-500 hover:text-blue-700 font-bold text-xs flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    Edit
                                  </button>
                                  <div className="w-px bg-gray-300 h-4"></div>
                                  <button onClick={() => deleteQuestion(i)} className="text-red-500 hover:text-red-700 font-bold text-xs">Hapus</button>
                              </div>
                              <div className="flex justify-between pr-20">
                                 <div className="font-bold text-sm">#{i+1} {q.text}</div>
                                 <div className="text-xs font-bold text-gray-500 whitespace-nowrap">{q.points} Poin</div>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{q.type === QuestionType.MULTIPLE_CHOICE ? 'Pilihan Ganda' : 'Esai'}</div>
                           </div>
                        ))}
                    </div>
                    <button onClick={handleCreateOrUpdateExam} disabled={questions.length===0} className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                       {editingExamId ? 'Update & Simpan Perubahan' : 'Simpan & Terbitkan Ujian'}
                    </button>
                </div>
             </div>
          </div>
      )}

      {activeTab === 'submissions' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {!selectedExamIdForGrading ? exams.map(exam => (
                 <div key={exam.id} onClick={() => setSelectedExamIdForGrading(exam.id)} className="bg-white p-6 rounded shadow cursor-pointer hover:border-green-500 border hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-lg">{exam.courseName}</h3>
                       <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-mono">{exam.type}</span>
                    </div>
                    <p className="text-sm text-gray-500">{getExamSubmissions(exam.id).length} Mahasiswa mengumpulkan</p>
                    {isAdmin && <p className="text-[10px] text-gray-400 mt-1">Oleh: {exam.lecturerName}</p>}
                    <div className="mt-4 pt-4 border-t flex justify-end">
                       <span className="text-green-600 text-sm font-bold">Buka Koreksi →</span>
                    </div>
                 </div>
             )) : (
                 <div className="col-span-full">
                     <div className="flex justify-between items-center mb-4">
                        <button onClick={() => {setSelectedExamIdForGrading(null); setSelectedSubmission(null)}} className="text-gray-500 hover:text-gray-800">← Kembali ke Daftar Ujian</button>
                        <div className="space-x-2">
                           <button onClick={handleExportXLS} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700">Download Excel (Nilai)</button>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded border h-[600px] overflow-y-auto">
                           <div className="p-3 bg-gray-50 border-b font-bold text-sm">Daftar Mahasiswa</div>
                           {getExamSubmissions(selectedExamIdForGrading).length === 0 && <div className="p-4 text-center text-sm text-gray-400">Belum ada pengumpulan.</div>}
                           {getExamSubmissions(selectedExamIdForGrading).map(sub => (
                              <div key={sub.id} onClick={() => setSelectedSubmission(sub)} className={`p-3 border-b cursor-pointer flex justify-between items-center ${selectedSubmission?.id === sub.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'}`}>
                                 <div>
                                    <div className="font-bold text-sm">{sub.studentName}</div>
                                    <div className="text-xs text-gray-400">{sub.studentNim || 'No NIM'}</div>
                                 </div>
                                 <div className={`text-xs font-bold px-2 py-1 rounded ${sub.isGraded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {getNormalizedScore(sub.totalScore, sub.examId)}
                                 </div>
                              </div>
                           ))}
                        </div>
                        <div className="lg:col-span-2 bg-white rounded border h-[600px] overflow-y-auto p-6">
                           {selectedSubmission ? (
                              <div>
                                 <div className="flex justify-between items-center mb-6 border-b pb-4">
                                    <div>
                                       <h2 className="font-bold text-xl">{selectedSubmission.studentName}</h2>
                                       <p className="text-sm text-gray-500">Dikumpulkan: {new Date(selectedSubmission.submittedAt).toLocaleString('id-ID')}</p>
                                    </div>
                                    <div className="text-right">
                                       <div className="text-2xl font-bold text-green-600">
                                          {getNormalizedScore(selectedSubmission.totalScore, selectedSubmission.examId)}
                                          <span className="text-sm font-normal text-gray-400 ml-1">/ 100</span>
                                       </div>
                                       <div className="text-xs text-gray-500">Nilai Akhir</div>
                                       <div className="text-xs text-gray-400">Poin Mentah: {selectedSubmission.totalScore}</div>
                                    </div>
                                 </div>

                                 {selectedSubmission.answers.map((ans, idx) => {
                                    const q = exams.find(e => e.id === selectedSubmission.examId)?.questions.find(qu => qu.id === ans.questionId);
                                    return (
                                       <div key={idx} className="mb-6 p-4 border rounded bg-gray-50">
                                          <div className="font-bold text-sm mb-2 text-gray-800">Soal {idx+1}: {q?.text}</div>
                                          
                                          {q?.type === QuestionType.ESSAY ? (
                                             <div className="bg-white p-3 rounded border mb-3">
                                                <p className="text-sm whitespace-pre-wrap">{ans.essayText}</p>
                                             </div>
                                          ) : (
                                             <div className="bg-white p-3 rounded border mb-3 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${q?.correctOptionIndex === ans.selectedOptionIndex ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                <p className="text-sm">Jawaban: {q?.options?.[ans.selectedOptionIndex||0]} {q?.correctOptionIndex === ans.selectedOptionIndex ? '(Benar)' : '(Salah)'}</p>
                                             </div>
                                          )}

                                          {q?.type === QuestionType.ESSAY && (
                                             <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                                <div className="text-xs text-blue-800 mb-2 font-bold">Area Penilaian Dosen</div>
                                                <div className="text-xs text-gray-500 mb-2 italic">Kunci: {q.referenceAnswer}</div>
                                                
                                                <div className="flex items-center gap-3 mb-2">
                                                   <div className="flex items-center gap-1">
                                                      <span className="text-xs font-bold">Nilai:</span>
                                                      <input type="number" className="w-16 border p-1 rounded text-sm" value={ans.score} onChange={e => handleManualScoreChange(selectedSubmission, idx, Number(e.target.value))} />
                                                      <span className="text-xs text-gray-400">/ {q.points}</span>
                                                   </div>
                                                   <button onClick={() => handleAutoGrade(selectedSubmission, q, idx)} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 flex items-center gap-1">
                                                      {gradingLoading===idx ? 'Sedang berpikir...' : '✨ AI Grade'}
                                                   </button>
                                                </div>
                                                <div className="mt-2 text-xs bg-white p-2 rounded border">
                                                   <span className="font-bold text-gray-600 block mb-1">Feedback AI:</span>
                                                   {ans.feedback || '-'}
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    )
                                 })}
                                 <button onClick={() => saveManualGrade(selectedSubmission)} className="bg-green-600 text-white w-full py-3 rounded-lg font-bold mt-4 hover:bg-green-700 shadow-lg">
                                    Simpan Perubahan Nilai
                                 </button>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                 <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                 <p>Pilih mahasiswa dari daftar di sebelah kiri untuk mulai mengoreksi.</p>
                              </div>
                           )}
                        </div>
                     </div>
                 </div>
             )}
         </div>
      )}

      {/* Live Monitor Modal */}
      {showLiveMonitor && liveMonitorExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full h-[80vh] flex flex-col">
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
                     <div>
                        <h3 className="font-bold text-lg">Live Monitor: {liveMonitorExam.courseName}</h3>
                        <p className="text-xs text-slate-400">Memperbarui status setiap 3 detik...</p>
                     </div>
                     <button onClick={() => setShowLiveMonitor(false)} className="text-white hover:text-red-400 font-bold text-xl">✕</button>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Active Column */}
                          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                             <div className="bg-blue-50 p-3 border-b border-blue-100">
                                <div className="font-bold text-blue-800 text-center">Sedang Mengerjakan</div>
                                <div className="text-xs text-center text-blue-600">{allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'ACTIVE').length} Mahasiswa</div>
                             </div>
                             <div className="p-2 overflow-y-auto flex-1">
                                {allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'ACTIVE').map(s => {
                                   const session = liveSessions.find(ses => ses.studentId === s.id && ses.examId === liveMonitorExam.id);
                                   return (
                                      <div key={s.id} className="text-sm p-3 border-b flex justify-between items-center">
                                         <span>{s.name}</span>
                                         {session && session.violationCount > 0 && <span className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Warn: {session.violationCount}</span>}
                                      </div>
                                   )
                                })}
                             </div>
                          </div>

                          {/* Submitted Column */}
                          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                             <div className="bg-green-50 p-3 border-b border-green-100">
                                <div className="font-bold text-green-800 text-center">Sudah Kumpul</div>
                                <div className="text-xs text-center text-green-600">{allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'SUBMITTED').map(s => s).length} Mahasiswa</div>
                             </div>
                             <div className="p-2 overflow-y-auto flex-1">
                                {allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'SUBMITTED').map(s => (
                                   <div key={s.id} className="text-sm p-3 border-b text-gray-700 flex justify-between items-center">
                                      <span>{s.name}</span>
                                      <span className="text-xs text-green-600">✓</span>
                                   </div>
                                ))}
                             </div>
                          </div>

                          {/* Offline Column */}
                          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                             <div className="bg-gray-50 p-3 border-b border-gray-200">
                                <div className="font-bold text-gray-800 text-center">Belum Hadir / Offline</div>
                             </div>
                             <div className="p-2 overflow-y-auto flex-1">
                                {allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status !== 'ACTIVE' && getStudentStatus(s, liveMonitorExam.id).status !== 'SUBMITTED').map(s => (
                                   <div key={s.id} className="text-sm p-3 border-b text-gray-400 flex justify-between items-center">
                                      <span>{s.name}</span>
                                      <span className="text-[10px] bg-gray-100 px-2 rounded">Offline</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};