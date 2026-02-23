export interface ProjectConfig {
  projectId: string;
  publicDir: string;
  isSpa: boolean;
  githubAction: boolean;
  framework: string;
  structure?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export enum StepStatus {
  CONFIG = 'CONFIG',
  GUIDE = 'GUIDE'
}