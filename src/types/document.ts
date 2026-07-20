export interface DocumentMeta {
  id: string;
  title: string;
  path: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
  aiExclude: boolean;
}

export interface TrashedDocumentMeta extends DocumentMeta {
  deletedAt: number;
}

export interface PurgeExpiredResult {
  purged: number;
}

export interface DecryptedContent {
  id: string;
  content: string;
}

export interface SaveResult {
  id: string;
  savedAt: number;
}

export interface EditActivityDay {
  date: string;
  editCount: number;
}

export interface DashboardStats {
  totalDocs: number;
  totalWords: number;
  editsThisWeek: number;
  lastEditDate: string | null;
}
