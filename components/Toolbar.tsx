import React from 'react';
import {
    Search,
    Filter,
    CheckSquare,
    Square,
    Pencil,
    Trash2,
    DownloadCloud,
    Grid3X3,
    List,
    X
} from 'lucide-react';

interface ToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterType: string;
    onFilterChange: (value: string) => void;
    filterOptions: string[];
    isAllSelected: boolean;
    onSelectAll: () => void;
    selectedCount: number;
    totalCount: number;
    onBulkEdit: () => void;
    onBulkDelete: () => void;
    onDownloadSelected: () => void;
    isDownloading: boolean;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    downloadFormat: 'png' | 'jpg';
    onDownloadFormatChange: (format: 'png' | 'jpg') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    searchTerm,
    onSearchChange,
    filterType,
    onFilterChange,
    filterOptions,
    isAllSelected,
    onSelectAll,
    selectedCount,
    totalCount,
    onBulkEdit,
    onBulkDelete,
    onDownloadSelected,
    isDownloading,
    viewMode,
    onViewModeChange,
    downloadFormat,
    onDownloadFormatChange,
}) => {
    return (
        <div className="no-print bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-30">
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search cards..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-slate-900/50 text-white pl-10 pr-10 py-2.5 rounded-xl border border-slate-700/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl border border-slate-700/50 px-3 py-1">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={filterType}
                        onChange={(e) => onFilterChange(e.target.value)}
                        className="bg-transparent text-slate-300 text-sm outline-none py-1.5 min-w-[120px]"
                    >
                        {filterOptions.map(option => (
                            <option key={option} value={option} className="bg-slate-800">{option}</option>
                        ))}
                    </select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-700/50 p-1">
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Grid View"
                    >
                        <Grid3X3 size={16} />
                    </button>
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="List View"
                    >
                        <List size={16} />
                    </button>
                </div>

                {/* Format Selector */}
                <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl border border-slate-700/50 px-3 py-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Format</span>
                    <select
                        value={downloadFormat}
                        onChange={(e) => onDownloadFormatChange(e.target.value as 'png' | 'jpg')}
                        className="bg-transparent text-white text-sm outline-none"
                    >
                        <option value="png" className="bg-slate-800">PNG</option>
                        <option value="jpg" className="bg-slate-800">JPG</option>
                    </select>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Selection & Actions */}
                <div className="flex items-center gap-3">
                    {/* Select All */}
                    <button
                        onClick={onSelectAll}
                        className="flex items-center gap-2 text-slate-300 hover:text-white font-medium text-sm transition-colors"
                    >
                        {isAllSelected ? (
                            <CheckSquare size={18} className="text-indigo-500" />
                        ) : (
                            <Square size={18} />
                        )}
                        <span className="hidden sm:inline">Select All</span>
                    </button>

                    {/* Count Badge */}
                    <div className="px-3 py-1.5 rounded-full bg-slate-700/50 text-sm">
                        <span className="text-slate-400">Showing</span>{' '}
                        <span className="text-white font-medium">{totalCount}</span>
                        {selectedCount > 0 && (
                            <>
                                <span className="text-slate-400"> • Selected</span>{' '}
                                <span className="text-indigo-400 font-medium">{selectedCount}</span>
                            </>
                        )}
                    </div>

                    {/* Bulk Actions (visible when items selected) */}
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <div className="w-px h-6 bg-slate-600" />
                            <button
                                onClick={onBulkEdit}
                                className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white transition-colors border border-indigo-500/30"
                                title="Edit Selected"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={onBulkDelete}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30"
                                title="Delete Selected"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}

                    {/* Download Button */}
                    <button
                        onClick={onDownloadSelected}
                        disabled={isDownloading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 ${isDownloading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-0.5'
                            }`}
                    >
                        <DownloadCloud size={16} />
                        <span className="hidden sm:inline">
                            {isDownloading ? 'Zipping...' : selectedCount > 0 ? `Download (${selectedCount})` : 'Download All'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
