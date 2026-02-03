import { GoogleGenAI, Type } from "@google/genai";
import { GradingResult, Question, QuestionType } from "../types";

// Follow strict guidelines: use process.env.API_KEY
// Assumes process.env.API_KEY is available in the execution context
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean JSON response from potential Markdown formatting
const cleanJSON = (text: string) => {
  if (!text) return "";
  return text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
};

// Robust JSON parser to handle common LLM formatting errors
const parseJSONSafely = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("JSON Parse Error, attempting auto-fix:", e);
    let fixed = text.replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");
    fixed = fixed.replace(/\\(?![/u"bfnrt\\])/g, "\\\\");
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      console.error("Failed to parse JSON even after fixes.", text.substring(0, 200));
      throw e; 
    }
  }
};

export interface AIImportConfig {
  mode: 'EXTRACT' | 'GENERATE';
  mcCount?: number;
  essayCount?: number;
}

export const AIService = {
  gradeEssay: async (
    questionText: string,
    referenceAnswer: string,
    studentAnswer: string,
    maxPoints: number
  ): Promise<GradingResult> => {
    try {
      // Handle empty/missing reference answer gracefully
      const refContext = referenceAnswer && referenceAnswer.length > 3 
        ? `Reference Answer to compare against: "${referenceAnswer}"`
        : `No specific reference answer provided. Grade based on general biomedical science accuracy for the question.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          You are a strict but fair Biomedical Science professor at Universitas Karya Husada Semarang.
          Your task is to grade a student's essay answer.
          
          Context:
          - Question: "${questionText}"
          - ${refContext}
          - Student Answer: "${studentAnswer}"
          - Max Points: ${maxPoints}
          
          Grading Criteria:
          1. Accuracy: Does the answer address the core question correctly?
          2. Completeness: Are all parts of the question answered?
          3. Relevance: Is the answer relevant to Biomedical Science context?
          
          Output Requirements:
          - Score: An integer between 0 and ${maxPoints}. Award partial points for partially correct answers.
          - Feedback: Constructive feedback in Indonesian. Explain why points were deducted (if any) and how to improve.
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "The score awarded, integer between 0 and " + maxPoints },
              feedback: { type: Type.STRING, description: "Constructive feedback in Indonesian" },
            },
            required: ["score", "feedback"],
          },
        },
      });

      const text = cleanJSON(response.text || "{}");
      const result = parseJSONSafely(text);
      return {
        score: result.score || 0,
        feedback: result.feedback || "Tidak ada feedback.",
      };
    } catch (error) {
      console.error("AI Grading Error:", error);
      return {
        score: 0,
        feedback: "Gagal menilai secara otomatis. Pastikan API Key valid atau kuota mencukupi.",
      };
    }
  },

  generateQuestionsFromDocument: async (
    files: { data: string; mimeType: string }[],
    config: AIImportConfig
  ): Promise<Question[]> => {
    try {
      // Create parts for all uploaded files
      const fileParts = files.map(file => ({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType,
        },
      }));

      let promptText = "";

      if (config.mode === 'EXTRACT') {
          // MODE 1: EXTRACT (Existing Logic)
          promptText = `
              Analyze the attached document(s) which contain existing exam questions (Question Bank).
              EXTRACT ALL QUESTIONS found in the documents exactly as they appear. 
              
              If the document contains answers, map them to 'correctOptionIndex' or 'referenceAnswer'.
              If no answers are marked in the document, try to solve them yourself.
          `;
      } else {
          // MODE 2: GENERATE FROM MATERIAL
          const mcCount = config.mcCount || 0;
          const essayCount = config.essayCount || 0;
          
          promptText = `
              Analyze the attached teaching material/module/textbook.
              ACT AS A PROFESSOR. Create NEW exam questions based on the key concepts in this material.
              
              REQUIREMENTS:
              - Generate exactly ${mcCount} Multiple Choice Questions.
              - Generate exactly ${essayCount} Essay/Description Questions.
              - Total Questions: ${mcCount + essayCount}.
              - Questions must be academic, challenging, and relevant to the material provided.
              - Language: Indonesian (Bahasa Indonesia).
          `;
      }

      // Common JSON formatting rules
      promptText += `
          IMPORTANT JSON FORMATTING RULES:
          1. Return purely the JSON array.
          2. Escape backslashes properly (e.g. \\alpha -> \\\\alpha).
          
          For Multiple Choice Questions:
          - Extract/Generate the question text.
          - Provide 4-5 options.
          - Determine the correct option index (0-based).
          - Set 'type' to '${QuestionType.MULTIPLE_CHOICE}'.
          
          For Essay/Description Questions:
          - Extract/Generate the question text.
          - Generate a brief "Reference Answer" based on the context.
          - Set 'type' to '${QuestionType.ESSAY}'.
          
          Assign a default point value of 10 for each question.
      `;

      const textPart = {
        text: promptText,
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: {
          parts: [...fileParts, textPart],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: [QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctOptionIndex: { type: Type.NUMBER },
                referenceAnswer: { type: Type.STRING },
                points: { type: Type.NUMBER },
              },
              required: ["text", "type", "points"],
            },
          },
        },
      });

      const text = cleanJSON(response.text || "[]");
      const rawQuestions = parseJSONSafely(text);
      
      // Post-process
      return rawQuestions.map((q: any, index: number) => ({
        ...q,
        id: Date.now().toString() + "-" + index,
        options: q.type === QuestionType.MULTIPLE_CHOICE ? (q.options || []) : undefined,
        referenceAnswer: q.type === QuestionType.ESSAY ? (q.referenceAnswer || "-") : undefined
      }));

    } catch (error) {
      console.error("AI Import Error:", error);
      throw new Error("Gagal memproses AI. Pastikan file terbaca jelas.");
    }
  },
};