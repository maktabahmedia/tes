import React, { useState, useEffect } from 'react';
import { ProjectConfig } from '../types';
import { Settings, Folder, Globe, ShieldCheck, Code2, Sparkles, AlertCircle, Package, CheckCircle, UploadCloud, File as FileIcon, Loader2, Info, Terminal, ScanSearch, Check, XCircle, AlertTriangle, FileJson, Download, Github, Key, GitBranch, Search, ArrowRight, Layers, ShieldAlert, Zap, GitCommit } from 'lucide-react';
import JSZip from 'jszip';
import { analyzeProjectStructure, ProjectAnalysis } from '../services/geminiService';

interface Props {
  config: ProjectConfig;
  setConfig: React.Dispatch<React.SetStateAction<ProjectConfig>>;
  onGenerate: () => void;
}

interface DetectedMetadata {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

interface GithubRepo {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    html_url: string;
}

const FRAMEWORKS = [
  { id: 'GoogleAI', name: 'Google AI / ZIP', dir: 'dist', spa: true, icon: Sparkles },
  { id: 'Vite', name: 'Vite', dir: 'dist', spa: true, icon: Code2 },
  { id: 'CRA', name: 'Create React App', dir: 'build', spa: true, icon: Code2 },
  { id: 'NextJS', name: 'Next.js (Static)', dir: 'out', spa: false, icon: Code2 },
  { id: 'Angular', name: 'Angular', dir: 'dist/app', spa: true, icon: Code2 },
  { id: 'Manual', name: 'Manual / Custom', dir: '', spa: true, icon: Settings },
];

// Updated Ignore Patterns: We allow build folders now, but strict on system files/security
const IGNORED_PATTERNS = [
    'node_modules', 
    '.git', 
    '.ds_store', 
    '__macosx',
    '.env',          
    '.env.local',    
    '.env.production',
    'coverage',
    'npm-debug.log',
    'yarn-debug.log',
    'yarn-error.log',
    '.idea',
    '.vscode'
];

const ConfigurationForm: React.FC<Props> = ({ config, setConfig, onGenerate }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [isGeneratingConfig, setIsGeneratingConfig] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  
  // GitHub Integration State - Initialize from LocalStorage
  const [githubMode, setGithubMode] = useState<'download' | 'direct'>('download');
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('dooze_gh_token') || '');
  const [ghRepos, setGhRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [commitMessage, setCommitMessage] = useState('chore: upload project files via DoozeHost');
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pushLog, setPushLog] = useState<string>('');
  const [pushProgress, setPushProgress] = useState<{current: number, total: number} | null>(null);
  const [lastErrorDetail, setLastErrorDetail] = useState<string>('');
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);

  const [analysisReport, setAnalysisReport] = useState<{
      metadata: DetectedMetadata | null;
      aiAnalysis: ProjectAnalysis | null;
      items: string[]; 
  } | null>(null);

  // Effect to save Token to LocalStorage whenever it changes
  useEffect(() => {
    if (ghToken) {
        localStorage.setItem('dooze_gh_token', ghToken);
    } else {
        localStorage.removeItem('dooze_gh_token');
    }
  }, [ghToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFrameworkSelect = (fw: typeof FRAMEWORKS[0]) => {
    setConfig(prev => ({
      ...prev,
      framework: fw.id,
      publicDir: fw.dir || prev.publicDir,
      isSpa: fw.id === 'Manual' ? prev.isSpa : fw.spa,
    }));
  };

  const detectFrameworkFallback = (json: any, isFromZip: boolean) => {
    const deps = { ...json.dependencies, ...json.devDependencies };
    let detectedFw = null;

    if (deps['vite']) detectedFw = isFromZip ? FRAMEWORKS.find(f => f.id === 'GoogleAI') : FRAMEWORKS.find(f => f.id === 'Vite');
    else if (deps['react-scripts']) detectedFw = FRAMEWORKS.find(f => f.id === 'CRA');
    else if (deps['next']) detectedFw = FRAMEWORKS.find(f => f.id === 'NextJS');
    else if (deps['@angular/core']) detectedFw = FRAMEWORKS.find(f => f.id === 'Angular');
    
    if (!detectedFw && isFromZip) detectedFw = FRAMEWORKS.find(f => f.id === 'GoogleAI');
    return detectedFw;
  };

  const isFileIgnored = (path: string) => {
      const lowerPath = path.toLowerCase();
      return IGNORED_PATTERNS.some(pattern => {
          return lowerPath.includes(`/${pattern}/`) || lowerPath.startsWith(`${pattern}/`) || lowerPath === pattern || lowerPath.endsWith(`/${pattern}`);
      });
  };

  const extractStructureFromZip = (zip: JSZip): string[] => {
    const allPaths = Object.keys(zip.files).filter(path => {
        if (path.includes('/.')) return false; 
        return !isFileIgnored(path);
    });
    return allPaths.sort();
  };

  const processFile = async (file: File) => {
    setDragError(null);
    setAnalysisReport(null);
    setIsProcessing(true);
    setIsAiAnalyzing(false);
    setSourceFile(null);

    try {
      if (file.type === "application/json" || file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        const detectedFw = detectFrameworkFallback(json, false);
        
        if (detectedFw) {
            handleFrameworkSelect(detectedFw);
            if (json.name) {
                const cleanName = json.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                if (cleanName && cleanName !== 'vite-project' && cleanName !== 'my-app') {
                   setConfig(prev => ({ ...prev, projectId: cleanName }));
                }
            }
            setAnalysisReport({
                metadata: { name: json.name, version: json.version, scripts: json.scripts, dependencies: json.dependencies, devDependencies: json.devDependencies },
                aiAnalysis: null,
                items: [`Framework: ${detectedFw.name}`, `Project Name: ${json.name || '-'}`]
            });
        } else {
            setDragError("Framework tidak dikenali.");
        }
      } 
      else if (file.type === "application/zip" || file.type === "application/x-zip-compressed" || file.name.endsWith('.zip')) {
        setSourceFile(file);
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        
        // Helper to find file content, supporting wrapped root folders
        const findFileContent = async (filename: string) => {
            let fileObj = loadedZip.file(filename);
            if (fileObj) return await fileObj.async("string");
            
            // Try to find in one level deep root folder
            const rootFiles = Object.keys(loadedZip.files).filter(p => {
                const parts = p.split('/');
                return parts.length === 2 && parts[1] === filename && !isFileIgnored(parts[0]);
            });
            
            if (rootFiles.length > 0) return await loadedZip.file(rootFiles[0])?.async("string");
            return null;
        };

        const structure = extractStructureFromZip(loadedZip);
        const packageContent = await findFileContent("package.json");
        
        let newConfig: Partial<ProjectConfig> = { structure };
        let detectedFwFallback = null;
        let metadata: DetectedMetadata | null = null;

        if (packageContent) {
           const json = JSON.parse(packageContent);
           metadata = { name: json.name, version: json.version, scripts: json.scripts, dependencies: json.dependencies, devDependencies: json.devDependencies };
           if (json.name) newConfig.projectId = json.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
           detectedFwFallback = detectFrameworkFallback(json, true);
        } else {
           detectedFwFallback = FRAMEWORKS.find(f => f.id === 'GoogleAI');
        }

        if (detectedFwFallback) {
             newConfig.framework = detectedFwFallback.id;
             newConfig.publicDir = detectedFwFallback.dir;
             newConfig.isSpa = detectedFwFallback.spa;
        }

        setConfig(prev => ({ ...prev, ...newConfig }));
        
        setIsAiAnalyzing(true);
        const aiAnalysis = await analyzeProjectStructure(structure, packageContent);
        
        let finalConfig = { ...newConfig };
        
        if (aiAnalysis) {
             finalConfig.framework = aiAnalysis.framework;
             finalConfig.publicDir = aiAnalysis.publicDir;
             finalConfig.isSpa = aiAnalysis.isSpa;
        }

        setConfig(prev => ({ ...prev, ...finalConfig }));
        setAnalysisReport({
            metadata: metadata,
            aiAnalysis: aiAnalysis,
            items: [`Total files: ${structure.length}`]
        });
        setIsAiAnalyzing(false);

      } else {
        setDragError("Upload package.json atau ZIP.");
      }
    } catch (err) {
      console.error(err);
      setDragError("Gagal membaca file.");
    } finally {
      setIsProcessing(false);
      setIsAiAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  // --- Github API Helpers (Git Database API) ---

  const handleFetchRepos = async () => {
    if (!ghToken) return;
    setIsFetchingRepos(true);
    try {
        const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
            headers: { Authorization: `token ${ghToken}` }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || "Gagal login. Cek token Anda.");
        }
        const data = await response.json();
        setGhRepos(data);
    } catch (error: any) {
        alert("Gagal mengambil repo: " + error.message);
    } finally {
        setIsFetchingRepos(false);
    }
  };

  const blob_to_b64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
  };

  const githubRequest = async (endpoint: string, method: string, body?: any) => {
      const res = await fetch(`https://api.github.com/repos/${selectedRepo!.full_name}${endpoint}`, {
          method,
          headers: {
              'Authorization': `token ${ghToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json'
          },
          body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`GitHub API Error (${res.status}): ${text}`);
      }
      return res.json();
  };

  const handleGithubPush = async () => {
    if (!selectedRepo || !ghToken) return;
    setIsPushing(true);
    setPushStatus('idle');
    setPushProgress(null);
    setPushLog('Menginisialisasi...');
    setLastErrorDetail('');
    setSkippedFiles([]);

    try {
        const projectIdClean = config.projectId ? config.projectId.toUpperCase().replace(/[^A-Z0-9_]/g, '_') : 'MY_PROJECT';
        const secretName = `FIREBASE_SERVICE_ACCOUNT_${projectIdClean}`;
        
        // 1. Check if repo is empty or get HEAD ref
        let baseTreeSha = null;
        let parentCommitSha = null;
        const defaultBranch = selectedRepo.default_branch || 'main';

        try {
             setPushLog('Mengecek status repository...');
             const refData = await githubRequest(`/git/ref/heads/${defaultBranch}`, 'GET');
             parentCommitSha = refData.object.sha;
             const commitData = await githubRequest(`/git/commits/${parentCommitSha}`, 'GET');
             baseTreeSha = commitData.tree.sha;
        } catch (e) {
             // Repo might be empty. Create initial commit to establish HEAD.
             setPushLog('Repository kosong. Membuat inisialisasi...');
             try {
                await githubRequest(`/contents/README.md`, 'PUT', {
                    message: "Initial commit by DoozeHost",
                    content: btoa("# My DoozeHost Project\nDeployed via DoozeHost Assistant")
                });
                // Re-fetch refs after init
                const refData = await githubRequest(`/git/ref/heads/${defaultBranch}`, 'GET');
                parentCommitSha = refData.object.sha;
                const commitData = await githubRequest(`/git/commits/${parentCommitSha}`, 'GET');
                baseTreeSha = commitData.tree.sha;
             } catch (initErr: any) {
                throw new Error("Gagal menginisialisasi repo kosong: " + initErr.message);
             }
        }

        // 2. Prepare Config Files in Memory
        const filesToUpload: { path: string, content: string, mode: string, type: string }[] = [];
        const addedPaths = new Set<string>();
        
        const addConfig = (path: string, content: string) => {
            filesToUpload.push({ path, content, mode: '100644', type: 'blob' });
            addedPaths.add(path);
        };

        // --- CORE FIREBASE FILES ---
        
        // 1. firebase.json
        addConfig('firebase.json', JSON.stringify({
            hosting: {
                public: config.publicDir,
                ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
                rewrites: config.isSpa ? [{ source: "**", destination: "/index.html" }] : []
            }
        }, null, 2));

        // 2. .firebaserc
        if (config.projectId) {
            addConfig('.firebaserc', JSON.stringify({ projects: { default: config.projectId } }, null, 2));
        }

        // 3. .gitignore (CRITICAL for clean hosting repo)
        const gitIgnoreContent = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Dependencies
node_modules/

# Build outputs
${config.publicDir}/
dist/
build/
out/

# Firebase cache
.firebase/
firebase-debug.log

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
.DS_Store
`;
        addConfig('.gitignore', gitIgnoreContent);

        // Only add Workflow if GitHub Action is ENABLED
        if (config.githubAction) {
            addConfig('.github/workflows/firebase-hosting-merge.yml', `name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - ${defaultBranch}
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '\${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '\${{ secrets.${secretName} }}'
          channelId: live
          projectId: ${config.projectId || 'my-project-id'}
`);
        }

        // 3. Process ZIP Files (if available)
        if (sourceFile) {
            setPushLog('Mengekstrak dan memproses file ZIP...');
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(sourceFile);
            const paths = Object.keys(loadedZip.files);
            
            // Check for package.json to decide organization strategy
            // If package.json exists, we assume it's a Source Project (keep structure).
            // If NO package.json, we assume it's Static Assets (move to publicDir).
            const hasPackageJson = paths.some(p => p.endsWith('package.json') && !p.includes('node_modules') && !p.includes('__MACOSX'));
            
            if (hasPackageJson) {
                setPushLog('Mode Proyek Node.js terdeteksi (package.json). Struktur folder dipertahankan.');
            } else {
                setPushLog(`Mode Static HTML terdeteksi. Memindahkan file ke folder '${config.publicDir}'...`);
            }

            // Smart Root Directory Detection
            // Ignore system folders like __MACOSX when determining if there is a wrapper folder
            const visiblePaths = paths.filter(p => !p.startsWith('__MACOSX') && !p.includes('/.DS_Store'));
            const possibleRoots = new Set(visiblePaths.map(p => p.split('/')[0]));
            
            let rootDir = '';
            // If there is exactly one top-level folder that contains everything else (ignoring system files)
            if (possibleRoots.size === 1) {
                const singleRoot = Array.from(possibleRoots)[0];
                if (visiblePaths.every(p => p.startsWith(singleRoot + '/'))) {
                    rootDir = singleRoot + '/';
                }
            }
            
            const skipped: string[] = [];

            const processZipFile = async (relativePath: string, file: JSZip.JSZipObject) => {
                if (file.dir) return;
                
                // Skip Mac System Files
                if (relativePath.includes('__MACOSX') || relativePath.includes('.DS_Store')) return;

                // Flatten directory structure if rootDir exists
                let finalPath = rootDir && relativePath.startsWith(rootDir) 
                    ? relativePath.substring(rootDir.length) 
                    : relativePath;
                
                if (!finalPath) return;

                if (addedPaths.has(finalPath)) {
                    skipped.push(`${finalPath} (Menggunakan config yang di-generate)`);
                    return; 
                }

                if (isFileIgnored(finalPath)) {
                    if (!finalPath.includes('node_modules') && !finalPath.startsWith('.git')) {
                        // Silent skip for common ignores, log others
                    }
                    return;
                }

                // --- NEW LOGIC START ---
                // Smart Organization:
                // If it's a static site (no package.json), move web assets into the build folder
                // unless they are already there.
                if (!hasPackageJson) {
                    // Don't move dotfiles or config files typically found in root
                    const isConfigFile = finalPath.startsWith('.') || finalPath === 'firebase.json' || finalPath.toLowerCase().includes('readme');
                    
                    if (!isConfigFile && !finalPath.startsWith(`${config.publicDir}/`)) {
                        finalPath = `${config.publicDir}/${finalPath}`;
                    }
                }
                // --- NEW LOGIC END ---

                const blob = await file.async('blob');
                if (blob.size > 25 * 1024 * 1024) { // GitHub API Limit warning (safe limit)
                     skipped.push(`${finalPath} (>25MB - Melewati batas API)`);
                     return;
                }

                const b64 = await blob_to_b64(blob);
                filesToUpload.push({ path: finalPath, content: b64, mode: '100644', type: 'blob' });
                addedPaths.add(finalPath);
            };

            await Promise.all(paths.map(p => processZipFile(p, loadedZip.files[p])));
            setSkippedFiles(skipped);
        }

        // 3.5. BUILD FOLDER STRUCTURE CREATION & PLACEHOLDER INDEX.HTML
        // Check if the configured publicDir (e.g., 'dist') exists in the files we are about to upload.
        // If not, we create a placeholder so the folder structure exists in GitHub and hosting works immediately.
        const hasBuildFolder = filesToUpload.some(f => f.path.startsWith(`${config.publicDir}/`));
        
        if (!hasBuildFolder) {
            setPushLog(`Membuat placeholder file di folder build: ${config.publicDir}...`);
            const placeholderContent = `# Build Output Directory: ${config.publicDir}

This directory is reserved for build artifacts (HTML/CSS/JS).
This file will be replaced automatically by your build script (npm run build).

*Generated by DoozeHost Assistant*`;

            filesToUpload.push({
                path: `${config.publicDir}/README.md`,
                content: btoa(placeholderContent), 
                mode: '100644', 
                type: 'blob'
            });
            addedPaths.add(`${config.publicDir}/README.md`);

            // Generate Professional Placeholder Index HTML
            const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DoozeHost Deployment</title>
    <style>
        body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #0F172A; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .container { padding: 2rem; max-width: 600px; animation: fadeUp 1s ease-out; }
        .icon { width: 80px; height: 80px; background: linear-gradient(135deg, #FFCA28, #F57C00); border-radius: 20px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(245, 124, 0, 0.3); }
        .icon svg { width: 40px; height: 40px; fill: white; }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        p { color: #94A3B8; font-size: 1.1rem; line-height: 1.6; margin-bottom: 2rem; }
        .status { display: inline-block; padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50px; font-size: 0.9rem; color: #60A5FA; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <svg viewBox="0 0 24 24"><path d="M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z"/></svg>
        </div>
        <h1>Deployment Ready!</h1>
        <p>Your Firebase Hosting configuration is successful. This is a placeholder page because the actual build process hasn't overwritten it yet.</p>
        <div class="status">Waiting for Build Output (npm run build)...</div>
    </div>
</body>
</html>`;

            filesToUpload.push({
                path: `${config.publicDir}/index.html`,
                content: btoa(placeholderHtml),
                mode: '100644',
                type: 'blob'
            });
            addedPaths.add(`${config.publicDir}/index.html`);
        }

        // 4. Batch Create Blobs
        setPushLog(`Mengupload ${filesToUpload.length} file blobs...`);
        const treeItems: any[] = [];
        const CHUNK_SIZE = 5; // Parallel uploads
        
        for (let i = 0; i < filesToUpload.length; i += CHUNK_SIZE) {
            const chunk = filesToUpload.slice(i, i + CHUNK_SIZE);
            setPushProgress({ current: i, total: filesToUpload.length });
            
            await Promise.all(chunk.map(async (file) => {
                // Create Blob API
                const blobRes = await githubRequest('/git/blobs', 'POST', {
                    content: file.content,
                    encoding: 'base64'
                });
                treeItems.push({
                    path: file.path,
                    mode: file.mode,
                    type: 'blob',
                    sha: blobRes.sha
                });
            }));
        }

        // 5. Create Tree
        setPushLog('Membuat Git Tree...');
        const treeRes = await githubRequest('/git/trees', 'POST', {
            base_tree: baseTreeSha,
            tree: treeItems
        });

        // 6. Create Commit
        setPushLog('Membuat Commit...');
        const commitRes = await githubRequest('/git/commits', 'POST', {
            message: `${commitMessage}\n\nUploaded ${filesToUpload.length} files.${config.githubAction ? '\nIncludes Firebase Hosting Workflow.' : ''}`,
            tree: treeRes.sha,
            parents: [parentCommitSha]
        });

        // 7. Update Reference
        setPushLog('Updating Ref (Pushing)...');
        await githubRequest(`/git/refs/heads/${defaultBranch}`, 'PATCH', {
            sha: commitRes.sha,
            force: false
        });

        setPushStatus('success');
        setPushLog(`Berhasil! ${filesToUpload.length} file telah di-push dalam 1 commit.`);
        setPushProgress(null);

    } catch (error: any) {
        setPushStatus('error');
        console.error(error);
        setPushLog(`Error: ${error.message.substring(0, 100)}...`);
        try {
             // Try to parse detailed error from message if it's JSON
             const match = error.message.match(/(\{.*\})/);
             if (match) setLastErrorDetail(JSON.stringify(JSON.parse(match[1]), null, 2));
             else setLastErrorDetail(error.message);
        } catch {
             setLastErrorDetail(error.message);
        }
    } finally {
        setIsPushing(false);
    }
  };

  const downloadConfigBundle = async () => {
      setIsGeneratingConfig(true);
      try {
          const zip = new JSZip();

          const firebaseJsonContent = {
              hosting: {
                  public: config.publicDir,
                  ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
                  rewrites: config.isSpa ? [{ source: "**", destination: "/index.html" }] : []
              }
          };
          zip.file("firebase.json", JSON.stringify(firebaseJsonContent, null, 2));

          if (config.projectId) {
              zip.file(".firebaserc", JSON.stringify({ projects: { default: config.projectId } }, null, 2));
          }

          if (config.githubAction) {
              const projectIdClean = config.projectId ? config.projectId.toUpperCase().replace(/[^A-Z0-9_]/g, '_') : 'MY_PROJECT';
              const secretName = `FIREBASE_SERVICE_ACCOUNT_${projectIdClean}`;
              
              const workflowContent = `name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - main
      - master
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '\${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '\${{ secrets.${secretName} }}'
          channelId: live
          projectId: ${config.projectId || 'my-project-id'}
`;
              zip.file(".github/workflows/firebase-hosting-merge.yml", workflowContent);
              zip.file("GITHUB_SETUP_GUIDE.md", `# Panduan Setup\n\nBuat repository secret bernama: ${secretName}`);
          }

          const winScript = `@echo off\n\necho [DoozeHost] Starting Deployment...\nwhere npm >nul 2>nul\nif %errorlevel% neq 0 ( echo Error: Node.js required. & pause & exit /b )\n\necho 1. Installing dependencies...\ncall npm install\n\necho 2. Building project...\ncall npm run build\n\necho 3. Deploying to Firebase...\ncall firebase deploy --only hosting${config.projectId ? ` --project ${config.projectId}` : ''}\n\necho Done!\npause`;
          const unixScript = `#!/bin/bash\necho "[DoozeHost] Starting Deployment..."\nnpm install\nnpm run build\nfirebase deploy --only hosting${config.projectId ? ` --project ${config.projectId}` : ''}\necho "Done!"`;
          zip.file("deploy_windows.bat", winScript);
          zip.file("deploy_mac_linux.sh", unixScript);

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const link = document.createElement("a");
          link.href = url;
          link.download = `firebase_config_${config.projectId || 'bundle'}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (e) {
          console.error("Failed to zip", e);
      } finally {
          setIsGeneratingConfig(false);
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto glass-card rounded-2xl p-6 md:p-8 shadow-2xl animate-float max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Setup Proyek</h2>
        <p className="text-slate-400">Tarik <code className="text-firebase-yellow bg-firebase-yellow/10 px-1 rounded">package.json</code> atau <code className="text-blue-400 bg-blue-500/10 px-1 rounded">.zip</code> ke sini untuk auto-config.</p>
      </div>

      <div className="space-y-6">
        
        {/* Modern Drop Zone */}
        <div 
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 text-center cursor-pointer group overflow-hidden ${
            isDragging 
              ? 'border-firebase-blue bg-firebase-blue/10 scale-[1.02] shadow-lg shadow-blue-500/20' 
              : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            accept=".json,.zip,application/json,application/zip,application/x-zip-compressed" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
          />
          
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

          <div className="flex flex-col items-center pointer-events-none relative z-10">
            <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${
              isDragging 
                ? 'bg-firebase-blue text-white shadow-[0_0_20px_rgba(3,155,229,0.5)]' 
                : isAiAnalyzing ? 'bg-purple-600/20 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                : isProcessing ? 'bg-slate-800 text-slate-400'
                : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white group-hover:scale-110'
            }`}>
              {dragError ? <AlertCircle className="w-8 h-8 text-red-400" /> : 
               isAiAnalyzing ? <Sparkles className="w-8 h-8 animate-spin" /> :
               isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : 
               <UploadCloud className="w-8 h-8" />}
            </div>
            
            {dragError ? (
               <p className="text-red-400 text-sm font-semibold">{dragError}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-base font-medium text-slate-200 group-hover:text-white transition-colors">
                  {isAiAnalyzing ? 'AI sedang verifikasi kelayakan hosting...' : isProcessing ? 'Membaca file...' : sourceFile ? 'File proyek siap diunggah' : 'Drop file di sini'}
                </p>
                <p className="text-xs text-slate-500 group-hover:text-slate-400">
                  {sourceFile ? sourceFile.name : 'Support .zip dan package.json'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* HOSTING READINESS REPORT */}
        {analysisReport && (
            <div className={`rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 border shadow-xl ${
                isAiAnalyzing ? 'border-purple-500/30 bg-purple-500/5' : 
                analysisReport.aiAnalysis?.isReady ? 'border-emerald-500/30 bg-emerald-500/5 shadow-emerald-500/10' :
                'border-slate-700 bg-slate-900/50'
            }`}>
                
                {/* Header Card Status */}
                <div className={`px-5 py-4 border-b flex items-center justify-between ${
                    isAiAnalyzing ? 'border-purple-500/30 bg-purple-500/10' : 
                    analysisReport.aiAnalysis?.isReady ? 'border-emerald-500/20 bg-emerald-500/10' :
                    'border-slate-700 bg-slate-800/50'
                }`}>
                    <div className="flex items-center">
                        {isAiAnalyzing ? <Sparkles className="w-5 h-5 text-purple-400 mr-3 animate-pulse" /> : 
                         analysisReport.aiAnalysis?.isReady ? <CheckCircle className="w-5 h-5 text-emerald-400 mr-3" /> :
                         <AlertTriangle className="w-5 h-5 text-amber-400 mr-3" />
                        }
                        <div>
                             <h3 className={`font-bold text-sm tracking-wide uppercase ${isAiAnalyzing ? 'text-purple-200' : analysisReport.aiAnalysis?.isReady ? 'text-emerald-100' : 'text-slate-200'}`}>
                                {isAiAnalyzing ? 'AI sedang menganalisis...' : analysisReport.aiAnalysis?.isReady ? 'Verified: Ready to Host' : 'Configuration Needed'}
                            </h3>
                            {!isAiAnalyzing && analysisReport.aiAnalysis && (
                                <p className={`text-xs mt-0.5 ${analysisReport.aiAnalysis.isReady ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                                    {analysisReport.aiAnalysis.verificationMessage}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* LEFT: Metadata from File (The TRUTH) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <Package className="w-3 h-3 mr-2" /> Data Sumber
                            </h4>
                            {analysisReport.metadata ? <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">package.json</span> : <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded">Missing</span>}
                        </div>

                        {analysisReport.metadata ? (
                            <div className="space-y-3 font-mono text-xs">
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                                    <span className="text-slate-500">Project:</span>
                                    <span className="text-white">{analysisReport.metadata.name || 'unnamed'} <span className="text-slate-600">v{analysisReport.metadata.version || '0.0.0'}</span></span>
                                </div>
                                
                                <div className="space-y-1">
                                    <span className="text-slate-500 block">Scripts ({Object.keys(analysisReport.metadata.scripts || {}).length}):</span>
                                    <div className="bg-slate-950 p-2 rounded border border-slate-800 max-h-24 overflow-y-auto custom-scrollbar">
                                        {Object.entries(analysisReport.metadata.scripts || {}).map(([k, v]) => (
                                            <div key={k} className="flex mb-1 last:mb-0">
                                                <span className="text-blue-400 mr-2">{k}:</span>
                                                <span className="text-slate-400 truncate break-all">{v}</span>
                                            </div>
                                        ))}
                                        {Object.keys(analysisReport.metadata.scripts || {}).length === 0 && <span className="text-slate-600 italic">No scripts found</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                             <div className="p-4 bg-slate-900 rounded border border-slate-800 text-center text-xs text-slate-500 italic">
                                 Tidak ditemukan file konfigurasi npm. Proyek mungkin static HTML biasa.
                             </div>
                        )}
                    </div>

                    {/* RIGHT: AI Inference & Action */}
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <Sparkles className="w-3 h-3 mr-2 text-purple-400" /> Analisis AI
                            </h4>
                            {analysisReport.aiAnalysis && (
                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                                    analysisReport.aiAnalysis.confidence === 'High' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-yellow-900/30 text-yellow-400'
                                }`}>
                                    {analysisReport.aiAnalysis.confidence} Confidence
                                </span>
                            )}
                        </div>
                        
                        {analysisReport.aiAnalysis ? (
                            <div className="space-y-3 flex-1">
                                {/* Result Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase mb-1">Framework</div>
                                        <div className="text-sm font-bold text-white flex items-center">
                                            {analysisReport.aiAnalysis.framework}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                                        <div className="text-[10px] text-slate-500 uppercase mb-1">Public Dir</div>
                                        <div className="text-sm font-bold text-firebase-orange font-mono">
                                            /{analysisReport.aiAnalysis.publicDir}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start p-3 bg-blue-500/5 rounded border border-blue-500/10 mt-2">
                                   <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 shrink-0" />
                                   <p className="text-xs text-blue-200/80 leading-relaxed italic">
                                     "{analysisReport.aiAnalysis.reason}"
                                   </p>
                                </div>
                                
                                {/* NEW: Config Generator Button (Moved Logic to bottom block for unification) */}
                                <div className="mt-auto pt-4 border-t border-slate-800/50">
                                    <p className="text-[10px] text-slate-500 text-center">
                                        {sourceFile 
                                          ? "Source Code terdeteksi. Gunakan fitur Direct Connect untuk upload." 
                                          : "Gunakan tombol di bawah untuk lanjut ke setup GitHub / Download."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-lg p-6 bg-slate-900/20 text-center">
                                {isAiAnalyzing ? (
                                    <>
                                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
                                        <p className="text-sm text-white font-medium">Sedang Menganalisis...</p>
                                    </>
                                ) : (
                                    <span className="text-xs text-slate-600">Menunggu file untuk dianalisis...</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Framework Grid */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-bold text-slate-300 uppercase tracking-wider">
            <Code2 className="w-4 h-4 mr-2 text-purple-400" />
            Framework Override
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {FRAMEWORKS.map((fw) => {
              const Icon = fw.icon;
              const isSelected = config.framework === fw.id;
              return (
                <button
                  key={fw.id}
                  onClick={() => handleFrameworkSelect(fw)}
                  className={`relative p-3 rounded-xl text-sm font-medium border transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 group ${
                    isSelected
                      ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 transition-colors ${isSelected ? 'text-purple-300' : 'text-slate-500 group-hover:text-purple-400'}`} />
                  {fw.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-6 opacity-50"></div>

        {/* Inputs */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-slate-300 uppercase tracking-wider">
              <Settings className="w-4 h-4 mr-2 text-firebase-yellow" />
              Project ID
            </label>
            <input
              type="text"
              name="projectId"
              value={config.projectId}
              onChange={handleChange}
              placeholder="my-cool-app-123"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-firebase-yellow/50 focus:border-firebase-yellow text-white placeholder-slate-600 transition-all font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-slate-300 uppercase tracking-wider">
              <Folder className="w-4 h-4 mr-2 text-firebase-orange" />
              Build Folder
            </label>
            <input
              type="text"
              name="publicDir"
              value={config.publicDir}
              onChange={handleChange}
              placeholder="dist"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-firebase-orange/50 focus:border-firebase-orange text-white placeholder-slate-600 transition-all font-mono text-sm"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors group">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/10 rounded-lg mr-3 group-hover:bg-blue-500/20 transition-colors">
                 <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-slate-200">SPA Mode</span>
                <span className="block text-xs text-slate-500">Rewrite to index.html</span>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${config.isSpa ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${config.isSpa ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
            <input type="checkbox" name="isSpa" checked={config.isSpa} onChange={handleChange} className="hidden" />
          </label>

          <label className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors group">
             <div className="flex items-center">
               <div className="p-2 bg-green-500/10 rounded-lg mr-3 group-hover:bg-green-500/20 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
               </div>
               <div>
                 <span className="block text-sm font-semibold text-slate-200">GitHub Action</span>
                 <span className="block text-xs text-slate-500">Include .github workflows</span>
               </div>
             </div>
             <div className={`w-12 h-6 rounded-full p-1 transition-colors ${config.githubAction ? 'bg-green-600' : 'bg-slate-700'}`}>
               <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${config.githubAction ? 'translate-x-6' : 'translate-x-0'}`}></div>
             </div>
             <input type="checkbox" name="githubAction" checked={config.githubAction} onChange={handleChange} className="hidden" />
           </label>
        </div>

        {/* GitHub Integration UI */}
        {config.githubAction ? (
          <div className="mt-4 p-5 bg-slate-900/80 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
             {/* Tabs */}
             <div className="flex space-x-4 mb-6 border-b border-slate-800 pb-2">
                <button onClick={() => setGithubMode('download')} className={`text-sm font-bold pb-2 border-b-2 transition-colors ${githubMode === 'download' ? 'text-white border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                    Manual Download (ZIP)
                </button>
                <button onClick={() => setGithubMode('direct')} className={`text-sm font-bold pb-2 border-b-2 transition-colors ${githubMode === 'direct' ? 'text-white border-green-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                    Direct Connect (API)
                </button>
             </div>

             {githubMode === 'direct' ? (
                 <div className="space-y-5">
                    {/* Step 1: Token */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-slate-400 flex items-center">
                            <Key className="w-3 h-3 mr-1.5" /> GitHub Personal Access Token (Classic)
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="password" 
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={ghToken}
                                onChange={(e) => setGhToken(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                            />
                            <button 
                                onClick={handleFetchRepos}
                                disabled={isFetchingRepos || !ghToken}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                {isFetchingRepos ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Connect'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            Token disimpan secara lokal di browser Anda. Butuh scope: <code className="bg-slate-800 px-1 rounded text-slate-300">repo</code> atau <code className="bg-slate-800 px-1 rounded text-slate-300">public_repo</code>.
                        </p>
                    </div>

                    {/* Step 2: Repo Select */}
                    {ghRepos.length > 0 && (
                        <div className="space-y-2 animate-in fade-in">
                            <label className="text-xs uppercase font-bold text-slate-400 flex items-center">
                                <Search className="w-3 h-3 mr-1.5" /> Select Repository
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-800 rounded p-2 bg-slate-950">
                                {ghRepos.map(repo => (
                                    <button 
                                        key={repo.id}
                                        onClick={() => setSelectedRepo(repo)}
                                        className={`text-left px-3 py-2 rounded text-xs truncate transition-colors flex justify-between items-center ${selectedRepo?.id === repo.id ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'hover:bg-slate-800 text-slate-300'}`}
                                    >
                                        <span>{repo.full_name}</span>
                                        {selectedRepo?.id === repo.id && <Check className="w-3 h-3"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Action */}
                    {selectedRepo && (
                         <div className="bg-slate-950 p-4 rounded border border-slate-800 animate-in slide-in-from-bottom-2">
                             <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center text-sm font-bold text-white">
                                     <Github className="w-4 h-4 mr-2" />
                                     Push to: <span className="text-green-400 ml-1">{selectedRepo.full_name}</span>
                                 </div>
                                 <div className="flex items-center text-xs text-slate-500">
                                     <GitBranch className="w-3 h-3 mr-1" /> {selectedRepo.default_branch}
                                 </div>
                             </div>

                             {/* COMMIT MESSAGE INPUT */}
                             <div className="mb-4">
                                <label className="text-xs uppercase font-bold text-slate-400 flex items-center mb-1.5">
                                    <GitCommit className="w-3 h-3 mr-1.5" /> Commit Message
                                </label>
                                <input 
                                    type="text" 
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="chore: initial commit"
                                />
                             </div>

                             <div className="space-y-1 mb-4 text-xs text-slate-400 font-mono bg-slate-900 p-2 rounded max-h-32 overflow-y-auto custom-scrollbar">
                                 <div className="text-green-400 font-bold mb-1 border-b border-slate-800 pb-1">Config Files:</div>
                                 <div>+ firebase.json</div>
                                 <div>+ .firebaserc</div>
                                 <div>+ .gitignore (Node/Firebase)</div>
                                 <div>+ .github/workflows/firebase-hosting-merge.yml</div>
                                 
                                 {sourceFile && (
                                    <>
                                        <div className="text-blue-400 font-bold mt-2 mb-1 border-b border-slate-800 pb-1 flex items-center">
                                            <Layers className="w-3 h-3 mr-1" /> Project Files (from ZIP):
                                        </div>
                                        <div className="truncate opacity-70">Source: {sourceFile.name}</div>
                                        <div className="text-slate-500 italic">...and extracted contents</div>
                                        {skippedFiles.length > 0 && (
                                            <div className="mt-2 text-amber-500 text-[10px] italic border-t border-slate-800 pt-1">
                                                <div className="font-bold flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> Skipped (Security/Size):</div>
                                                {skippedFiles.slice(0, 5).map(f => <div key={f}>- {f}</div>)}
                                                {skippedFiles.length > 5 && <div>... and {skippedFiles.length - 5} more</div>}
                                            </div>
                                        )}
                                    </>
                                 )}
                             </div>

                             {pushStatus === 'success' ? (
                                 <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs text-center">
                                     <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                                     <span className="font-bold block mb-1">Berhasil Push {pushProgress?.total} file!</span>
                                     <span className="opacity-80">Menggunakan metode Git Tree API (1 Commit)</span>
                                     <a href={`https://github.com/${selectedRepo.full_name}/settings/secrets/actions`} target="_blank" className="block mt-2 underline text-white font-bold hover:text-green-300">
                                        Klik untuk Setup Secrets Sekarang &rarr;
                                     </a>
                                 </div>
                             ) : (
                                 <div className="space-y-2">
                                     <button 
                                        onClick={handleGithubPush}
                                        disabled={isPushing}
                                        className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg shadow-green-900/20 flex items-center justify-center transition-all disabled:opacity-50"
                                     >
                                         {isPushing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                                         {isPushing ? pushLog : 'Batch Push Files'}
                                     </button>
                                     {pushProgress && (
                                         <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                             <div 
                                                className="bg-green-500 h-full transition-all duration-300" 
                                                style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%`}}
                                             ></div>
                                         </div>
                                     )}
                                 </div>
                             )}
                             {pushStatus === 'error' && (
                                <div className="mt-2 text-center">
                                    <div className="text-red-400 text-xs font-mono bg-slate-900 p-2 rounded border border-red-500/20 mb-2">
                                        <div className="font-bold border-b border-red-500/10 mb-1 pb-1">Diagnosa Error:</div>
                                        {pushLog}
                                        {lastErrorDetail && (
                                            <div className="mt-2 pt-2 border-t border-slate-800">
                                                <div className="text-[10px] text-slate-500 italic mb-1">Detail dari GitHub:</div>
                                                <pre className="text-[10px] text-red-300/70 overflow-x-auto whitespace-pre-wrap break-all font-mono bg-black/20 p-1 rounded">
                                                    {lastErrorDetail}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                    {selectedRepo && (pushLog.includes('403') || pushLog.includes('Ditolak')) && (
                                        <div className="flex flex-col gap-1 items-center animate-in fade-in">
                                            <p className="text-[10px] text-slate-500">Akses ditolak? Cek pengaturan ini:</p>
                                            <div className="flex gap-3">
                                                <a 
                                                    href={`${selectedRepo.html_url}/settings/actions`} 
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] text-blue-400 hover:text-white underline decoration-dashed flex items-center"
                                                >
                                                    <Settings className="w-3 h-3 mr-1"/> Workflow Permissions
                                                </a>
                                                <a 
                                                    href={`${selectedRepo.html_url}/settings/branches`} 
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] text-blue-400 hover:text-white underline decoration-dashed flex items-center"
                                                >
                                                    <ShieldCheck className="w-3 h-3 mr-1"/> Branch Rules
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                             )}
                         </div>
                    )}
                 </div>
             ) : (
                 <div className="text-center py-4 px-4 bg-slate-900 rounded border border-slate-800 border-dashed">
                     <Download className="w-8 h-8 text-blue-500 mx-auto mb-2 opacity-80" />
                     <p className="text-sm text-slate-300 font-medium mb-1">Download Config Bundle</p>
                     <p className="text-xs text-slate-500 mb-4">Dapatkan file .zip berisi semua konfigurasi dan script.</p>
                     <button 
                        onClick={downloadConfigBundle}
                        disabled={isGeneratingConfig}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-blue-500/30 rounded text-xs font-bold transition-all"
                     >
                        {isGeneratingConfig ? 'Generating...' : 'Download .ZIP'}
                     </button>
                 </div>
             )}
          </div>
        ) : (
             // IF GITHUB ACTION IS DISABLED, SHOW SIMPLE UPLOAD UI
             <div className="mt-4 p-5 bg-slate-900/80 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
                 <div className="mb-4">
                     <h3 className="text-sm font-bold text-white flex items-center mb-1">
                         <UploadCloud className="w-4 h-4 mr-2 text-firebase-orange" />
                         Upload Source Code Only
                     </h3>
                     <p className="text-xs text-slate-500">
                         Mode ini hanya akan mengupload file proyek Anda ke GitHub tanpa menambahkan CI/CD Workflow otomatis.
                     </p>
                 </div>

                 {/* REUSE DIRECT CONNECT LOGIC FOR SIMPLE UPLOAD */}
                  <div className="space-y-5">
                    {/* Step 1: Token */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-slate-400 flex items-center">
                            <Key className="w-3 h-3 mr-1.5" /> GitHub Token
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="password" 
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={ghToken}
                                onChange={(e) => setGhToken(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-firebase-orange focus:ring-1 focus:ring-firebase-orange outline-none"
                            />
                            <button 
                                onClick={handleFetchRepos}
                                disabled={isFetchingRepos || !ghToken}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                {isFetchingRepos ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Connect'}
                            </button>
                        </div>
                    </div>

                    {/* Step 2: Repo Select */}
                    {ghRepos.length > 0 && (
                        <div className="space-y-2 animate-in fade-in">
                            <label className="text-xs uppercase font-bold text-slate-400 flex items-center">
                                <Search className="w-3 h-3 mr-1.5" /> Select Repository
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-800 rounded p-2 bg-slate-950">
                                {ghRepos.map(repo => (
                                    <button 
                                        key={repo.id}
                                        onClick={() => setSelectedRepo(repo)}
                                        className={`text-left px-3 py-2 rounded text-xs truncate transition-colors flex justify-between items-center ${selectedRepo?.id === repo.id ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' : 'hover:bg-slate-800 text-slate-300'}`}
                                    >
                                        <span>{repo.full_name}</span>
                                        {selectedRepo?.id === repo.id && <Check className="w-3 h-3"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Simple Push Action */}
                    {selectedRepo && (
                         <div className="bg-slate-950 p-4 rounded border border-slate-800 animate-in slide-in-from-bottom-2">
                             <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center text-sm font-bold text-white">
                                     <Github className="w-4 h-4 mr-2" />
                                     Upload to: <span className="text-orange-400 ml-1">{selectedRepo.full_name}</span>
                                 </div>
                             </div>

                             {/* COMMIT MESSAGE INPUT */}
                             <div className="mb-4">
                                <label className="text-xs uppercase font-bold text-slate-400 flex items-center mb-1.5">
                                    <GitCommit className="w-3 h-3 mr-1.5" /> Commit Message
                                </label>
                                <input 
                                    type="text" 
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="chore: initial upload"
                                />
                             </div>

                             {pushStatus === 'success' ? (
                                 <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs text-center">
                                     <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                                     <span className="font-bold block mb-1">Berhasil Upload {pushProgress?.total} file!</span>
                                     <span className="opacity-80">File Anda sudah ada di repo GitHub.</span>
                                 </div>
                             ) : (
                                 <div className="space-y-2">
                                     <button 
                                        onClick={handleGithubPush}
                                        disabled={isPushing}
                                        className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded shadow-lg shadow-orange-900/20 flex items-center justify-center transition-all disabled:opacity-50"
                                     >
                                         {isPushing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                                         {isPushing ? pushLog : 'Upload Files Now'}
                                     </button>
                                     {pushProgress && (
                                         <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                             <div 
                                                className="bg-orange-500 h-full transition-all duration-300" 
                                                style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%`}}
                                             ></div>
                                         </div>
                                     )}
                                 </div>
                             )}
                             
                             {pushStatus === 'error' && (
                                <div className="mt-2 text-center text-red-400 text-xs bg-slate-900 p-2 rounded border border-red-500/20">
                                   {pushLog}
                                </div>
                             )}
                         </div>
                    )}
                  </div>
             </div>
        )}

        {/* Action Buttons (Main) - Only show if not using Direct Push to avoid confusion, or keep as "Proceed to Guide" */}
        <div className="pt-4 flex flex-col gap-3">
          <button
            onClick={onGenerate}
            className="w-full py-4 bg-gradient-to-r from-firebase-yellow to-firebase-orange text-slate-900 font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12"></div>
            <ArrowRight className="w-6 h-6 mr-2" />
            Lanjut ke Panduan CLI
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfigurationForm;