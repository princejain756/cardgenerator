export interface Attendee {
  id: string;
  registrationId: string;
  name: string;
  company: string;
  passType: string; // e.g., "Agile India Lite", "Four Day Conference"
  tracks: string[];
  role?: 'Speaker' | 'Attendee' | 'Organizer';
  image?: string; // Base64 Data URL
}

export interface ParseResult {
  attendees: Attendee[];
  errors: string[];
}

export enum PassCategory {
  LITE = 'LITE',
  FULL = 'FULL',
  SPEAKER = 'SPEAKER',
  WORKSHOP = 'WORKSHOP',
  UNKNOWN = 'UNKNOWN'
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}
