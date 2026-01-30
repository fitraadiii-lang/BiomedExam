import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, ExamType, Question, QuestionType, Submission, ExamSession } from '../types';
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
  
  // Create Exam State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState<ExamType>(ExamType.UTS);
  
  // Time Scheduling State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Question Form State (Manual Input)
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [qPoints, setQPoints] = useState(10);
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qRefAnswer, setQRefAnswer] = useState('');

  // Grading & Monitoring State
  const [selectedExamIdForGrading, setSelectedExamIdForGrading] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradingLoading, setGradingLoading] = useState<number | null>(null); // Store index of question being graded
  const [showRecapModal, setShowRecapModal] = useState(false);
  
  // Live Monitor State
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const [liveMonitorExam, setLiveMonitorExam] = useState<Exam | null>(null);
  const [liveSessions, setLiveSessions] = useState<ExamSession[]>([]);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Poll for live monitor updates when modal is open
  useEffect(() => {
    let interval: any;
    if (showLiveMonitor && liveMonitorExam) {
      const fetchLive = () => {
         // Re-fetch all needed data
         const sessions = DB.getSessionsByExam(liveMonitorExam.id);
         const subs = DB.getSubmissionsByExam(liveMonitorExam.id);
         setLiveSessions(sessions);
         setSubmissions(subs);
      };
      
      fetchLive(); // Initial fetch
      interval = setInterval(fetchLive, 3000); // Poll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [showLiveMonitor, liveMonitorExam]);

  const loadData = () => {
    setExams(DB.getExams().filter(e => e.lecturerId === user.id));
    setSubmissions(DB.getSubmissions().filter(s => {
      const exam = DB.getExamById(s.examId);
      return exam?.lecturerId === user.id;
    }));
    setAllStudents(DB.getStudents());
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const addQuestion = () => {
    if (!qText.trim()) return;

    const newQ: Question = {
      id: Date.now().toString(),
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

    setQuestions([...questions, newQ]);
    setQText('');
    setQRefAnswer('');
    setQOptions(['', '', '', '']);
    alert("Soal ditambahkan ke Draft!");
  };

  const updateQuestionPoints = (index: number, newPoints: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].points = newPoints;
    setQuestions(updatedQuestions);
  };

  const handleCreateExam = () => {
    if (!startTime || !endTime) {
      alert("Harap tentukan Waktu Mulai dan Waktu Selesai ujian.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      alert("Waktu Selesai harus setelah Waktu Mulai.");
      return;
    }

    const newExam: Exam = {
      id: Date.now().toString(),
      accessCode: generateCode(),
      title,
      description,
      courseName: course,
      type,
      lecturerId: user.id,
      lecturerName: user.name,
      questions,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString()
    };
    DB.saveExam(newExam);
    loadData();
    alert(`Ujian berhasil dibuat!\n\nKODE AKSES: ${newExam.accessCode}\n\nBerikan kode ini kepada mahasiswa.`);
    setQuestions([]);
    setTitle('');
    setDescription('');
    setCourse('');
    setStartTime('');
    setEndTime('');
    setActiveTab('my-exams');
  };

  const handleToggleActive = (exam: Exam) => {
    const updatedExam = { ...exam, isActive: !exam.isActive };
    DB.saveExam(updatedExam);
    loadData();
  };

  const handleDeleteExam = (id: string) => {
    if (confirm("Apakah anda yakin ingin menghapus ujian ini? Data nilai mungkin akan hilang.")) {
        const allExams = DB.getExams();
        const filtered = allExams.filter(e => e.id !== id);
        localStorage.setItem('biomed_exams', JSON.stringify(filtered));
        loadData();
    }
  }

  // AI Grading Logic
  const handleAutoGrade = async (submission: Submission, question: Question, answerIndex: number) => {
    const answer = submission.answers[answerIndex];
    if (question.type !== QuestionType.ESSAY || !answer.essayText) return;

    setGradingLoading(answerIndex);
    // Use stored reference answer or fallback
    const ref = question.referenceAnswer || "Jawaban harus relevan dengan biomedis.";
    
    const result = await AIService.gradeEssay(question.text, ref, answer.essayText, question.points);
    
    // Update State & DB
    updateSubmissionScore(submission, answerIndex, result.score, result.feedback);
    setGradingLoading(null);
  };

  // Manual Grading Logic
  const handleManualScoreChange = (submission: Submission, answerIndex: number, newScore: number) => {
     const updatedSubmission = { ...submission };
     updatedSubmission.answers[answerIndex].score = newScore;
     updatedSubmission.totalScore = updatedSubmission.answers.reduce((acc, curr) => acc + (curr.score || 0), 0);
     setSelectedSubmission(updatedSubmission);
  };

  const saveManualGrade = (submission: Submission) => {
     const toSave = { ...submission, isGraded: true };
     DB.saveSubmission(toSave);
     setSubmissions(prev => prev.map(s => s.id === toSave.id ? toSave : s));
     alert("Nilai berhasil disimpan!");
  };

  const updateSubmissionScore = (submission: Submission, answerIndex: number, score: number, feedback?: string) => {
    const updatedSubmission = { ...submission };
    updatedSubmission.answers[answerIndex] = {
      ...updatedSubmission.answers[answerIndex],
      score: score,
      feedback: feedback || updatedSubmission.answers[answerIndex].feedback
    };
    updatedSubmission.totalScore = updatedSubmission.answers.reduce((acc, curr) => acc + (curr.score || 0), 0);
    updatedSubmission.isGraded = true; 
    DB.saveSubmission(updatedSubmission);
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

    // HTML Table method for robust Excel compatibility
    let tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
        <x:ExcelWorkbook>
        <x:ExcelWorksheets>
        <x:ExcelWorksheet>
        <x:Name>Rekap Nilai</x:Name>
        <x:WorksheetOptions>
        <x:DisplayGridlines/>
        </x:WorksheetOptions>
        </x:ExcelWorksheet>
        </x:ExcelWorksheets>
        </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th style="background-color:#eee;font-weight:bold;">NIM</th>
              <th style="background-color:#eee;font-weight:bold;">Nama Mahasiswa</th>
              <th style="background-color:#eee;font-weight:bold;">Waktu Submit</th>
              <th style="background-color:#eee;font-weight:bold;">Status Koreksi</th>
              <th style="background-color:#eee;font-weight:bold;">Pelanggaran</th>
              <th style="background-color:#eee;font-weight:bold;">Total Nilai</th>
            </tr>
          </thead>
          <tbody>
    `;

    examSubs.forEach(sub => {
      const status = sub.isGraded ? "Sudah Dinilai" : "Belum/Sedang Dinilai";
      tableContent += `
        <tr>
          <td style="mso-number-format:'@'">${sub.studentNim || '-'}</td>
          <td>${sub.studentName}</td>
          <td>${new Date(sub.submittedAt).toLocaleString('id-ID')}</td>
          <td>${status}</td>
          <td>${sub.violationCount || 0}</td>
          <td x:num>${sub.totalScore}</td>
        </tr>
      `;
    });

    tableContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `REKAP_${exam?.courseName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xls`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files) as File[];
    
    if (fileList.length > 7) {
      alert("Maksimal upload 7 file sekaligus.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
      // Removed targetMcq/Essay options
      const generatedQuestions = await AIService.generateQuestionsFromDocument(processedFiles);
      
      setQuestions([...questions, ...generatedQuestions]);
      alert(`Berhasil mengimpor ${generatedQuestions.length} soal dari dokumen. Silakan cek draft.`);
      
    } catch (error: any) {
      console.error(error);
      alert(`Gagal memproses file: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getExamSubmissions = (examId: string) => submissions.filter(s => s.examId === examId);
  
  // Live Monitor Logic helpers
  const getStudentStatus = (student: User, examId: string) => {
    const sub = submissions.find(s => s.examId === examId && s.studentId === student.id);
    if (sub) return { status: 'SUBMITTED', data: sub };

    const session = liveSessions.find(s => s.examId === examId && s.studentId === student.id);
    if (session) return { status: 'ACTIVE', data: session };

    return { status: 'NOT_STARTED', data: null };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Dosen</h1>
          <p className="text-gray-600">Selamat datang, {user.name}</p>
        </div>
        <div className="space-x-2">
          <button 
            onClick={() => setActiveTab('my-exams')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'my-exams' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            Bank Ujian
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'create' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            Buat Ujian
          </button>
          <button 
            onClick={() => {
              setActiveTab('submissions');
              setSelectedExamIdForGrading(null);
              setSelectedSubmission(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'submissions' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            Monitoring & Nilai
          </button>
        </div>
      </div>

      {activeTab === 'my-exams' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mata Kuliah / Judul</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu Pelaksanaan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {exams.map(exam => (
                <tr key={exam.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{exam.courseName}</div>
                    <div className="text-sm text-gray-500">{exam.title}</div>
                    <div className="text-xs text-gray-400 mt-1">Kode: {exam.accessCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-bold">{exam.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>Mulai: {new Date(exam.startTime).toLocaleString('id-ID')}</div>
                    <div>Selesai: {new Date(exam.endTime).toLocaleString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${exam.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {exam.isActive ? 'PUBLISH' : 'HIDDEN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
                      onClick={() => {
                        setLiveMonitorExam(exam);
                        setShowLiveMonitor(true);
                      }}
                      className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 flex inline-flex items-center gap-1"
                    >
                       <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                       Live Monitor
                    </button>
                    <button onClick={() => handleToggleActive(exam)} className="text-indigo-600 hover:text-indigo-900">
                        {exam.isActive ? 'Stop' : 'Publish'}
                    </button>
                    <button onClick={() => handleDeleteExam(exam.id)} className="text-red-600 hover:text-red-900">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-xl font-bold mb-4">Setting Ujian</h2>
              <div className="space-y-4">
                <input placeholder="Judul Ujian" className="w-full p-2 border rounded" value={title} onChange={e => setTitle(e.target.value)} />
                <textarea placeholder="Deskripsi" className="w-full p-2 border rounded" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
                <input placeholder="Mata Kuliah" className="w-full p-2 border rounded" value={course} onChange={e => setCourse(e.target.value)} />
                
                <div>
                   <label className="block text-xs font-bold text-gray-500 mb-1">Jenis Ujian</label>
                   <select className="w-full p-2 border rounded" value={type} onChange={e => setType(e.target.value as ExamType)}>
                      <option value={ExamType.UTS}>UTS</option>
                      <option value={ExamType.UAS}>UAS</option>
                   </select>
                </div>

                <div className="grid grid-cols-1 gap-3">
                   <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1">Waktu Mulai</label>
                     <input 
                       type="datetime-local" 
                       className="w-full p-2 border rounded text-sm" 
                       value={startTime} 
                       onChange={e => setStartTime(e.target.value)} 
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1">Waktu Selesai (Auto Submit)</label>
                     <input 
                       type="datetime-local" 
                       className="w-full p-2 border rounded text-sm" 
                       value={endTime} 
                       onChange={e => setEndTime(e.target.value)} 
                     />
                   </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Smart Import (AI)
                </h2>
              </div>
              <p className="text-xs text-blue-600 mb-4">
                Upload materi (PDF/Gambar). AI akan otomatis menganalisis dokumen dan membuatkan soal (PG & Essay) yang relevan.
              </p>
              
              <input 
                type="file" 
                multiple
                accept=".pdf, image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full bg-white border border-blue-300 text-blue-700 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menganalisis Dokumen...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Upload & Generate
                  </>
                )}
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border">
               <h3 className="font-bold mb-2 text-sm">Input Manual</h3>
                <textarea placeholder="Pertanyaan" className="w-full p-2 border rounded mb-2 text-sm" rows={2} value={qText} onChange={e => setQText(e.target.value)} />
                <div className="flex gap-2 mb-2">
                  <select className="p-2 border rounded text-sm flex-1" value={qType} onChange={e => setQType(e.target.value as QuestionType)}>
                    <option value={QuestionType.MULTIPLE_CHOICE}>PG</option>
                    <option value={QuestionType.ESSAY}>Essay</option>
                  </select>
                  <input type="number" className="w-16 p-2 border rounded text-sm" value={qPoints} onChange={e => setQPoints(Number(e.target.value))} />
                </div>
                {qType === QuestionType.MULTIPLE_CHOICE && qOptions.map((o,i) => (
                    <div key={i} className="flex gap-1 mb-1">
                        <input type="radio" checked={qCorrect===i} onChange={()=>setQCorrect(i)} />
                        <input className="border rounded w-full px-2 text-sm" value={o} onChange={e=>{const n=[...qOptions];n[i]=e.target.value;setQOptions(n)}} placeholder={`Opsi ${i+1}`} />
                    </div>
                ))}
                 {qType === QuestionType.ESSAY && (
                  <textarea placeholder="Jawaban Referensi" className="w-full p-2 border rounded bg-yellow-50 text-sm mb-2" rows={2} value={qRefAnswer} onChange={e => setQRefAnswer(e.target.value)} />
                )}
                <button onClick={addQuestion} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-sm font-bold mt-2">Tambah Manual</button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-xl shadow-sm border min-h-[500px] flex flex-col">
              <h2 className="text-xl font-bold mb-4">Draft Soal ({questions.length})</h2>
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] mb-4">
                {questions.map((q, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded border relative group">
                    <button onClick={() => {const newQ = [...questions];newQ.splice(i, 1);setQuestions(newQ);}} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100">Hapus</button>
                    <div className="flex justify-between font-bold text-gray-700 text-sm mb-1">
                       <span>Soal {i + 1} ({q.type === QuestionType.MULTIPLE_CHOICE ? 'PG' : 'Essay'})</span>
                       <span>{q.points} Poin</span>
                    </div>
                    <p className="mb-2 whitespace-pre-wrap">{q.text}</p>
                    {q.type === QuestionType.MULTIPLE_CHOICE && (
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {q.options?.map((o, idx) => (
                          <li key={idx} className={idx === q.correctOptionIndex ? 'text-green-600 font-bold' : ''}>{o}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <button 
                onClick={handleCreateExam}
                disabled={questions.length === 0 || !title}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow-lg"
              >
                Simpan & Terbitkan Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && !selectedExamIdForGrading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => (
              <div key={exam.id} onClick={() => setSelectedExamIdForGrading(exam.id)} className="bg-white p-6 rounded-xl shadow-sm border cursor-pointer hover:border-green-500 transition-colors">
                <h3 className="font-bold text-lg">{exam.courseName}</h3>
                <p className="text-sm text-gray-500">{new Date(exam.startTime).toLocaleString('id-ID')}</p>
                <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">Kode: {exam.accessCode}</span>
                    <span className="text-sm font-bold text-green-600">{getExamSubmissions(exam.id).length} Submissions</span>
                </div>
              </div>
          ))}
        </div>
      )}
      
      {activeTab === 'submissions' && selectedExamIdForGrading && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3 flex justify-between">
                <button onClick={() => {setSelectedExamIdForGrading(null); setSelectedSubmission(null)}} className="text-gray-500">← Kembali</button>
                <div className="flex gap-2">
                    <button onClick={() => setShowRecapModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Lihat Tabel Rekap
                    </button>
                    <button onClick={handleExportXLS} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Excel (.xls)
                    </button>
                </div>
            </div>
            
            <div className="lg:col-span-1 bg-white rounded border h-[600px] overflow-y-auto">
                 <div className="p-3 bg-gray-50 font-bold border-b">Daftar Mahasiswa</div>
                 {getExamSubmissions(selectedExamIdForGrading).map(sub => (
                     <div key={sub.id} onClick={() => setSelectedSubmission(sub)} className={`p-3 border-b cursor-pointer hover:bg-green-50 ${selectedSubmission?.id === sub.id ? 'bg-green-100' : ''}`}>
                         <div className="flex justify-between items-start">
                             <div>
                                <div className="font-bold text-sm">{sub.studentName}</div>
                                <div className="text-xs text-gray-500">{sub.studentNim}</div>
                             </div>
                             <div className="text-right">
                                <div className="font-bold text-green-600 text-sm">{sub.totalScore}</div>
                                <div className="text-[10px] text-gray-400">{sub.isGraded ? 'Dinilai' : 'Pending'}</div>
                             </div>
                         </div>
                         {sub.violationCount && sub.violationCount > 0 ? <span className="text-xs text-red-600 font-bold block mt-1">⚠️ {sub.violationCount} Pelanggaran</span> : null}
                     </div>
                 ))}
            </div>
            
            <div className="lg:col-span-2 bg-white rounded border h-[600px] overflow-y-auto p-6">
                 {selectedSubmission ? (
                     <div>
                         <h2 className="text-2xl font-bold mb-4">{selectedSubmission.studentName}</h2>
                         {selectedSubmission.answers.map((ans, idx) => {
                             const q = exams.find(e => e.id === selectedSubmission.examId)?.questions.find(qu => qu.id === ans.questionId);
                             return (
                                 <div key={idx} className="mb-6 border-b pb-4">
                                     <div className="font-bold mb-2">Soal {idx+1}: {q?.text}</div>
                                     <div className="bg-gray-50 p-3 rounded mb-2 text-sm">
                                         {q?.type === QuestionType.ESSAY ? (
                                           <div className="whitespace-pre-wrap">{ans.essayText}</div>
                                         ) : (
                                           `Jawaban: ${q?.options?.[ans.selectedOptionIndex||0]}`
                                         )}
                                     </div>
                                     {q?.type === QuestionType.ESSAY && (
                                         <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                             <div className="flex gap-2 items-start mb-2">
                                                 <div className="flex-1">
                                                     <label className="text-xs font-bold block text-gray-500">Jawaban Referensi (Kunci):</label>
                                                     <div className="text-xs text-gray-600 italic mb-2">{q?.referenceAnswer || '-'}</div>
                                                     <label className="text-xs font-bold block text-gray-500">Feedback:</label>
                                                     <div className="text-sm p-2 bg-white border rounded min-h-[40px]">{ans.feedback || <span className="text-gray-400">Belum ada feedback</span>}</div>
                                                 </div>
                                                 <div className="w-24">
                                                     <label className="text-xs font-bold block text-gray-500">Nilai (Max {q.points}):</label>
                                                     <input 
                                                        type="number" 
                                                        min="0"
                                                        max={q.points}
                                                        className="w-full border-2 border-blue-200 p-1 rounded font-bold text-center text-lg focus:border-blue-500 outline-none" 
                                                        value={ans.score} 
                                                        onChange={(e) => handleManualScoreChange(selectedSubmission, idx, Number(e.target.value))} 
                                                     />
                                                 </div>
                                             </div>
                                             <button 
                                                onClick={() => handleAutoGrade(selectedSubmission, q!, idx)} 
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                                disabled={gradingLoading === idx}
                                             >
                                                {gradingLoading === idx ? (
                                                  <span className="animate-pulse">Menilai...</span>
                                                ) : (
                                                  <>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                    Koreksi Cerdas (AI)
                                                  </>
                                                )}
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             )
                         })}
                         <div className="sticky bottom-0 bg-white pt-4 border-t mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600">Total Skor Akhir:</span>
                                <span className="text-2xl font-bold text-green-700">{selectedSubmission.totalScore}</span>
                            </div>
                            <button onClick={() => saveManualGrade(selectedSubmission)} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform hover:scale-[1.01]">Simpan Semua Nilai</button>
                         </div>
                     </div>
                 ) : <div className="text-center text-gray-400 mt-20">Pilih mahasiswa dari daftar di sebelah kiri</div>}
            </div>
         </div>
      )}

      {/* RECAP MODAL */}
      {showRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col animate-[scaleIn_0.2s_ease-out]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-lg text-gray-800">Rekap Nilai: {exams.find(e => e.id === selectedExamIdForGrading)?.courseName}</h3>
                    <button onClick={() => setShowRecapModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">✕</button>
                </div>
                <div className="overflow-auto p-0">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">NIM</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Nama Mahasiswa</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Waktu Submit</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {getExamSubmissions(selectedExamIdForGrading).map(sub => (
                                <tr key={sub.id} className="hover:bg-green-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{sub.studentNim || '-'}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{sub.studentName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(sub.submittedAt).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${sub.isGraded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {sub.isGraded ? 'Selesai' : 'Pending'}
                                        </span>
                                        {sub.violationCount ? <span className="ml-2 text-xs text-red-600 font-bold">⚠ {sub.violationCount}</span> : null}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-green-700 text-lg">{sub.totalScore}</td>
                                </tr>
                            ))}
                            {getExamSubmissions(selectedExamIdForGrading).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">Belum ada data nilai.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={handleExportXLS} className="bg-green-600 text-white px-5 py-2 rounded font-bold shadow hover:bg-green-700 transition-colors">Download Excel (.xls)</button>
                    <button onClick={() => setShowRecapModal(false)} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded font-medium hover:bg-gray-50 transition-colors">Tutup</button>
                </div>
            </div>
        </div>
      )}

      {/* LIVE MONITOR MODAL */}
      {showLiveMonitor && liveMonitorExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col">
                <div className="bg-slate-900 text-white p-4 rounded-t-xl flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl flex items-center gap-2">
                           <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                           Live Monitor: {liveMonitorExam.courseName}
                        </h3>
                        <p className="text-sm text-slate-400">Auto-refreshing every 3s • End Time: {new Date(liveMonitorExam.endTime).toLocaleTimeString()}</p>
                    </div>
                    <button onClick={() => setShowLiveMonitor(false)} className="text-white hover:text-gray-300 text-2xl font-bold">✕</button>
                </div>
                
                <div className="flex-1 overflow-hidden flex bg-gray-100 p-4 gap-4">
                    {/* Column 1: Active/Working */}
                    <div className="flex-1 bg-white rounded-lg shadow border flex flex-col">
                        <div className="p-3 border-b bg-blue-50 font-bold text-blue-800 flex justify-between">
                            <span>Sedang Mengerjakan</span>
                            <span className="bg-blue-200 px-2 rounded-full text-xs flex items-center">{allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'ACTIVE').length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                             {allStudents.map(student => {
                                const {status, data} = getStudentStatus(student, liveMonitorExam.id);
                                if (status !== 'ACTIVE') return null;
                                const session = data as ExamSession;
                                return (
                                    <div key={student.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors relative overflow-hidden">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold">{student.name}</div>
                                                <div className="text-xs text-gray-500">Mulai: {new Date(session.startedAt).toLocaleTimeString()}</div>
                                            </div>
                                            {session.violationCount > 0 && (
                                                <div className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded animate-pulse">
                                                    ⚠ {session.violationCount} Pelanggaran
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Online
                                        </div>
                                    </div>
                                );
                             })}
                             {allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'ACTIVE').length === 0 && (
                                 <div className="text-center text-gray-400 text-sm mt-10">Tidak ada mahasiswa aktif</div>
                             )}
                        </div>
                    </div>

                     {/* Column 2: Submitted */}
                     <div className="flex-1 bg-white rounded-lg shadow border flex flex-col">
                        <div className="p-3 border-b bg-green-50 font-bold text-green-800 flex justify-between">
                            <span>Sudah Mengumpulkan</span>
                            <span className="bg-green-200 px-2 rounded-full text-xs flex items-center">{allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'SUBMITTED').length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                             {allStudents.map(student => {
                                const {status, data} = getStudentStatus(student, liveMonitorExam.id);
                                if (status !== 'SUBMITTED') return null;
                                const sub = data as Submission;
                                return (
                                    <div key={student.id} className="p-3 border rounded-lg bg-green-50/30 border-green-100">
                                        <div className="flex justify-between items-center">
                                            <div className="font-bold text-gray-800">{student.name}</div>
                                            <div className="font-bold text-green-600">{sub.totalScore}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">Submit: {new Date(sub.submittedAt).toLocaleTimeString()}</div>
                                        {sub.violationCount ? <div className="text-xs text-red-600 font-bold mt-1">Total Pelanggaran: {sub.violationCount}</div> : null}
                                    </div>
                                );
                             })}
                        </div>
                    </div>

                     {/* Column 3: Not Started */}
                     <div className="flex-1 bg-white rounded-lg shadow border flex flex-col">
                        <div className="p-3 border-b bg-gray-50 font-bold text-gray-600 flex justify-between">
                            <span>Belum Masuk</span>
                            <span className="bg-gray-200 px-2 rounded-full text-xs flex items-center">{allStudents.filter(s => getStudentStatus(s, liveMonitorExam.id).status === 'NOT_STARTED').length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                             {allStudents.map(student => {
                                const {status} = getStudentStatus(student, liveMonitorExam.id);
                                if (status !== 'NOT_STARTED') return null;
                                return (
                                    <div key={student.id} className="p-3 border rounded-lg opacity-60">
                                        <div className="font-medium text-gray-700">{student.name}</div>
                                        <div className="text-xs text-gray-400">{student.email}</div>
                                    </div>
                                );
                             })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};