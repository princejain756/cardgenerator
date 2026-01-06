export interface Attendee {
  id: string;
  registrationId: string;
  name: string;
  company: string;
  passType: string;
  tracks: string[];
  role?: 'Speaker' | 'Attendee' | 'Organizer' | 'Student' | 'Teacher';
  image?: string;
  schoolId?: string;
  schoolName?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  contactNumber?: string;
  address?: string;
  className?: string;
  section?: string;
  emergencyContact?: string;
  extras?: Record<string, string>;
  template?: BadgeTemplate;
  verificationCode?: string;
  verified?: boolean;
  createdBy?: string;
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

export interface SavedTemplate {
  id: string;
  name: string;
  icon: string;
  baseTemplate: BadgeTemplate;
  layout: TemplateLayout;
  theme?: CardTheme;
  customLabels?: Record<string, string>;
  visibility: 'public' | 'private';
  isOwner?: boolean;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type BadgeTemplate = 'conference' | 'school-classic' | 'company-id';

// ============ NEW TYPES FOR DRAG-AND-DROP CUSTOMIZATION ============

export interface ElementPosition {
  x: number;          // Percentage from left (0-100)
  y: number;          // Percentage from top (0-100)
  width?: number;     // Optional width in percentage
  height?: number;    // Optional height in percentage
  fontSize?: number;  // Font size in pixels
  textAlign?: 'left' | 'center' | 'right';
  visible: boolean;   // Whether element is shown
}

export interface TemplateLayout {
  name: ElementPosition;
  image: ElementPosition;
  company: ElementPosition;
  registrationId: ElementPosition;
  role?: ElementPosition;
  qrCode: ElementPosition;
  // School-specific
  fatherName?: ElementPosition;
  motherName?: ElementPosition;
  dateOfBirth?: ElementPosition;
  className?: ElementPosition;
  contactNumber?: ElementPosition;
  address?: ElementPosition;
}

export interface CardTheme {
  id: string;
  name: string;
  headerGradient: string;      // Tailwind gradient classes
  backgroundColor: string;     // Hex or Tailwind class
  primaryTextColor: string;    // Hex color
  secondaryTextColor: string;  // Hex color
  accentColor: string;         // Hex color
  borderRadius: number;        // Border radius in px
}

export const DEFAULT_THEMES: CardTheme[] = [
  {
    id: 'indigo-sky',
    name: 'Ocean Blue',
    headerGradient: 'from-indigo-600 to-sky-500',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#4f46e5',
    borderRadius: 24,
  },
  {
    id: 'emerald-teal',
    name: 'Forest Green',
    headerGradient: 'from-emerald-500 to-teal-600',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#10b981',
    borderRadius: 24,
  },
  {
    id: 'amber-orange',
    name: 'Sunset',
    headerGradient: 'from-amber-500 to-orange-600',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#f59e0b',
    borderRadius: 24,
  },
  {
    id: 'purple-pink',
    name: 'Purple Dream',
    headerGradient: 'from-purple-500 to-pink-600',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#a855f7',
    borderRadius: 24,
  },
  {
    id: 'slate-dark',
    name: 'Corporate Dark',
    headerGradient: 'from-slate-800 to-slate-900',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#475569',
    borderRadius: 24,
  },
  {
    id: 'red-rose',
    name: 'Red',
    headerGradient: 'from-red-500 to-rose-600',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#ef4444',
    borderRadius: 24,
  },
  {
    id: 'maroon',
    name: 'Maroon',
    headerGradient: 'from-rose-900 to-red-900',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#881337',
    borderRadius: 24,
  },
  {
    id: 'black',
    name: 'Black',
    headerGradient: 'from-gray-900 to-black',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#18181b',
    borderRadius: 24,
  },
  {
    id: 'yellow-gold',
    name: 'Yellow Gold',
    headerGradient: 'from-yellow-400 to-amber-500',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#eab308',
    borderRadius: 24,
  },
  {
    id: 'brown',
    name: 'Brown',
    headerGradient: 'from-amber-700 to-yellow-900',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#92400e',
    borderRadius: 24,
  },
  {
    id: 'grey',
    name: 'Grey',
    headerGradient: 'from-gray-500 to-slate-600',
    backgroundColor: '#ffffff',
    primaryTextColor: '#1e293b',
    secondaryTextColor: '#64748b',
    accentColor: '#6b7280',
    borderRadius: 24,
  },
];

export const DEFAULT_LAYOUTS: Record<BadgeTemplate, TemplateLayout> = {
  'conference': {
    name: { x: 50, y: 52, fontSize: 24, textAlign: 'center', visible: true },
    image: { x: 50, y: 30, width: 25, height: 20, visible: true },
    company: { x: 50, y: 60, fontSize: 14, textAlign: 'center', visible: true },
    registrationId: { x: 50, y: 75, fontSize: 10, textAlign: 'center', visible: true },
    role: { x: 50, y: 45, fontSize: 12, textAlign: 'center', visible: true },
    qrCode: { x: 50, y: 88, width: 15, visible: true },
  },
  'school-classic': {
    name: { x: 50, y: 42, fontSize: 24, textAlign: 'center', visible: true },
    image: { x: 50, y: 28, width: 20, height: 18, visible: true },
    company: { x: 50, y: 10, fontSize: 16, textAlign: 'center', visible: true },
    registrationId: { x: 50, y: 48, fontSize: 11, textAlign: 'center', visible: true },
    fatherName: { x: 50, y: 55, fontSize: 11, textAlign: 'center', visible: true },
    motherName: { x: 50, y: 60, fontSize: 11, textAlign: 'center', visible: true },
    dateOfBirth: { x: 50, y: 65, fontSize: 11, textAlign: 'center', visible: true },
    className: { x: 50, y: 70, fontSize: 11, textAlign: 'center', visible: true },
    contactNumber: { x: 50, y: 75, fontSize: 11, textAlign: 'center', visible: true },
    address: { x: 50, y: 82, fontSize: 10, textAlign: 'center', visible: true },
    qrCode: { x: 50, y: 92, width: 12, visible: false },
  },
  'company-id': {
    name: { x: 50, y: 52, fontSize: 22, textAlign: 'center', visible: true },
    image: { x: 50, y: 32, width: 22, height: 18, visible: true },
    company: { x: 50, y: 12, fontSize: 18, textAlign: 'center', visible: true },
    registrationId: { x: 50, y: 58, fontSize: 11, textAlign: 'center', visible: true },
    role: { x: 50, y: 64, fontSize: 12, textAlign: 'center', visible: true },
    contactNumber: { x: 50, y: 72, fontSize: 11, textAlign: 'center', visible: true },
    address: { x: 50, y: 80, fontSize: 10, textAlign: 'center', visible: true },
    qrCode: { x: 50, y: 92, width: 14, visible: true },
  },
};
