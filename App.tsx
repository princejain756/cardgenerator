import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Printer, Search, Users, Sparkles, Filter, X, CheckSquare, Square, Pencil, Trash2, DownloadCloud, LogOut, KeyRound, UserPlus, Palette, LayoutTemplate, Plus } from 'lucide-react';
import { IDCard } from './components/IDCard';
import { EditModal } from './components/EditModal';
import { parseTSVData } from './utils/parser';
import { Attendee, User, CardTemplate, TemplateSettings } from './types';
import { analyzeDemographics, analyzeFileWithMistral, generateCardLayout } from './services/mistralService';
import * as XLSX from 'xlsx';
import { toJpeg, toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { buildCardFilename } from './utils/filename';
import { removeBackground } from '@imgly/background-removal';
import {
  login as apiLogin,
  fetchMe,
  fetchAttendees as apiFetchAttendees,
  importAttendees,
  updateAttendee as apiUpdateAttendee,
  bulkUpdateAttendees,
  deleteAttendee as apiDeleteAttendee,
  deleteAllAttendees as apiDeleteAllAttendees,
  createUser as apiCreateUser
} from './services/api';

type TemplatePreset = {
  id: string;
  label: string;
  template?: CardTemplate; // optional: if not provided, keep current layout
  settings: TemplateSettings;
  blurb: string;
};

const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  brandName: '',
  brandTagline: '',
  contactNumber: '',
  address: '',
  footerNote: '',
  primaryColor: '#4f46e5',
  accentColor: '#22d3ee',
  badgeLabel: ''
};

const DEFAULT_CARD_TEMPLATE: CardTemplate = 'conference-modern';

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'blank',
    label: 'Clean Start',
    blurb: 'Begin with empty fields; choose your own layout.',
    settings: {
      ...DEFAULT_TEMPLATE_SETTINGS,
      primaryColor: '#475569',
      accentColor: '#0ea5e9'
    }
  },
  {
    id: 'royal-school',
    label: 'School',
    template: 'school-classic',
    blurb: 'Deep blue palette with crisp contrast for academic IDs.',
    settings: {
      ...DEFAULT_TEMPLATE_SETTINGS,
      primaryColor: '#1d4ed8',
      accentColor: '#60a5fa'
    }
  },
  {
    id: 'sunrise',
    label: 'Sunrise Prep',
    blurb: 'Warm orange/coral palette. Pick layout after applying.',
    settings: {
      ...DEFAULT_TEMPLATE_SETTINGS,
      primaryColor: '#f97316',
      accentColor: '#fb7185'
    }
  },
  {
    id: 'conference',
    label: 'Conference Classic',
    template: 'conference-modern',
    blurb: 'Expo-style pass with skyline header, sponsor band, and barcode.',
    settings: {
      ...DEFAULT_TEMPLATE_SETTINGS,
      primaryColor: '#0f172a',
      accentColor: '#2563eb',
      badgeLabel: 'Delegate'
    }
  },
  {
    id: 'mono',
    label: 'Mono Minimal',
    template: 'mono-slim',
    blurb: 'Compact monochrome layout.',
    settings: {
      ...DEFAULT_TEMPLATE_SETTINGS,
      primaryColor: '#0f172a',
      accentColor: '#1e293b'
    }
  }
];

const COLOR_SWATCHES = ['#1d4ed8', '#60a5fa', '#f97316', '#fb7185', '#22c55e', '#10b981', '#7c3aed', '#a855f7', '#111827', '#0ea5e9'];

const STORAGE_KEYS = {
  templateSettings: 'cardgen_template_settings',
  cardTemplate: 'cardgen_card_template',
  hiddenFields: 'cardgen_hidden_fields',
  customFields: 'cardgen_custom_fields',
  activePreset: 'cardgen_active_preset'
};

const isLegacyMockSettings = (settings: Partial<TemplateSettings>) => {
  const legacyNames = ['Cambridge Public School', 'Sunrise Preparatory', 'Minimal Card'];
  const legacyAddress = settings.address || '';
  const legacyContact = settings.contactNumber || '';
  return legacyNames.includes(settings.brandName || '') ||
    legacyAddress.toLowerCase().includes('nehru market') ||
    legacyContact.includes('93394 00600');
};

const loadStoredTemplateSettings = (fallback: TemplateSettings) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.templateSettings);
    if (saved) {
      const parsed = { ...fallback, ...JSON.parse(saved) };
      if (isLegacyMockSettings(parsed)) return fallback;
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return fallback;
};

const loadStoredCardTemplate = (fallback: CardTemplate) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.cardTemplate);
    if (saved === 'school-classic' || saved === 'conference-modern' || saved === 'mono-slim') return saved;
  } catch {
    /* ignore */
  }
  return fallback;
};

const loadStoredHiddenFields = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.hiddenFields);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set<string>();
};

const loadStoredCustomFields = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.customFields);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    /* ignore */
  }
  return [] as string[];
};

const loadStoredPreset = (fallback: string) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.activePreset);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return fallback;
};

const isLikelyDate = (value?: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  // Accept DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD Mon YYYY, Mon DD YYYY, e.g., 25/11/2025 or Nov 25 2025
  const patterns = [
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
    /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/,
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/,
    /^[A-Za-z]{3,9}\s+\d{1,2}[,\s]+\d{2,4}$/
  ];
  return patterns.some((re) => re.test(trimmed));
};

const App: React.FC = () => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isMinimalView, setIsMinimalView] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');
  const [filenameTemplate, setFilenameTemplate] = useState('{name}_IDCARD');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'user' as 'admin' | 'user' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Selection & Editing State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(() => loadStoredHiddenFields());
  const [customFields, setCustomFields] = useState<string[]>(() => loadStoredCustomFields());
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>(() => loadStoredCardTemplate(DEFAULT_CARD_TEMPLATE));
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(() => loadStoredTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS }));
  const [activePresetId, setActivePresetId] = useState<string>(() => loadStoredPreset(TEMPLATE_PRESETS[0].id));
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ attendee: Attendee | null; fieldKey: string | null; value: string }>({ attendee: null, fieldKey: null, value: '' });

  // Persist UI state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cardTemplate, cardTemplate);
  }, [cardTemplate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.templateSettings, JSON.stringify(templateSettings));
  }, [templateSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.hiddenFields, JSON.stringify(Array.from(hiddenFields)));
  }, [hiddenFields]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customFields, JSON.stringify(customFields));
  }, [customFields]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activePreset, activePresetId);
  }, [activePresetId]);

  const loadAttendees = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    try {
      const data = await apiFetchAttendees(activeToken);
      setAttendees(data);
      captureDetectedFields(data);
    } catch (err) {
      console.error('Failed to load attendees', err);
    }
  };

  const captureDetectedFields = (items: Attendee[]) => {
    if (!items || items.length === 0) {
      // Keep existing selections/persistence when no data is present
      if (customFields.length) {
        setDetectedFields(Array.from(new Set(customFields)));
      }
      return;
    }
    const labelMap: Record<string, string> = {
      schoolId: 'School ID',
      className: 'Class',
      section: 'Section',
      fatherName: "Father's Name",
      motherName: "Mother's Name",
      dob: 'Date of Birth',
      contactNumber: 'Contact Number',
      address: 'Address',
      bloodGroup: 'Blood Group',
      registrationId: 'Registration ID',
      passType: 'Pass Type',
      company: 'Company/School',
      name: 'Name',
      eventName: 'Event Name',
      eventSubtitle: 'Event Subtitle',
      eventStartDate: 'Event Start',
      eventEndDate: 'Event End',
      validFrom: 'Valid From',
      validTo: 'Valid To',
      sponsor: 'Sponsor',
      barcodeValue: 'Barcode',
      jobTitle: 'Job Title'
    };

    const fields = new Set<string>();
    const keys = Object.keys(labelMap) as (keyof Attendee)[];
    items.forEach((item) => {
      keys.forEach((key) => {
        const value = item[key];
        if (Array.isArray(value)) {
          if (value.length) fields.add(labelMap[key]);
        } else if (value) {
          fields.add(labelMap[key]);
        }
      });
      if (item.extraFields) {
        Object.keys(item.extraFields).forEach((label) => fields.add(label));
      }
    });

    customFields.forEach((cf) => fields.add(cf));
    // Ensure customFields include any discovered extraFields labels
    setCustomFields((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (item.extraFields) {
          Object.keys(item.extraFields).forEach((label) => next.add(label));
        }
      });
      return Array.from(next);
    });

    // Add static layout fields that appear on cards
    if (items.length > 0) {
      fields.add('Principal Sign');
      fields.add('Organization');
    }

    const finalFields = Array.from(fields).filter((f) => !hiddenFields.has(f));
    setDetectedFields(finalFields);
  };

  const handlePresetApply = (presetId: string, templateOverride?: CardTemplate) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS, ...preset.settings });
    if (preset.template || templateOverride) {
      setCardTemplate(templateOverride || preset.template || cardTemplate);
    }
    setActivePresetId(presetId);
  };

  const updateTemplateSetting = (key: keyof TemplateSettings, value: string) => {
    setActivePresetId('custom');
    setTemplateSettings((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const validateSession = async () => {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const user = await fetchMe(token);
        setCurrentUser(user);
        setAuthError(null);
        await loadAttendees(token);
      } catch (err: any) {
        console.error('Session validation failed', err);
        setCurrentUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        setAuthError(err?.message || 'Session expired');
      } finally {
        setAuthLoading(false);
      }
    };
    validateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiLogin(loginForm.username, loginForm.password);
      setToken(res.token);
      localStorage.setItem('authToken', res.token);
      setCurrentUser(res.user);
      await loadAttendees(res.token);
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('authToken');
    setAttendees([]);
    setSelectedIds(new Set());
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setIsCreatingUser(true);
    try {
      await apiCreateUser(token, newUserForm);
      setNewUserForm({ username: '', password: '', role: 'user' });
      setAuthError(null);
      alert('User created successfully');
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!token) {
      setAuthError('Please login to import data.');
      return;
    }

    setIsProcessingFile(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const currentTemplate = cardTemplate;
    const currentPreset = activePresetId;

    try {
      let fileContent = '';

      // Handle Excel files
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        fileContent = XLSX.utils.sheet_to_csv(firstSheet);
      } else {
        // Handle text files (.txt, .tsv, .csv, .md)
        fileContent = await file.text();
      }

      // Use Mistral AI to parse and categorize the data
      const result = await analyzeFileWithMistral(fileContent, fileExtension || 'txt');
      const parsedData = result.attendees;

      // Update template settings with school metadata if detected
      if (result.metadata) {
        setTemplateSettings(prev => ({
          ...prev,
          brandName: result.metadata?.schoolName || prev.brandName,
          contactNumber: result.metadata?.contactNumber || prev.contactNumber
        }));
        console.log('Detected school info:', result.metadata);
      }

      // Convert to Attendee format with unique IDs
      const attendeeData: Attendee[] = parsedData.map((item, index) => ({
        id: `att-${Date.now()}-${index}`,
        name: item.name,
        company: item.company,
        passType: item.passType,
        registrationId: item.registrationId,
        eventName: item.eventName || templateSettings.brandName,
        eventSubtitle: item.eventSubtitle || templateSettings.brandTagline,
        eventStartDate: isLikelyDate(item.eventStartDate) ? item.eventStartDate : '',
        eventEndDate: isLikelyDate(item.eventEndDate) ? item.eventEndDate : '',
        validFrom: isLikelyDate(item.validFrom) ? item.validFrom : isLikelyDate(item.eventStartDate) ? item.eventStartDate : '',
        validTo: isLikelyDate(item.validTo) ? item.validTo : isLikelyDate(item.eventEndDate) ? item.eventEndDate : '',
        sponsor: item.sponsor || templateSettings.footerNote,
        barcodeValue: item.barcodeValue || item.registrationId,
        jobTitle: item.jobTitle,
        role: item.role || 'Attendee',
        tracks: item.tracks || [],
        schoolId: item.schoolId || item.registrationId,
        className: item.className || item.passType,
        section: item.section,
        fatherName: item.fatherName,
        motherName: item.motherName,
        dob: item.dob,
        contactNumber: item.contactNumber,
        address: item.address,
        bloodGroup: item.bloodGroup,
        extraFields: item.extraFields || {}
      }));

      // Merge with existing attendees instead of replacing
      const mergedMap = new Map<string, Attendee>();
      const addToMap = (record: Attendee) => {
        const key = record.registrationId || record.id;
        mergedMap.set(key, { ...record });
      };
      attendees.forEach(addToMap);
      attendeeData.forEach(addToMap);
      const mergedList = Array.from(mergedMap.values());

      await importAttendees(token, mergedList);
      setAttendees(mergedList);
      captureDetectedFields(mergedList);
      setAiInsight(null);
      setSelectedIds(new Set());
      await loadAttendees(token);
      setCardTemplate(currentTemplate);
      setActivePresetId(currentPreset);

      // Generate AI-driven card layout
      try {
        const layout = await generateCardLayout(attendeeData, cardTemplate);
        setTemplateSettings(prev => ({ ...prev, layout }));
        console.log('AI-generated layout:', layout);
      } catch (layoutError) {
        console.error('Failed to generate AI layout, using defaults:', layoutError);
      }
    } catch (error) {
      console.error('File processing error:', error);
      alert('Failed to process file with AI. Falling back to basic parsing.');

      // Fallback to basic parsing
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseTSVData(text);
        importAttendees(token, parsed)
          .then(() => {
            setAttendees(parsed);
            captureDetectedFields(parsed);
            setAiInsight(null);
            setSelectedIds(new Set());
          })
          .catch((err) => console.error('Import failed', err));
      };
      reader.readAsText(file);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    const companies = attendees.map(a => a.company).filter(c => c && c !== 'Self');
    const passTypes = attendees.map(a => a.passType);

    // De-dupe for better token usage. Explicitly cast to string[] to avoid TS inference issues.
    const uniqueCompanies = Array.from(new Set(companies)) as string[];

    try {
      const result = await analyzeDemographics(uniqueCompanies, passTypes);
      setAiInsight(result);
    } catch (err) {
      console.error('AI analysis failed', err);
      setAiInsight('Unable to generate insights right now.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredAttendees = useMemo(() => {
    return attendees.filter(a => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.registrationId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterType === 'All' || a.passType.toLowerCase().includes(filterType.toLowerCase());

      return matchesSearch && matchesFilter;
    });
  }, [attendees, searchTerm, filterType]);

  const uniquePassTypes = useMemo(() => {
    const types = new Set(attendees.map(a => a.passType));
    return ['All', ...Array.from(types)];
  }, [attendees]);

  // --- Selection Logic ---
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAttendees.length && filteredAttendees.length > 0) {
      // Deselect All
      setSelectedIds(new Set());
    } else {
      // Select All visible
      const allIds = new Set(filteredAttendees.map(a => a.id));
      setSelectedIds(allIds);
    }
  };

  // --- Edit Logic ---
  const syncCustomFieldsFromAttendee = (attendee?: Attendee) => {
    if (!attendee || !attendee.extraFields) return;
    const labels = Object.keys(attendee.extraFields);
    if (!labels.length) return;
    setCustomFields((prev) => {
      const next = new Set(prev);
      labels.forEach((l) => next.add(l));
      return Array.from(next);
    });
  };

  const handleEditClick = (attendee: Attendee) => {
    syncCustomFieldsFromAttendee(attendee);
    setEditingAttendee(attendee);
    setIsBulkEdit(false);
    setIsCreatingNew(false);
    setFocusedField(null);
    setEditModalOpen(true);
  };

  const handleBulkEditClick = () => {
    setEditingAttendee(null);
    setIsBulkEdit(true);
    setIsCreatingNew(false);
    setEditModalOpen(true);
  };

  const handleAddManualClick = () => {
    const draft: Attendee = {
      id: `draft-${Date.now()}`,
      name: '',
      company: templateSettings.brandName || 'Organization',
      passType: templateSettings.badgeLabel || 'General Entry',
      registrationId: '',
      eventName: templateSettings.brandName,
      eventSubtitle: templateSettings.brandTagline,
      eventStartDate: '',
      eventEndDate: '',
      validFrom: '',
      validTo: '',
      sponsor: templateSettings.footerNote,
      barcodeValue: '',
      jobTitle: '',
      role: 'Attendee',
      tracks: [],
      schoolId: '',
      className: '',
      section: '',
      fatherName: '',
      motherName: '',
      dob: '',
      contactNumber: '',
      address: templateSettings.address,
      bloodGroup: '',
      extraFields: Object.fromEntries(customFields.map((f) => [f, '']))
    };
    syncCustomFieldsFromAttendee(draft);
    setEditingAttendee(draft);
    setIsBulkEdit(false);
    setIsCreatingNew(true);
    setFocusedField(null);
    setEditModalOpen(true);
  };

  const handleFieldEditClick = (attendee: Attendee, fieldKey: string) => {
    syncCustomFieldsFromAttendee(attendee);
    setEditingAttendee(attendee);
    setIsBulkEdit(false);
    setIsCreatingNew(false);
    setFocusedField(fieldKey);
    // Open inline single-field editor instead of full modal
    const resolveValue = () => {
      if (fieldKey.startsWith('custom:')) {
        const label = fieldKey.replace('custom:', '');
        return (attendee.extraFields || {})[label] || '';
      }
      if (fieldKey === 'validity') {
        return attendee.validFrom || attendee.validTo || '';
      }
      return (attendee as any)[fieldKey] || '';
    };
    setInlineEdit({ attendee, fieldKey, value: resolveValue() });
  };

  const propagateConferenceHeader = async (updatedData: Partial<Attendee>): Promise<boolean> => {
    if (cardTemplate !== 'conference-modern' || !token) return false;
    const payload: Partial<Attendee> = {};
    if (updatedData.eventName && updatedData.eventName.trim()) payload.eventName = updatedData.eventName.trim();
    if (updatedData.eventSubtitle && updatedData.eventSubtitle.trim()) payload.eventSubtitle = updatedData.eventSubtitle.trim();
    if (Object.keys(payload).length === 0) return false;
    const allIds = attendees.map((a) => a.id);
    if (!allIds.length) return false;
    await bulkUpdateAttendees(token, allIds, payload);
    await loadAttendees();
    return true;
  };

  const handleSaveEdit = async (updatedData: Partial<Attendee>) => {
    if (!token) return;
    let needsReload = false;
    syncCustomFieldsFromAttendee(updatedData as Attendee);
    try {
      if (isBulkEdit) {
        await bulkUpdateAttendees(token, Array.from(selectedIds), updatedData);
        needsReload = true;
        setSelectedIds(new Set()); // Clear selection after bulk edit
      } else if (isCreatingNew && editingAttendee) {
        const newAttendee: Attendee = {
          ...editingAttendee,
          ...updatedData,
          id: `att-manual-${Date.now()}`,
          registrationId: updatedData.registrationId || editingAttendee.registrationId || `manual-${Date.now()}`,
          name: updatedData.name || 'New Attendee',
          passType: updatedData.passType || editingAttendee.passType || 'General Entry',
          company: updatedData.company || editingAttendee.company || 'Organization',
          role: updatedData.role || 'Attendee',
          tracks: (updatedData.tracks as string[]) || editingAttendee.tracks || [],
          schoolId: updatedData.schoolId || updatedData.registrationId || editingAttendee.registrationId,
        };
        const mergedList = [...attendees, newAttendee];
        await importAttendees(token, mergedList);
        setAttendees(mergedList);
      } else if (editingAttendee) {
        await apiUpdateAttendee(token, editingAttendee.id, updatedData);
        needsReload = true;
      }

      const propagated = await propagateConferenceHeader(updatedData);
      if (propagated) needsReload = false; // propagate already reloads
      if (needsReload) await loadAttendees();
    } catch (err) {
      console.error('Failed to save edits', err);
      alert('Failed to save changes.');
    } finally {
      setIsCreatingNew(false);
    }
  };

  // --- Image Upload Logic ---
  const handleImageUpload = async (attendeeId: string, file: File) => {
    if (!token) return;

    try {
      // Show loading state - update attendee with loading indicator
      setAttendees(prev => prev.map(a =>
        a.id === attendeeId
          ? { ...a, isProcessingImage: true }
          : a
      ));

      // Remove background from image
      const blob = await removeBackground(file);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const imageUrl = await base64Promise;

      // Update attendee with processed image
      const updated = attendees.find(a => a.id === attendeeId);
      if (!updated) return;

      const payload = { ...updated, image: imageUrl, isProcessingImage: false };
      await apiUpdateAttendee(token, attendeeId, payload);

      setAttendees(prev => prev.map(a =>
        a.id === attendeeId ? payload : a
      ));
    } catch (error) {
      console.error('Failed to process image:', error);
      alert('Failed to process image. Using original image instead.');

      // Fallback: use original image without background removal
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;
        const updated = attendees.find(a => a.id === attendeeId);
        if (!updated) return;

        const payload = { ...updated, image: imageUrl, isProcessingImage: false };
        await apiUpdateAttendee(token, attendeeId, payload);

        setAttendees(prev => prev.map(a =>
          a.id === attendeeId ? payload : a
        ));
      };
      reader.readAsDataURL(file);
    }
  };


  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setTemplateSettings(prev => ({ ...prev, logo: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (color: string) => {
    setTemplateSettings(prev => ({ ...prev, primaryColor: color }));
  };

  const handlePrincipalSignUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setTemplateSettings(prev => ({ ...prev, principalSign: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // --- Delete Logic ---
  const handleBulkDelete = async () => {
    if (!token) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} attendees?`)) {
      for (const id of selectedIds) {
        await apiDeleteAttendee(token, id).catch((err) => console.error(`Failed to delete ${id}`, err));
      }
      await loadAttendees();
      setSelectedIds(new Set());
    }
  };

  const handleDeleteAttendee = async (id: string) => {
    if (!token) return;
    if (confirm(`Are you sure you want to delete this attendee?`)) {
      await apiDeleteAttendee(token, id);
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      await loadAttendees();
    }
  };

  const handleDeleteAll = async () => {
    if (!token) return;
    if (confirm(`Are you sure you want to delete all attendees?`)) {
      await apiDeleteAllAttendees(token);
      setAttendees([]);
      setSelectedIds(new Set());
    }
  };

  const renderCardImage = async (node: HTMLElement) => {
    const options = {
      quality: 0.95,
      pixelRatio: 2,
      filter: (n: HTMLElement) => !n.classList?.contains('no-export')
    };
    return downloadFormat === 'jpg' ? toJpeg(node, options) : toPng(node, options);
  };

  // --- Download Zip Logic ---
  const handleDownloadZip = async () => {
    setIsDownloading(true);
    const zip = new JSZip();

    // Determine which cards to download: selected or all currently filtered
    const targetAttendees = selectedIds.size > 0
      ? filteredAttendees.filter(a => selectedIds.has(a.id))
      : filteredAttendees;

    try {
      // Process sequentially to prevent browser freeze/memory issues
      for (const attendee of targetAttendees) {
        const elementId = `card-${attendee.id}`;
        const node = document.getElementById(elementId);

        if (node) {
          try {
            const dataUrl = await renderCardImage(node);
            const base64Data = dataUrl.split(',')[1];
            const filename = buildCardFilename(attendee, filenameTemplate, downloadFormat);
            zip.file(filename, base64Data, { base64: true });
          } catch (err) {
            console.error(`Error processing card for ${attendee.name}:`, err);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'Mani ID_Cards.zip');
    } catch (error) {
      console.error('ZIP Generation failed:', error);
      alert('Failed to generate ZIP file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const isAllSelected = filteredAttendees.length > 0 && selectedIds.size === filteredAttendees.length;

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setIsCreatingNew(false);
    setEditingAttendee(null);
    setFocusedField(null);
  };

  const handleHideDetectedField = (field: string) => {
    setHiddenFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    setDetectedFields((prev) => prev.filter((f) => f !== field));
  };

  const handleRestoreHiddenFields = () => {
    setHiddenFields(new Set());
    captureDetectedFields(attendees);
  };

  const handleAddCustomField = (label: string) => {
    const trimmed = (label || '').trim();
    if (!trimmed) return;
    const exists = customFields.some((f) => f.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    setCustomFields((prev) => [...prev, trimmed]);
    setDetectedFields((prev) => Array.from(new Set([...prev, trimmed])));
    setAttendees((prev) => prev.map((a) => ({
      ...a,
      extraFields: {
        ...(a.extraFields || {}),
        [trimmed]: (a.extraFields || {})[trimmed] || ''
      }
    })));
  };

  const handleDeleteCustomField = (label: string) => {
    const target = (label || '').trim();
    if (!target) return;
    setCustomFields((prev) => prev.filter((f) => f.toLowerCase() !== target.toLowerCase()));
    setDetectedFields((prev) => prev.filter((f) => f.toLowerCase() !== target.toLowerCase()));
    setHiddenFields((prev) => {
      const next = new Set(prev);
      for (const item of Array.from(next)) {
        if (item.toLowerCase() === target.toLowerCase()) next.delete(item);
      }
      return next;
    });
    setAttendees((prev) => prev.map((a) => {
      if (!a.extraFields) return a;
      const updated = { ...a.extraFields };
      Object.keys(updated).forEach((k) => {
        if (k.toLowerCase() === target.toLowerCase()) delete updated[k];
      });
      return { ...a, extraFields: updated };
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-indigo-400 rounded-full animate-ping"></div>
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <KeyRound size={20} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Mani ID Pro</p>
              <h1 className="text-2xl font-bold text-white">Sign In</h1>
            </div>
          </div>
          {authError && <div className="text-sm text-red-400 bg-red-400/10 border border-red-500/30 rounded-lg px-3 py-2">{authError}</div>}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Username</label>
            <input
              value={loginForm.username}
              onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
          >
            {authLoading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-xs text-slate-500 text-center">Admin can add more users after sign-in.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-20">

      {/* Navigation / Header - Hidden on Print */}
      <nav className="no-print sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Mani ID<span className="text-indigo-400">Pro</span></h1>
                <p className="text-xs text-slate-400">Conference Badge Generator</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg transition-all border border-slate-700 text-sm font-medium relative">
                <Upload size={16} />
                <span>{isProcessingFile ? 'Processing...' : 'Import Data'}</span>
                <input type="file" className="hidden" accept=".txt,.tsv,.csv,.xlsx,.xls,.md" onChange={handleFileUpload} disabled={isProcessingFile} />
                {isProcessingFile && (
                  <div className="absolute inset-0 bg-slate-800/80 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </label>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-indigo-600/20 font-medium text-sm"
              >
                <Printer size={16} />
                <span>Print</span>
              </button>

              <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <span className="font-semibold">{currentUser.username}</span>
                  <span className="text-xs uppercase bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-500/30">{currentUser.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 transition-colors"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        {/* Controls Section - Hidden on Print */}
        <div className="no-print space-y-6 mb-12">

          {currentUser.role === 'admin' && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Admin Panel</p>
                  <h3 className="text-base font-semibold">Create a new user</h3>
                </div>
              </div>
              <form onSubmit={handleCreateUser} className="flex flex-1 flex-col md:flex-row gap-3">
                <input
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white flex-1"
                  required
                />
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="password"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white flex-1"
                  required
                />
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, role: e.target.value as 'admin' | 'user' }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  {isCreatingUser ? 'Creating...' : 'Add User'}
                </button>
              </form>
            </div>
          )}

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg text-sm">
              {authError}
            </div>
          )}

          {/* Stats & AI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={80} />
              </div>
              <p className="text-slate-400 text-sm font-medium">Total Attendees</p>
              <p className="text-4xl font-black text-white mt-1">{attendees.length}</p>
              <div className="mt-3 text-xs text-slate-400">All attendees imported.</div>
            </div>

            <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-amber-400" size={18} />
                  <h3 className="text-white font-bold">AI Demographics Insight</h3>
                </div>
                {!aiInsight && (
                  <button
                    onClick={handleAiAnalysis}
                    disabled={isAiLoading || attendees.length === 0}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isAiLoading ? 'Analyzing...' : 'Generate Insight'}
                  </button>
                )}
              </div>

              <div className="text-slate-300 text-sm leading-relaxed">
                {isAiLoading ? (
                  <div className="flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce delay-150"></div>
                    <span>Processing company data...</span>
                  </div>
                ) : aiInsight ? (
                  <p>{aiInsight}</p>
                ) : (
                  <p className="opacity-60">Click generate to view an AI-powered summary of the industries and roles represented in your attendee list.</p>
                )}
              </div>
            </div>
          </div>

          {/* Template Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="text-indigo-400" size={18} />
                  <h3 className="text-white font-semibold">Preset Templates</h3>
                </div>
                <span className="text-[11px] uppercase text-slate-500">{cardTemplate}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATE_PRESETS.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  const previewStyle = { background: `linear-gradient(135deg, ${preset.settings.primaryColor}, ${preset.settings.accentColor})` };
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handlePresetApply(preset.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePresetApply(preset.id); }}
                      role="button"
                      tabIndex={0}
                      className={`text-left bg-slate-900/50 hover:bg-slate-900 border border-slate-700 rounded-xl p-3 transition-all outline-none focus:ring-2 focus:ring-indigo-500/50 ${isActive ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : ''}`}
                    >
                      <div className="h-16 rounded-lg mb-2" style={previewStyle}></div>
                      <div className="text-sm font-semibold text-white">{preset.label}</div>
                      <p className="text-xs text-slate-400 leading-snug">{preset.blurb}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <Palette className="text-amber-400" size={18} />
                <h3 className="text-white font-semibold">Customise Template</h3>
              </div>
              <p className="text-xs text-slate-400">These styles apply to all cards—detected from CSV or added manually.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">School / Org Name</label>
                  <input
                    value={templateSettings.brandName}
                    onChange={(e) => updateTemplateSetting('brandName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="School / Org name"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">Tagline</label>
                  <input
                    value={templateSettings.brandTagline}
                    onChange={(e) => updateTemplateSetting('brandTagline', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="Tagline or subtext"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">Badge Label</label>
                  <input
                    value={templateSettings.badgeLabel || ''}
                    onChange={(e) => updateTemplateSetting('badgeLabel', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="ID type (Student, Delegate...)"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">Contact</label>
                  <input
                    value={templateSettings.contactNumber}
                    onChange={(e) => updateTemplateSetting('contactNumber', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="+91 ..."
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 min-w-0">
                  <label className="text-xs text-slate-400">Address / Footer Line</label>
                  <input
                    value={templateSettings.address}
                    onChange={(e) => updateTemplateSetting('address', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="Address, city, state or any footer text"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 min-w-0">
                  <label className="text-xs text-slate-400">Signature Line</label>
                  <input
                    value={templateSettings.footerNote}
                    onChange={(e) => updateTemplateSetting('footerNote', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="Authorized signatory / footer note"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">Primary Color</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={templateSettings.primaryColor}
                      onChange={(e) => updateTemplateSetting('primaryColor', e.target.value)}
                      className="w-12 h-10 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Pick primary color"
                    />
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((swatch) => {
                        const isActive = swatch.toLowerCase() === (templateSettings.primaryColor || '').toLowerCase();
                        return (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => updateTemplateSetting('primaryColor', swatch)}
                            className={`w-8 h-8 rounded-lg border transition-all ${isActive ? 'border-white ring-2 ring-indigo-400' : 'border-slate-600 hover:border-slate-400'}`}
                            style={{ background: swatch }}
                            aria-label={`Set primary color ${swatch}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-xs text-slate-400">Accent Color</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={templateSettings.accentColor}
                      onChange={(e) => updateTemplateSetting('accentColor', e.target.value)}
                      className="w-12 h-10 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                      aria-label="Pick accent color"
                    />
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((swatch) => {
                        const isActive = swatch.toLowerCase() === (templateSettings.accentColor || '').toLowerCase();
                        return (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => updateTemplateSetting('accentColor', swatch)}
                            className={`w-8 h-8 rounded-lg border transition-all ${isActive ? 'border-white ring-2 ring-indigo-400' : 'border-slate-600 hover:border-slate-400'}`}
                            style={{ background: swatch }}
                            aria-label={`Set accent color ${swatch}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-400" size={18} />
                  <h3 className="text-white font-semibold">Auto Field Detection</h3>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <button
                    onClick={() => {
                      const name = prompt('Add a new field label (will be available on all cards)');
                      if (name) handleAddCustomField(name);
                    }}
                    className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-200 border border-slate-600 hover:border-emerald-400 hover:text-white transition-colors"
                  >
                    + Add field
                  </button>
                  {hiddenFields.size > 0 && detectedFields.length > 0 && (
                    <button
                      onClick={handleRestoreHiddenFields}
                      className="px-2 py-1 rounded-md bg-slate-700 text-slate-200 border border-slate-600 hover:border-emerald-400 hover:text-white transition-colors"
                    >
                      Show hidden ({hiddenFields.size})
                    </button>
                  )}
                  <span>{attendees.length ? `${detectedFields.length} mapped` : 'Awaiting upload'}</span>
                </div>
              </div>

              {attendees.length === 0 ? (
                <div className="text-sm text-slate-400 leading-relaxed">
                  No cards yet. Upload an Excel/CSV or add a card manually to see detected fields.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {detectedFields.length > 0 ? (
                      detectedFields.map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => setSearchTerm(field)}
                          className="group inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors"
                          title="Filter cards by this field name"
                        >
                          <span>{field}</span>
                          <span
                            onClick={(e) => { e.stopPropagation(); handleHideDetectedField(field); }}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-emerald-400/60 text-[10px] text-emerald-200 group-hover:border-emerald-200 group-hover:text-emerald-50"
                            aria-label={`Hide ${field}`}
                          >
                            ×
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 leading-relaxed">
                        No fields detected yet for the current cards.
                      </p>
                    )}
                  </div>
                  {detectedFields.length > 0 && (
                    <div className="mt-2 text-xs text-slate-400">Tap a field to filter cards, or hit × to hide it from cards.</div>
                  )}
                </>
              )}
              <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-white font-semibold">Missing someone from the upload?</p>
                  <p className="text-xs text-slate-400">Add a card manually with the same template styling.</p>
                </div>
                <button
                  onClick={handleAddManualClick}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold shadow-lg shadow-emerald-500/30 transition-all"
                >
                  <Plus size={16} /> Add Card
                </button>
              </div>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col xl:flex-row gap-4 items-center justify-between sticky top-24 z-40 shadow-xl">

            {/* Search & Filter Group */}
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 text-white pl-10 pr-4 py-2.5 rounded-lg border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Filter size={18} className="text-slate-500 flex-shrink-0" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-900 text-slate-300 border border-slate-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[150px]"
                >
                  {uniquePassTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsMinimalView(!isMinimalView)}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-2.5 rounded-lg transition-all text-sm font-medium border border-slate-600"
              >
                <span>Minimal View</span>
              </button>
            </div>

            {/* Selection & Bulk Actions Group */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full xl:w-auto justify-between xl:justify-end border-t xl:border-t-0 border-slate-700 pt-4 xl:pt-0">
              <div className="flex items-center gap-3 flex-wrap w-full">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-slate-300 hover:text-white font-medium text-sm transition-colors"
                >
                  {isAllSelected ? <CheckSquare size={20} className="text-indigo-500" /> : <Square size={20} />}
                  Select All
                </button>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Format</span>
                  <select
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value as 'png' | 'jpg')}
                    className="bg-transparent text-white text-sm outline-none"
                  >
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex-1 min-w-[240px]">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Filename</span>
                  <input
                    type="text"
                    value={filenameTemplate}
                    onChange={(e) => setFilenameTemplate(e.target.value)}
                    placeholder="{name}_IDCARD"
                    title="Use placeholders like {name}, {company}, {registrationId}, {schoolId}, {passType}, {role}"
                    className="bg-transparent text-white text-sm outline-none w-full placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg shadow-emerald-600/20 ${isDownloading ? 'opacity-70 cursor-wait' : ''}`}
                >
                  <DownloadCloud size={16} />
                  <span className="hidden sm:inline">
                    {isDownloading ? 'Zipping...' : selectedIds.size > 0 ? `Download (${selectedIds.size})` : 'Download All'}
                  </span>
                </button>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

                    <button
                      onClick={handleBulkEditClick}
                      className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 hover:text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-indigo-500/30"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-3 py-2 rounded-lg transition-colors text-sm font-medium border border-red-500/30"
                    >
                      <Trash2 size={14} />
                    </button>

                    <button
                      onClick={handleDeleteAll}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-red-600/20"
                    >
                      Delete All
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between text-slate-400 text-sm px-1">
            <span>Showing {filteredAttendees.length} cards</span>
          </div>
        </div>

        {/* Card Grid or Minimal List */}
        {filteredAttendees.length > 0 ? (
          isMinimalView ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Select</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Name</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">School ID</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Class</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Company</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Pass Type</th>
                    <th className="px-4 py-3 text-slate-300 font-medium text-sm">Registration ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.map((attendee) => (
                    <tr key={attendee.id} className="border-t border-slate-700 hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelection(attendee.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {selectedIds.has(attendee.id) ? <CheckSquare size={20} className="text-indigo-500" /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{attendee.name}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{attendee.schoolId || attendee.registrationId}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{attendee.className || attendee.passType}</td>
                      <td className="px-4 py-3 text-slate-300">{attendee.company}</td>
                      <td className="px-4 py-3 text-slate-300">{attendee.passType}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{attendee.registrationId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-items-center print:block print:w-full print:gap-0">
              {filteredAttendees.map((attendee) => (
                <div key={attendee.id} className="print:inline-block print:m-4 print:align-top">
                  <IDCard
                    data={attendee}
                    isSelected={selectedIds.has(attendee.id)}
        onToggleSelect={() => toggleSelection(attendee.id)}
        onEdit={() => handleEditClick(attendee)}
        onFieldEdit={(fieldKey) => handleFieldEditClick(attendee, fieldKey)}
        onImageUpload={(file) => handleImageUpload(attendee.id, file)}
        onLogoUpload={handleLogoUpload}
        onDelete={() => handleDeleteAttendee(attendee.id)}
        downloadFormat={downloadFormat}
                    filenameTemplate={filenameTemplate}
                    template={cardTemplate}
                    templateSettings={templateSettings}
                    hiddenFields={hiddenFields}
                    onColorChange={handleColorChange}
                    onPrincipalSignUpload={handlePrincipalSignUpload}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 bg-slate-800/50 rounded-3xl border border-slate-800 border-dashed">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4 text-slate-500">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No attendees found</h3>
            <p className="text-slate-500 max-w-md mx-auto">Try adjusting your search terms or filters, or upload a new data file.</p>
          </div>
        )}

      </main>

      {/* Edit Modal */}
      <EditModal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        attendee={editingAttendee}
        isBulk={isBulkEdit}
        count={selectedIds.size}
        onSave={handleSaveEdit}
        customFields={customFields}
        onAddCustomField={handleAddCustomField}
        onDeleteCustomField={handleDeleteCustomField}
        template={cardTemplate}
        focusedField={focusedField}
        onClearFocus={() => setFocusedField(null)}
      />
      {inlineEdit.attendee && inlineEdit.fieldKey && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setInlineEdit({ attendee: null, fieldKey: null, value: '' })}></div>
          <div className="relative w-full max-w-md bg-slate-900/80 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-300">Quick Edit</p>
                <h3 className="text-lg font-bold text-white">{inlineEdit.attendee.name}</h3>
              </div>
              <button
                className="text-slate-300 hover:text-white"
                onClick={() => setInlineEdit({ attendee: null, fieldKey: null, value: '' })}
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {inlineEdit.fieldKey.startsWith('custom:') ? inlineEdit.fieldKey.replace('custom:', '') : inlineEdit.fieldKey}
              </label>
              <input
                type="text"
                value={inlineEdit.value}
                onChange={(e) => setInlineEdit((prev) => ({ ...prev, value: e.target.value }))}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={() => setInlineEdit({ attendee: null, fieldKey: null, value: '' })}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                onClick={async () => {
                  if (!token || !inlineEdit.attendee || !inlineEdit.fieldKey) return;
                  const key = inlineEdit.fieldKey;
                  const payload: Partial<Attendee> = {};
                  if (key.startsWith('custom:')) {
                    const label = key.replace('custom:', '');
                    payload.extraFields = { ...(inlineEdit.attendee.extraFields || {}), [label]: inlineEdit.value };
                  } else if (key === 'validity') {
                    payload.validFrom = inlineEdit.value;
                  } else {
                    (payload as any)[key] = inlineEdit.value;
                  }
                  try {
                    await apiUpdateAttendee(token, inlineEdit.attendee.id, payload);
                    await loadAttendees();
                  } catch (err) {
                    console.error('Quick edit failed', err);
                  } finally {
                    setInlineEdit({ attendee: null, fieldKey: null, value: '' });
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
