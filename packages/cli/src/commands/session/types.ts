export type SessionStatus = 'active' | 'finished';

export type PageMeta = {
  number: number;
  agent: string;
  role: string;
  title: string;
  file: string;
};

export type SessionMeta = {
  date: string;
  status: SessionStatus;
  currentPage: number | null;
  pages: PageMeta[];
};

export type SessionCommandIo = {
  write: (message: string) => void;
  ask: (message: string, defaultYes?: boolean) => Promise<boolean>;
};
