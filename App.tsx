import React, { useState, useMemo, useEffect, useRef } from 'react';
import { KeyRound, Search, AlertCircle } from 'lucide-react';
import { IDCard } from './components/IDCard';
import { EditModal } from './components/EditModal';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { TemplateEditor } from './components/TemplateEditor';
import { parseTSVData } from './utils/parser';
import { Attendee, User, BadgeTemplate, CardTheme, TemplateLayout, DEFAULT_THEMES, DEFAULT_LAYOUTS, SavedTemplate } from './types';
import { analyzeDemographics, analyzeFileWithMistral } from './services/mistralService';
import * as XLSX from 'xlsx';
import { toJpeg, toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { buildCardFilename } from './utils/filename';
import {
  login as apiLogin,
  fetchMe,
  fetchAttendees as apiFetchAttendees,
  importAttendees,
  updateAttendee as apiUpdateAttendee,
  bulkUpdateAttendees,
  deleteAttendee as apiDeleteAttendee,
  deleteAllAttendees as apiDeleteAllAttendees,
  createUser as apiCreateUser,
  fetchSavedTemplates as apiFetchSavedTemplates,
  deleteTemplate as apiDeleteTemplate
} from './services/api';

const App: React.FC = () => {
  // =============== STATE ===============
  // Auth
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });

  // Data
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');
  const [filenameTemplate] = useState('{name}_IDCARD');

  // Template & Theme - Load from localStorage for persistence
  const [activeTemplate, setActiveTemplate] = useState<BadgeTemplate>(() => {
    const saved = localStorage.getItem('agileIdActiveTemplate');
    return (saved as BadgeTemplate) || 'conference';
  });
  const [activeTheme, setActiveTheme] = useState<CardTheme>(DEFAULT_THEMES[0]);
  const [customLayout, setCustomLayout] = useState<TemplateLayout>(() => {
    const savedLayout = localStorage.getItem('agileIdCustomLayout');
    if (savedLayout) {
      try { return JSON.parse(savedLayout); } catch { /* ignore */ }
    }
    const savedTemplate = localStorage.getItem('agileIdActiveTemplate');
    return DEFAULT_LAYOUTS[(savedTemplate as BadgeTemplate) || 'conference'];
  });
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<string>('');

  // School branding (for school template)
  const [schoolBranding, setSchoolBranding] = useState({
    name: '',
    address: '',
    phone: '',
    tagline: 'Govt. Recognised'
  });

  // Modals & Loading
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // =============== EFFECTS ===============
  const loadSavedTemplates = async () => {
    if (!token) return;
    try {
      const templates = await apiFetchSavedTemplates(token);
      setSavedTemplates(templates);
    } catch (err) {
      console.error('Failed to load saved templates', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadSavedTemplates();
    }
  }, [token]);

  const loadAttendees = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    try {
      const data = await apiFetchAttendees(activeToken);
      setAttendees(data);
    } catch (err) {
      console.error('Failed to load attendees', err);
    }
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
  }, [token]);

  // Update layout when template changes
  useEffect(() => {
    setCustomLayout(DEFAULT_LAYOUTS[activeTemplate]);
  }, [activeTemplate]);

  // =============== AUTH HANDLERS ===============
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

  // =============== FILE HANDLERS ===============
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setIsProcessingFile(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    try {
      let fileContent = '';
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        fileContent = XLSX.utils.sheet_to_csv(firstSheet);
      } else {
        fileContent = await file.text();
      }

      const parsedData = await analyzeFileWithMistral(fileContent, fileExtension || 'txt', customLabels, activeTemplate);

      const attendeeData: Attendee[] = parsedData.map((item, index) => ({
        id: `att-${Date.now()}-${index}`,
        name: item.name,
        company: item.company || item.schoolName || 'Self',
        passType: item.passType || (activeTemplate === 'school-classic' ? 'Student ID' : 'General Entry'),
        registrationId: item.registrationId || item.schoolId || `AUTO_${index + 1}`,
        role: item.role || (activeTemplate === 'school-classic' ? 'Student' : 'Attendee'),
        tracks: item.tracks || [],
        schoolId: item.schoolId,
        schoolName: item.schoolName,
        fatherName: item.fatherName,
        motherName: item.motherName,
        dateOfBirth: item.dateOfBirth,
        contactNumber: item.contactNumber,
        address: item.address,
        className: item.className,
        section: item.section,
        emergencyContact: item.emergencyContact,
        extras: item.extras || {},
        // Use the user's selected template, not auto-detected
        template: activeTemplate
      }));

      // If school template is selected and we have school data, update branding
      if (activeTemplate === 'school-classic') {
        const firstRecord = attendeeData[0];
        if (firstRecord) {
          setSchoolBranding(prev => ({
            name: prev.name || firstRecord.schoolName || firstRecord.company || '',
            address: prev.address || firstRecord.address || '',
            phone: prev.phone || firstRecord.contactNumber || '',
            tagline: prev.tagline || 'Govt. Recognised'
          }));
        }
      }

      await importAttendees(token, attendeeData);
      setAttendees(attendeeData);
      setSelectedIds(new Set());
      await loadAttendees(token);
    } catch (error) {
      console.error('File processing error:', error);
      // Fallback to basic parsing
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseTSVData(text);
        importAttendees(token, parsed)
          .then(() => {
            setAttendees(parsed);
            setSelectedIds(new Set());
          })
          .catch((err) => console.error('Import failed', err));
      };
      reader.readAsText(file);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // =============== SELECTION HANDLERS ===============
  const filteredAttendees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return attendees.filter(a => {
      const matchesSearch =
        (a.name || '').toLowerCase().includes(term) ||
        (a.company || a.schoolName || '').toLowerCase().includes(term) ||
        (a.registrationId || a.schoolId || '').toLowerCase().includes(term);
      const matchesFilter = filterType === 'All' || (a.passType || '').toLowerCase().includes(filterType.toLowerCase());
      return matchesSearch && matchesFilter;
    });
  }, [attendees, searchTerm, filterType]);

  const uniquePassTypes = useMemo(() => {
    const types = new Set(attendees.map(a => a.passType));
    return ['All', ...Array.from(types)];
  }, [attendees]);

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
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAttendees.map(a => a.id)));
    }
  };

  // =============== EDIT HANDLERS ===============
  const handleEditClick = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    setIsBulkEdit(false);
    setEditModalOpen(true);
  };

  const handleBulkEditClick = () => {
    setEditingAttendee(null);
    setIsBulkEdit(true);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (updatedData: Partial<Attendee>) => {
    if (!token) return;
    try {
      if (isBulkEdit) {
        await bulkUpdateAttendees(token, Array.from(selectedIds), updatedData);
        await loadAttendees();
        setSelectedIds(new Set());
      } else if (editingAttendee) {
        await apiUpdateAttendee(token, editingAttendee.id, updatedData);
        await loadAttendees();
      }
    } catch (err) {
      console.error('Failed to save edits', err);
    }
  };

  const handleImageUpload = async (id: string, file: File) => {
    try {
      // Import compression utility dynamically
      const { compressImage } = await import('./utils/imageCompression');
      const compressedImage = await compressImage(file);

      setAttendees(prev => prev.map(a => a.id === id ? { ...a, image: compressedImage } : a));
      if (token) {
        apiUpdateAttendee(token, id, { image: compressedImage }).catch(err => console.error('Failed to save image', err));
      }
    } catch (err) {
      console.error('Image compression failed, using original:', err);
      // Fallback to original method
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAttendees(prev => prev.map(a => a.id === id ? { ...a, image: result } : a));
        if (token) {
          apiUpdateAttendee(token, id, { image: result }).catch(err => console.error('Failed to save image', err));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // =============== BULK IMAGE UPLOAD ===============
  const handleBulkImageUpload = async (files: FileList) => {
    if (attendees.length === 0) {
      alert('Please import attendee data first before adding images.');
      return;
    }

    try {
      const { compressImage } = await import('./utils/imageCompression');

      let successCount = 0;
      let errorCount = 0;

      // Process each image file
      for (const file of Array.from(files)) {
        // Extract number from filename (e.g., "0.png" -> 0, "1.jpg" -> 1, "photo_5.png" -> 5)
        const match = file.name.match(/(\d+)/);
        if (!match) {
          console.warn(`No number found in filename: ${file.name}`);
          errorCount++;
          continue;
        }

        const index = parseInt(match[1], 10);
        const matchingAttendee = attendees[index];

        if (!matchingAttendee) {
          console.warn(`No attendee at index ${index} for file ${file.name}`);
          errorCount++;
          continue;
        }

        try {
          // Compress the image
          const compressedImage = await compressImage(file);

          // Update the attendee with the image
          setAttendees(prev => prev.map(a =>
            a.id === matchingAttendee.id ? { ...a, image: compressedImage } : a
          ));

          // Save to API
          if (token) {
            apiUpdateAttendee(token, matchingAttendee.id, { image: compressedImage })
              .catch(err => console.error(`Failed to save image for attendee ${index}:`, err));
          }

          successCount++;
        } catch (err) {
          console.error(`Failed to process image ${file.name}:`, err);
          errorCount++;
        }
      }

      alert(`Bulk upload complete!\n✓ ${successCount} images added\n${errorCount > 0 ? `✗ ${errorCount} not matched (filename number must match card index: 0, 1, 2...)` : ''}`);

    } catch (err) {
      console.error('Bulk image upload failed:', err);
      alert('Failed to process images. Please try again.');
    }
  };

  const handleLoadTemplate = (template: SavedTemplate) => {
    setActiveTemplate(template.baseTemplate);
    setCustomLayout(template.layout);
    if (template.theme) {
      setActiveTheme(template.theme);
    }
    if (template.customLabels) {
      setCustomLabels(template.customLabels);
    } else {
      setCustomLabels({});
    }
    setSelectedSavedTemplateId(template.id);
    setEditingTemplateName(template.name);
    // Don't auto-open editor - just apply the template like default templates
  };

  const handleDefaultTemplateChange = (template: BadgeTemplate) => {
    setActiveTemplate(template);
    setSelectedSavedTemplateId(null); // Clear saved template selection
    setEditingTemplateName('');
    setCustomLayout(DEFAULT_LAYOUTS[template]);
    setCustomLabels({});
    // Save to localStorage for persistence
    localStorage.setItem('agileIdActiveTemplate', template);
    localStorage.setItem('agileIdCustomLayout', JSON.stringify(DEFAULT_LAYOUTS[template]));
  };

  const handleEditTemplate = (template: SavedTemplate) => {
    // First apply the template settings
    setActiveTemplate(template.baseTemplate);
    setCustomLayout(template.layout);
    if (template.theme) {
      setActiveTheme(template.theme);
    }
    if (template.customLabels) {
      setCustomLabels(template.customLabels);
    } else {
      setCustomLabels({});
    }
    setSelectedSavedTemplateId(template.id);
    setEditingTemplateName(template.name);
    // Then open the editor
    setTemplateEditorOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!token || !confirm('Are you sure you want to delete this template?')) return;
    try {
      await apiDeleteTemplate(token, templateId);
      await loadSavedTemplates();
    } catch (err) {
      console.error('Failed to delete template', err);
      alert('Failed to delete template');
    }
  };

  // =============== DELETE HANDLERS ===============
  const handleBulkDelete = async () => {
    if (!token || !confirm(`Delete ${selectedIds.size} attendees?`)) return;
    for (const id of selectedIds) {
      await apiDeleteAttendee(token, id).catch(err => console.error(err));
    }
    await loadAttendees();
    setSelectedIds(new Set());
  };

  const handleDeleteAttendee = async (id: string) => {
    if (!token || !confirm('Delete this attendee?')) return;
    await apiDeleteAttendee(token, id);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    await loadAttendees();
  };

  // =============== DOWNLOAD HANDLERS ===============
  const renderCardImage = async (node: HTMLElement) => {
    const options = {
      quality: 0.95,
      pixelRatio: 2,
      filter: (n: HTMLElement) => !n.classList?.contains('no-export')
    };
    return downloadFormat === 'jpg' ? toJpeg(node, options) : toPng(node, options);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    const targetAttendees = selectedIds.size > 0
      ? filteredAttendees.filter(a => selectedIds.has(a.id))
      : filteredAttendees;

    try {
      for (const attendee of targetAttendees) {
        const node = document.getElementById(`card-${attendee.id}`);
        if (node) {
          try {
            const dataUrl = await renderCardImage(node);
            const base64Data = dataUrl.split(',')[1];
            const filename = buildCardFilename(attendee, filenameTemplate, downloadFormat);
            zip.file(filename, base64Data, { base64: true });
          } catch (err) {
            console.error(`Error processing ${attendee.name}:`, err);
          }
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'AgileID_Cards.zip');
    } catch (error) {
      console.error('ZIP failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // =============== RENDER: LOADING ===============
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <div className="w-3 h-3 bg-indigo-400 rounded-full animate-ping" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  // =============== RENDER: LOGIN ===============
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <KeyRound size={24} className="text-white" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Welcome to</p>
              <h1 className="text-2xl font-bold text-white">AgileID<span className="text-indigo-400">Pro</span></h1>
            </div>
          </div>

          {authError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Username</label>
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-60"
          >
            {authLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  // =============== RENDER: MAIN APP ===============
  const isAllSelected = filteredAttendees.length > 0 && selectedIds.size === filteredAttendees.length;

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".txt,.tsv,.csv,.xlsx,.xls,.md"
        onChange={handleFileUpload}
      />

      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTemplate={activeTemplate}
        onTemplateChange={handleDefaultTemplateChange}
        activeTheme={activeTheme}
        onThemeChange={setActiveTheme}
        onImport={() => fileInputRef.current?.click()}
        onDownload={handleDownloadZip}
        onPrint={() => window.print()}
        onLogout={handleLogout}
        onOpenEditor={() => setTemplateEditorOpen(true)}
        onBulkImageUpload={handleBulkImageUpload}
        username={currentUser.username}
        userRole={currentUser.role}
        attendeeCount={attendees.length}
        isProcessing={isProcessingFile}
        savedTemplates={savedTemplates}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onEditTemplate={handleEditTemplate}
        selectedSavedTemplateId={selectedSavedTemplateId}
      />

      {/* Main Content */}
      <main className="bg-slate-900 min-h-screen flex flex-col">
        {/* Toolbar */}
        <Toolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterType={filterType}
          onFilterChange={setFilterType}
          filterOptions={uniquePassTypes}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAll}
          selectedCount={selectedIds.size}
          totalCount={filteredAttendees.length}
          onBulkEdit={handleBulkEditClick}
          onBulkDelete={handleBulkDelete}
          onDownloadSelected={handleDownloadZip}
          isDownloading={isDownloading}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          downloadFormat={downloadFormat}
          onDownloadFormatChange={setDownloadFormat}
        />

        {/* Cards Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredAttendees.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="card-grid p-6">
                {filteredAttendees.map(attendee => (
                  <div key={attendee.id} className="flex justify-center">
                    <IDCard
                      data={attendee}
                      isSelected={selectedIds.has(attendee.id)}
                      onToggleSelect={() => toggleSelection(attendee.id)}
                      onEdit={() => handleEditClick(attendee)}
                      onOpenTemplateEditor={() => setTemplateEditorOpen(true)}
                      onImageUpload={(file) => handleImageUpload(attendee.id, file)}
                      onDelete={() => handleDeleteAttendee(attendee.id)}
                      downloadFormat={downloadFormat}
                      filenameTemplate={filenameTemplate}
                      activeTemplate={activeTemplate}
                      accentGradient={activeTheme.headerGradient}
                      schoolBranding={schoolBranding}
                      username={currentUser?.username || 'user'}
                      layout={customLayout}
                      customLabels={customLabels}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Pass Type</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.map(attendee => (
                        <tr
                          key={attendee.id}
                          className="cursor-pointer hover:bg-slate-700/30"
                          onClick={() => handleEditClick(attendee)}
                        >
                          <td onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleSelection(attendee.id)} className="text-slate-400 hover:text-white">
                              {selectedIds.has(attendee.id) ? '☑' : '☐'}
                            </button>
                          </td>
                          <td className="text-white font-medium">{attendee.name}</td>
                          <td className="text-slate-300">{attendee.schoolName || attendee.company}</td>
                          <td className="text-slate-300">{attendee.passType}</td>
                          <td className="text-slate-400 text-sm font-mono">{attendee.registrationId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-6">
                  <Search size={32} className="text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No cards found</h3>
                <p className="text-slate-400">
                  {attendees.length === 0
                    ? 'Import data to get started. Click "Import" in the sidebar.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Template Editor Modal */}
      <TemplateEditor
        isOpen={templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        templateType={activeTemplate}
        currentLayout={customLayout}
        onSaveLayout={setCustomLayout}
        theme={activeTheme}
        onThemeChange={setActiveTheme}
        attendees={attendees}
        schoolBranding={schoolBranding}
        onImageUpload={handleImageUpload}
        customLabels={customLabels}
        editingTemplateId={selectedSavedTemplateId}
        editingTemplateName={editingTemplateName}
        onTemplateUpdated={loadSavedTemplates}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        attendee={editingAttendee}
        isBulk={isBulkEdit}
        count={selectedIds.size}
        onSave={handleSaveEdit}
      />
    </div>
  );
};

export default App;
