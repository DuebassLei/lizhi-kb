export interface JournalEntry {
  id: string;
  dayDate: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface JournalDayGroup {
  dayDate: string;
  label: string;
  entries: JournalEntry[];
}
