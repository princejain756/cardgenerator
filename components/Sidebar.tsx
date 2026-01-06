import React, { useRef, useState } from 'react';
import {
    Layers,
    Palette,
    Settings,
    ChevronLeft,
    ChevronRight,
    Upload,
    Download,
    Printer,
    LogOut,
    Users,
    Check,
    Sparkles,
    Images,
    Info,
    X,
    Trash2,
    Bookmark,
    GraduationCap,
    Briefcase,
    Award,
    School,
    Star,
    Heart,
    Crown,
    Shield,
    Zap
} from 'lucide-react';
import { BadgeTemplate, CardTheme, DEFAULT_THEMES, SavedTemplate } from '../types';

interface SidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    activeTemplate: BadgeTemplate;
    onTemplateChange: (template: BadgeTemplate) => void;
    activeTheme: CardTheme;
    onThemeChange: (theme: CardTheme) => void;
    onImport: () => void;
    onDownload: () => void;
    onPrint: () => void;
    onLogout: () => void;
    onOpenEditor: () => void;
    onBulkImageUpload: (files: FileList) => void;
    savedTemplates?: SavedTemplate[];
    onLoadTemplate?: (template: SavedTemplate) => void;
    onDeleteTemplate?: (id: string) => void;
    onEditTemplate?: (template: SavedTemplate) => void;
    selectedSavedTemplateId?: string | null;
    username: string;
    userRole: string;
    attendeeCount: number;
    isProcessing?: boolean;
}

const templateOptions: { id: BadgeTemplate; name: string; icon: string; desc: string }[] = [
    { id: 'conference', name: 'Conference', icon: '🎫', desc: 'Events & conferences' },
    { id: 'school-classic', name: 'School ID', icon: '🎓', desc: 'Student ID cards' },
    { id: 'company-id', name: 'Corporate', icon: '💼', desc: 'Employee badges' },
];

export const Sidebar: React.FC<SidebarProps> = ({
    isCollapsed,
    onToggleCollapse,
    activeTemplate,
    onTemplateChange,
    activeTheme,
    onThemeChange,
    onImport,
    onDownload,
    onPrint,
    onLogout,
    onOpenEditor,
    onBulkImageUpload,
    savedTemplates = [],
    onLoadTemplate,
    onDeleteTemplate,
    onEditTemplate,
    selectedSavedTemplateId = null,
    username,
    userRole,
    attendeeCount,
    isProcessing = false,
}) => {
    const bulkImageInputRef = useRef<HTMLInputElement>(null);
    const [showBulkHelp, setShowBulkHelp] = useState(false);

    const getIconComponent = (iconName: string) => {
        switch (iconName) {
            case 'school': return <School size={16} />;
            case 'graduation': return <GraduationCap size={16} />;
            case 'briefcase': return <Briefcase size={16} />;
            case 'award': return <Award size={16} />;
            case 'users': return <Users size={16} />;
            case 'star': return <Star size={16} />;
            case 'heart': return <Heart size={16} />;
            case 'crown': return <Crown size={16} />;
            case 'shield': return <Shield size={16} />;
            case 'zap': return <Zap size={16} />;
            case 'sparkles': return <Sparkles size={16} />;
            default: return <Bookmark size={16} />;
        }
    };

    const handleBulkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onBulkImageUpload(files);
        }
        if (bulkImageInputRef.current) {
            bulkImageInputRef.current.value = '';
        }
    };
    return (
        <aside className={`sidebar custom-scrollbar no-print transition-all duration-200 flex flex-col ${isCollapsed ? 'w-16' : 'w-72'}`}>
            {/* Logo & Collapse */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className={`flex items-center gap-3 ${isCollapsed ? 'hidden' : ''}`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Users className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">AgileID<span className="text-indigo-400">Pro</span></h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Card Generator</p>
                    </div>
                </div>
                {isCollapsed && (
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto">
                        <Users className="text-white" size={20} />
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    className={`p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors ${isCollapsed ? 'mx-auto mt-3' : ''}`}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Stats */}
            {!isCollapsed && (
                <div className="p-4 border-b border-white/5 animate-fade-in">
                    <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-xl p-4 border border-indigo-500/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Cards</p>
                                <p className="text-3xl font-black text-white">{attendeeCount}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                <Sparkles className="text-indigo-400" size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className={`sidebar-section p-4 ${isCollapsed ? 'flex flex-col items-center gap-2' : ''}`}>
                {!isCollapsed && <p className="sidebar-section-title">Quick Actions</p>}
                <div className={`${isCollapsed ? 'flex flex-col gap-2' : 'grid grid-cols-3 gap-2'}`}>
                    <button
                        onClick={onImport}
                        disabled={isProcessing}
                        className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-all group"
                        title="Import Data"
                    >
                        <Upload size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="text-[10px] text-slate-400">Import</span>}
                    </button>
                    <button
                        onClick={onDownload}
                        className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-all group"
                        title="Download All"
                    >
                        <Download size={18} className="text-sky-400 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="text-[10px] text-slate-400">Download</span>}
                    </button>
                    <button
                        onClick={onPrint}
                        className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-all group"
                        title="Print Cards"
                    >
                        <Printer size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="text-[10px] text-slate-400">Print</span>}
                    </button>
                </div>
            </div>

            {/* Templates */}
            <div className={`sidebar-section p-4 flex-1 ${isCollapsed ? 'hidden' : ''}`}>
                <p className="sidebar-section-title flex items-center gap-2">
                    <Layers size={12} /> Templates
                </p>
                <div className="space-y-2">
                    {templateOptions.map(tmpl => {
                        const isSelected = activeTemplate === tmpl.id && !selectedSavedTemplateId;
                        return (
                            <button
                                key={tmpl.id}
                                onClick={() => onTemplateChange(tmpl.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected
                                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                    : 'bg-slate-800/30 border-slate-700/50 text-slate-300 hover:bg-slate-700/50'
                                    }`}
                            >
                                <span className="text-xl">{tmpl.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{tmpl.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{tmpl.desc}</p>
                                </div>
                                {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                        <Check size={12} className="text-white" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Customize Layout Button */}
                <button
                    onClick={onOpenEditor}
                    className="w-full mt-3 p-3 rounded-xl border-2 border-dashed border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 text-sm"
                >
                    <Settings size={16} />
                    Customize Layout
                </button>

                {/* Bulk Add Images Button */}
                <input
                    type="file"
                    ref={bulkImageInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleBulkImageChange}
                />
                <div className="flex items-center gap-2 mt-2">
                    <button
                        onClick={() => bulkImageInputRef.current?.click()}
                        className="flex-1 p-3 rounded-xl border-2 border-dashed border-emerald-600/50 hover:border-emerald-500 bg-emerald-500/5 text-emerald-400 hover:text-emerald-300 transition-all flex items-center justify-center gap-2 text-sm"
                        title="Upload images named 0, 1, 2, etc. to match cards in order"
                    >
                        <Images size={16} />
                        Bulk Add Images
                    </button>
                    <button
                        onClick={() => setShowBulkHelp(true)}
                        className="p-3 rounded-xl border border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 transition-all"
                        title="How bulk upload works"
                    >
                        <Info size={16} />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-center">Replaces default Photo element only</p>

                {/* Bulk Upload Help Modal */}
                {showBulkHelp && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Images size={20} className="text-emerald-400" />
                                    Bulk Image Upload
                                </h3>
                                <button
                                    onClick={() => setShowBulkHelp(false)}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-emerald-400 font-semibold mb-2">📋 How It Works</h4>
                                    <ol className="text-slate-300 space-y-2 list-decimal list-inside">
                                        <li>First, import your attendee data (Excel/CSV)</li>
                                        <li>Name your images: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300">0.jpg</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300">1.jpg</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300">2.jpg</code>...</li>
                                        <li>Click "Bulk Add Images" and select all</li>
                                        <li>Images match cards in order automatically!</li>
                                    </ol>
                                </div>

                                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30">
                                    <h4 className="text-amber-400 font-semibold mb-2">⚠️ Important Notes</h4>
                                    <ul className="text-slate-300 space-y-1 text-xs">
                                        <li>• Only replaces the <strong>default Photo</strong> element</li>
                                        <li>• Custom photo elements added via Template Editor are not affected</li>
                                        <li>• Images are auto-compressed to under 200KB</li>
                                        <li>• File names must contain numbers (0, 1, 2...)</li>
                                    </ul>
                                </div>

                                <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/30">
                                    <h4 className="text-indigo-400 font-semibold mb-2">💡 Example</h4>
                                    <div className="text-xs text-slate-400 font-mono">
                                        <div className="flex justify-between"><span>0.jpg</span> <span>→ Card 1 (First attendee)</span></div>
                                        <div className="flex justify-between"><span>1.jpg</span> <span>→ Card 2 (Second attendee)</span></div>
                                        <div className="flex justify-between"><span>2.jpg</span> <span>→ Card 3 (Third attendee)</span></div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowBulkHelp(false)}
                                className="w-full mt-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                )}

                {/* Saved Templates */}
                {savedTemplates.length > 0 && (
                    <>
                        <p className="sidebar-section-title flex items-center gap-2 mt-4">
                            <Bookmark size={12} /> Saved Templates
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {savedTemplates.map(tmpl => {
                                const isSelected = selectedSavedTemplateId === tmpl.id;
                                return (
                                    <div
                                        key={tmpl.id}
                                        className={`group relative flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                                            ? 'bg-indigo-600/20 border-indigo-500/40 ring-2 ring-indigo-500/30'
                                            : tmpl.isOwner
                                                ? 'bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/50'
                                                : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                                            }`}
                                        onClick={() => onLoadTemplate && onLoadTemplate(tmpl)}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected
                                            ? 'bg-indigo-500/20 text-indigo-300'
                                            : tmpl.isOwner
                                                ? 'bg-indigo-500/10 text-indigo-400'
                                                : 'bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                            {getIconComponent(tmpl.icon)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className={`font-medium text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{tmpl.name}</p>
                                                {tmpl.visibility === 'public' && (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                                                        🌍
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                {tmpl.isOwner
                                                    ? `Based on ${templateOptions.find(t => t.id === tmpl.baseTemplate)?.name || 'Custom'}`
                                                    : `By ${tmpl.ownerName || 'Unknown'}`
                                                }
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                                                <Check size={12} className="text-white" />
                                            </div>
                                        )}
                                        {!isSelected && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditTemplate && onEditTemplate(tmpl);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10"
                                                    title="Customize Layout"
                                                >
                                                    <Settings size={14} />
                                                </button>
                                                {tmpl.isOwner && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteTemplate && onDeleteTemplate(tmpl.id);
                                                        }}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                                                        title="Delete Template"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Theme Colors */}
            <div className={`sidebar-section p-4 ${isCollapsed ? 'hidden' : ''}`}>
                <p className="sidebar-section-title flex items-center gap-2">
                    <Palette size={12} /> Theme Colors
                </p>
                <div className="flex flex-wrap gap-2">
                    {DEFAULT_THEMES.map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => onThemeChange(theme)}
                            className={`color-swatch bg-gradient-to-br ${theme.headerGradient} ${activeTheme.id === theme.id ? 'active' : ''
                                }`}
                            title={theme.name}
                        />
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Active: {activeTheme.name}</p>
            </div>

            {/* User / Footer */}
            <div className={`mt-auto p-4 border-t border-white/5 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                {!isCollapsed ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold uppercase">
                                {username.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">{username}</p>
                                <p className="text-[10px] text-indigo-400 uppercase">{userRole}</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onLogout}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                )}
            </div>
        </aside>
    );
};
