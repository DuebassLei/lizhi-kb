import type {
  ConvertMentionResult,
  DashboardStats,
  DecryptedContent,
  DocumentMeta,
  EditActivityDay,
  GraphPayload,
  LinkMention,
  LinkStats,
  LizhiBackend,
  RenameResult,
  SearchHit,
  StatusResponse,
} from "./types.js";

export abstract class HttpBackendBase implements LizhiBackend {
  protected abstract request<T>(method: string, path: string, body?: unknown): Promise<T>;

  status(): Promise<StatusResponse> {
    return this.request<StatusResponse>("GET", "/status");
  }

  listDocuments(): Promise<DocumentMeta[]> {
    return this.request<DocumentMeta[]>("GET", "/documents");
  }

  listFolders(): Promise<string[]> {
    return this.request<string[]>("GET", "/folders");
  }

  getFolderTree(): Promise<unknown> {
    return this.request<unknown>("GET", "/folder-tree");
  }

  listTags(): Promise<string[]> {
    return this.request<string[]>("GET", "/tags");
  }

  readDocument(id: string): Promise<DecryptedContent> {
    return this.request<DecryptedContent>("GET", `/documents/${encodeURIComponent(id)}`);
  }

  readDocuments(ids?: string[]): Promise<DecryptedContent[]> {
    return this.request<DecryptedContent[]>("POST", "/documents/batch-read", { ids });
  }

  search(query: string, limit = 20): Promise<SearchHit[]> {
    return this.request<SearchHit[]>("POST", "/search", { query, limit });
  }

  getBacklinks(id: string): Promise<LinkMention[]> {
    return this.request<LinkMention[]>(
      "GET",
      `/documents/${encodeURIComponent(id)}/backlinks`,
    );
  }

  getUnlinkedMentions(id: string): Promise<LinkMention[]> {
    return this.request<LinkMention[]>(
      "GET",
      `/documents/${encodeURIComponent(id)}/unlinked-mentions`,
    );
  }

  getOutboundLinks(id: string): Promise<LinkMention[]> {
    return this.request<LinkMention[]>(
      "GET",
      `/documents/${encodeURIComponent(id)}/outbound-links`,
    );
  }

  getDocumentTags(id: string): Promise<string[]> {
    return this.request<string[]>("GET", `/documents/${encodeURIComponent(id)}/tags`);
  }

  setDocumentTags(id: string, tags: string[]): Promise<string[]> {
    return this.request<string[]>("PUT", `/documents/${encodeURIComponent(id)}/tags`, { tags });
  }

  getGraph(id: string, depth = 2): Promise<GraphPayload> {
    return this.request<GraphPayload>(
      "GET",
      `/graph/${encodeURIComponent(id)}?depth=${depth}`,
    );
  }

  getLinkStats(): Promise<LinkStats> {
    return this.request<LinkStats>("GET", "/links/stats");
  }

  getLinkIndexSnapshot(): Promise<import("./types.js").LinkIndexSnapshot> {
    return this.request("GET", "/links/snapshot");
  }

  getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>("GET", "/stats/dashboard");
  }

  getEditActivity(days = 365): Promise<EditActivityDay[]> {
    return this.request<EditActivityDay[]>("GET", `/stats/edit-activity?days=${days}`);
  }

  createDocument(title: string, folder?: string): Promise<DocumentMeta> {
    return this.request<DocumentMeta>("POST", "/documents", { title, folder });
  }

  saveDocument(
    id: string,
    content: string,
    syncTitleFromH1 = true,
  ): Promise<{ id: string; savedAt: number }> {
    return this.request<{ id: string; savedAt: number }>(
      "PUT",
      `/documents/${encodeURIComponent(id)}`,
      { content, syncTitleFromH1 },
    );
  }

  renameDocument(
    id: string,
    title: string,
    propagateWikiLinks = true,
  ): Promise<RenameResult> {
    return this.request<RenameResult>(
      "PATCH",
      `/documents/${encodeURIComponent(id)}/rename`,
      { title, propagateWikiLinks },
    );
  }

  moveDocument(id: string, folder: string): Promise<DocumentMeta> {
    return this.request<DocumentMeta>(
      "PATCH",
      `/documents/${encodeURIComponent(id)}/move`,
      { folder },
    );
  }

  deleteDocument(id: string): Promise<{ deleted: string }> {
    return this.request<{ deleted: string }>(
      "DELETE",
      `/documents/${encodeURIComponent(id)}`,
    );
  }

  convertUnlinkedMention(sourceId: string, targetTitle: string): Promise<ConvertMentionResult> {
    return this.request<ConvertMentionResult>(
      "POST",
      `/documents/${encodeURIComponent(sourceId)}/convert-mention`,
      { targetTitle },
    );
  }

  migrateFolderPrefix(oldPrefix: string, newPrefix: string): Promise<{ migratedCount: number }> {
    return this.request<{ migratedCount: number }>("POST", "/folders/migrate", {
      oldPrefix,
      newPrefix,
    });
  }

  saveAsset(dataBase64: string, extension: string): Promise<{ id: string; mimeType: string }> {
    return this.request<{ id: string; mimeType: string }>("POST", "/assets", {
      dataBase64,
      extension,
    });
  }

  getAsset(id: string): Promise<import("./types.js").AssetPayload> {
    return this.request("GET", `/assets/${encodeURIComponent(id)}`);
  }
}
