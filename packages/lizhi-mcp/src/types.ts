export interface VaultStatus {
  exists: boolean;
  isLocked: boolean;
  encryptionEnabled: boolean;
  lockOnStartup: boolean;
  vaultId: string | null;
  schemaVersion: number | null;
}

export interface DocumentMeta {
  id: string;
  title: string;
  path: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
}

export interface DecryptedContent {
  id: string;
  content: string;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  matchIn: string;
  score: number;
}

export interface LinkMention {
  id: string;
  title: string;
}

export interface HubRank {
  id: string;
  title: string;
  inbound: number;
  outbound: number;
}

export interface LinkStats {
  totalLinks: number;
  orphanCount: number;
  hubDoc: LinkMention | null;
  topHubs: HubRank[];
}

export interface GraphNode {
  id: string;
  title: string;
  depth: number;
  x: number;
  y: number;
  isCenter: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphPayload {
  centerId: string;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface StatusResponse {
  mode?: string;
  mcpEnabled: boolean;
  writeEnabled: boolean;
  vault: VaultStatus;
}

export interface RenameResult {
  id: string;
  title: string;
  propagatedDocIds: string[];
}

export interface ConvertMentionResult {
  id: string;
  savedAt: number;
  replacedCount: number;
}

export interface DashboardStats {
  totalDocs: number;
  totalWords: number;
  editsThisWeek: number;
  lastEditDate: string | null;
}

export interface EditActivityDay {
  date: string;
  editCount: number;
}

export interface AssetPayload {
  id: string;
  mimeType: string;
  dataBase64: string;
  size: number;
}

export interface LinkIndexSnapshot {
  outboundMap: Record<string, string[]>;
  backlinkMap: Record<string, LinkMention[]>;
  unlinkedMap: Record<string, LinkMention[]>;
  plainTextMap: Record<string, string>;
  strippedTextMap: Record<string, string>;
  snippetMap: Record<string, string>;
  orphanIds: string[];
  stats: LinkStats;
}

export interface LizhiBackend {
  status(): Promise<StatusResponse>;
  listDocuments(): Promise<DocumentMeta[]>;
  listFolders(): Promise<string[]>;
  getFolderTree(): Promise<unknown>;
  listTags(): Promise<string[]>;
  readDocument(id: string): Promise<DecryptedContent>;
  readDocuments(ids?: string[]): Promise<DecryptedContent[]>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  getBacklinks(id: string): Promise<LinkMention[]>;
  getUnlinkedMentions(id: string): Promise<LinkMention[]>;
  getOutboundLinks(id: string): Promise<LinkMention[]>;
  getDocumentTags(id: string): Promise<string[]>;
  setDocumentTags(id: string, tags: string[]): Promise<string[]>;
  getGraph(id: string, depth?: number): Promise<GraphPayload>;
  getLinkStats(): Promise<LinkStats>;
  getLinkIndexSnapshot(): Promise<LinkIndexSnapshot>;
  getDashboardStats(): Promise<DashboardStats>;
  getEditActivity(days?: number): Promise<EditActivityDay[]>;
  createDocument(title: string, folder?: string): Promise<DocumentMeta>;
  saveDocument(id: string, content: string, syncTitleFromH1?: boolean): Promise<{ id: string; savedAt: number }>;
  renameDocument(id: string, title: string, propagateWikiLinks?: boolean): Promise<RenameResult>;
  moveDocument(id: string, folder: string): Promise<DocumentMeta>;
  deleteDocument(id: string): Promise<{ deleted: string }>;
  convertUnlinkedMention(sourceId: string, targetTitle: string): Promise<ConvertMentionResult>;
  migrateFolderPrefix(oldPrefix: string, newPrefix: string): Promise<{ migratedCount: number }>;
  saveAsset(dataBase64: string, extension: string): Promise<{ id: string; mimeType: string }>;
  getAsset(id: string): Promise<AssetPayload>;
}

export class LizhiBridgeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LizhiBridgeError";
    this.code = code;
  }
}
