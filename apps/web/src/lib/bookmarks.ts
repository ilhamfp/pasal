export interface Bookmark {
  frbr_uri: string;
  title: string;
  pasal?: string;
  addedAt: string;
}

export interface HistoryItem {
  frbr_uri: string;
  title: string;
  visitedAt: string;
}

const BOOKMARKS_KEY = "pasal_bookmarks";
const HISTORY_KEY = "pasal_history";

function getStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStorage<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function addBookmark(frbr_uri: string, title: string, pasal?: string): void {
  const bookmarks = getStorage<Bookmark>(BOOKMARKS_KEY);
  const exists = bookmarks.find((b) => b.frbr_uri === frbr_uri && b.pasal === pasal);
  if (exists) return;
  bookmarks.unshift({ frbr_uri, title, pasal, addedAt: new Date().toISOString() });
  setStorage(BOOKMARKS_KEY, bookmarks);
}

export function removeBookmark(frbr_uri: string, pasal?: string): void {
  const bookmarks = getStorage<Bookmark>(BOOKMARKS_KEY);
  const filtered = bookmarks.filter(
    (b) => !(b.frbr_uri === frbr_uri && b.pasal === pasal),
  );
  setStorage(BOOKMARKS_KEY, filtered);
}

export function isBookmarked(frbr_uri: string, pasal?: string): boolean {
  const bookmarks = getStorage<Bookmark>(BOOKMARKS_KEY);
  return bookmarks.some((b) => b.frbr_uri === frbr_uri && b.pasal === pasal);
}

export function getBookmarks(): Bookmark[] {
  return getStorage<Bookmark>(BOOKMARKS_KEY);
}

export function addToHistory(frbr_uri: string, title: string): void {
  const history = getStorage<HistoryItem>(HISTORY_KEY);
  const filtered = history.filter((h) => h.frbr_uri !== frbr_uri);
  filtered.unshift({ frbr_uri, title, visitedAt: new Date().toISOString() });
  setStorage(HISTORY_KEY, filtered.slice(0, 50));
}

export function getHistory(limit: number = 50): HistoryItem[] {
  return getStorage<HistoryItem>(HISTORY_KEY).slice(0, limit);
}
