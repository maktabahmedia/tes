import { GoogleGenAI } from "@google/genai";
import { ProjectConfig } from "../types";
import { API_KEY } from "../apiKey";

const SYSTEM_INSTRUCTION_BASE = `
Anda adalah seorang ahli DevOps Firebase yang berpengalaman. Tujuan Anda adalah membantu developer men-deploy aplikasi web mereka ke Firebase Hosting.
Anda tertanam dalam alat bernama "DoozeHost Assistant".

Instruksi Bahasa:
- ANDA WAJIB MENJAWAB DALAM BAHASA INDONESIA.
- Gunakan bahasa yang sopan, teknis namun mudah dimengerti.
- Jika ada istilah teknis umum (seperti deploy, build, commit), boleh tetap menggunakan istilah Inggris atau padanannya yang umum di kalangan developer Indonesia.

Konteks Penting (Browser Limitation):
- Jika user bertanya "Apakah bisa hosting langsung di sini?", "Kenapa ribet?", atau "Deploy button mana?":
  Jelaskan bahwa Browser (Chrome/Firefox) memiliki "Security Sandbox". Website TIDAK BISA mengakses Terminal/CMD user secara langsung demi keamanan.
  Solusinya adalah "Auto-Deploy Script" yang sudah kita sediakan. Script itu adalah jembatan antara kode mereka dan Firebase.

Konteks Keamanan (Sangat Penting):
- Jika pengguna bertanya tentang file .env atau API Keys, peringatkan mereka dengan KERAS agar JANGAN PERNAH mengupload file .env ke GitHub publik.
- Alat ini secara otomatis mengabaikan file .env demi keamanan, jadi jika mereka bertanya kenapa .env tidak terupload, jelaskan itu fitur keamanan.

Konteks Khusus Google AI Studio:
- Jika pengguna menggunakan kode dari Google AI Studio, ingatkan mereka bahwa mereka harus MENG-EKSTRAK file ZIP terlebih dahulu.
- Ingatkan mereka untuk menjalankan 'npm install' sebelum mencoba build, karena folder node_modules biasanya tidak disertakan dalam download.

Konteks Proyek Saat Ini:
Pengguna sedang mengonfigurasi proyek dengan pengaturan berikut:
`;

export const getGeminiResponse = async (
  prompt: string,
  config: ProjectConfig,
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    const key = API_KEY || process.env.API_KEY;
    if (!key) {
      return "Error: API Key tidak ditemukan. Mohon periksa konfigurasi environment Anda atau file apiKey.ts.";
    }

    const ai = new GoogleGenAI({ apiKey: key });
    
    // Construct a dynamic system instruction based on current user config
    const contextString = `
    - Framework/Source: ${config.framework}
    - Project ID: ${config.projectId || '(Belum diatur)'}
    - Public Directory (Folder Build): ${config.publicDir}
    - Single Page App (Rewrites): ${config.isSpa ? 'Ya' : 'Tidak'}
    `;

    const systemInstruction = SYSTEM_INSTRUCTION_BASE + contextString;

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: systemInstruction,
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    const result = await chat.sendMessage({ message: prompt });
    return result.text || "Saya tidak dapat menghasilkan respons.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Saya mengalami kesalahan saat berkomunikasi dengan AI. Silakan coba lagi.";
  }
};

/**
 * Interface hasil analisis struktur proyek
 */
export interface ProjectAnalysis {
    framework: string;
    publicDir: string;
    isSpa: boolean;
    buildCommand: string;
    confidence: 'High' | 'Medium' | 'Low';
    isReady: boolean;
    verificationMessage: string;
    reason: string;
}

/**
 * Menganalisis struktur file menggunakan AI untuk menentukan konfigurasi hosting.
 */
export const analyzeProjectStructure = async (
    fileList: string[],
    packageJson: string | null
): Promise<ProjectAnalysis | null> => {
    try {
        const key = API_KEY || process.env.API_KEY;
        if (!key) return null;

        const ai = new GoogleGenAI({ apiKey: key });

        const prompt = `
        Analisa struktur file proyek berikut dan konten package.json (jika ada) secara mendalam untuk menentukan konfigurasi build & deploy.
        
        File Structure (top 150 files):
        ${fileList.slice(0, 150).join('\n')}
        
        Package.json content:
        ${packageJson ? packageJson.substring(0, 3000) : 'Tidak ditemukan'}

        Tugas Anda:
        1. Identifikasi Framework (Pilih SATU ID: 'Vite', 'CRA', 'NextJS', 'Angular', 'GoogleAI', 'Manual').
        2. Tentukan 'publicDir' (folder output build).
           - Analisa script "build" di package.json.
           - Default: Vite='dist', CRA='build', Next='out'.
        3. Tentukan 'isSpa'. True jika client-side routing, False jika static.
        4. Cari 'buildCommand'. Ambil dari package.json scripts['build'].
        5. Tentukan 'isReady' (Boolean).
           - TRUE jika: Ada script "build" DAN ada index.html (di root/public/src).
           - TRUE jika: Tidak ada build script TAPI ada index.html di root (Static HTML).
           - FALSE jika: Tidak ada index.html sama sekali atau package.json tanpa build script untuk framework modern.

        Output WAJIB JSON murni:
        {
            "framework": "ID_FRAMEWORK",
            "publicDir": "nama_folder",
            "isSpa": true/false,
            "buildCommand": "npm run build",
            "confidence": "High/Medium/Low",
            "isReady": true/false,
            "verificationMessage": "Kalimat singkat (ex: 'Siap Deploy: Build script ditemukan dan struktur Vite valid')",
            "reason": "Penjelasan teknis singkat"
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);

    } catch (error) {
        console.error("AI Analysis Error:", error);
        return null;
    }
};