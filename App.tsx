import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Printer, Search, Users, Sparkles, Filter, X, CheckSquare, Square, Pencil, Trash2, DownloadCloud, LogOut, KeyRound, UserPlus } from 'lucide-react';
import { IDCard } from './components/IDCard';
import { EditModal } from './components/EditModal';
import { parseTSVData } from './utils/parser';
import { Attendee, User } from './types';
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
  createUser as apiCreateUser
} from './services/api';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

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
      const parsedData = await analyzeFileWithMistral(fileContent, fileExtension || 'txt');
      
      // Convert to Attendee format with unique IDs
      const attendeeData: Attendee[] = parsedData.map((item, index) => ({
        id: `att-${Date.now()}-${index}`,
        name: item.name,
        company: item.company,
        passType: item.passType,
        registrationId: item.registrationId,
        role: item.role || 'Attendee',
        tracks: item.tracks || []
      }));

      await importAttendees(token, attendeeData);
      setAttendees(attendeeData);
      setAiInsight(null);
      setSelectedIds(new Set());
      await loadAttendees(token);
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
        setSelectedIds(new Set()); // Clear selection after bulk edit
      } else if (editingAttendee) {
        await apiUpdateAttendee(token, editingAttendee.id, updatedData);
        await loadAttendees();
      }
    } catch (err) {
      console.error('Failed to save edits', err);
      alert('Failed to save changes.');
    }
  };

  // --- Image Upload Logic ---
  const handleImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setAttendees(prev => prev.map(a => 
        a.id === id ? { ...a, image: result } : a
      ));
      if (token) {
        apiUpdateAttendee(token, id, { image: result }).catch((err) => console.error('Failed to save image', err));
      }
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
                    <div className="mt-4 text-xs text-slate-500 flex gap-2">
                        <span className="text-green-400">● {attendees.filter(a => a.company !== 'Self').length} Corporate</span>
                        <span className="text-blue-400">● {attendees.filter(a => a.passType.toLowerCase().includes('lite')).length} Lite</span>
                    </div>
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
                                title="Use placeholders like {name}, {company}, {registrationId}, {passType}, {role}"
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
                            onImageUpload={(file) => handleImageUpload(attendee.id, file)}
                            onDelete={() => handleDeleteAttendee(attendee.id)}
                            downloadFormat={downloadFormat}
                            filenameTemplate={filenameTemplate}
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
