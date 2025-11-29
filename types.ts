export interface Attendee {
  id: string;
  registrationId: string;
  name: string;
  company: string;
  passType: string; // e.g., "Agile India Lite", "Four Day Conference"
  tracks: string[];
  role?: 'Speaker' | 'Attendee' | 'Organizer';
  image?: string; // Base64 Data URL
  // Conference-specific fields
  eventName?: string;
  eventSubtitle?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  validFrom?: string;
  validTo?: string;
  sponsor?: string;
  barcodeValue?: string;
  jobTitle?: string; // What the person does / designation
  // School ID specific fields
  schoolId?: string;
  className?: string;
  section?: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  contactNumber?: string;
  address?: string;
  bloodGroup?: string;
  isProcessingImage?: boolean; // Flag for background removal processing
  // Any other dynamically detected fields
  extraFields?: Record<string, string>;
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

export type CardTemplate = 'school-classic' | 'conference-modern' | 'mono-slim';

export interface CardLayout {
  header?: string[];  // Fields to display in header area
  table?: string[];   // Fields to display in main table
  footer?: string[];  // Fields to display in footer area
  defaults?: Record<string, string>;  // Default labels/values for standard fields
}

export interface TemplateSettings {
  brandName: string;
  brandTagline: string;
  contactNumber: string;
  address: string;
  footerNote: string;
  primaryColor: string;
  accentColor: string;
  badgeLabel?: string;
  logo?: string; // Base64 Data URL for school logo
  principalSign?: string; // Base64 Data URL for principal signature
  layout?: CardLayout; // AI-generated layout configuration
}
