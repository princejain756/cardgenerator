import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Move, Type, Image as ImageIcon, Hash, User, Building2, Save, RotateCcw, Eye, EyeOff, Upload, Camera, Palette, Plus, Layers, ChevronDown, ChevronRight, Pencil, Bookmark, GraduationCap, Briefcase, Award, Users, School, Star, Heart, Sparkles, Crown, Shield, Zap, Trash2 } from 'lucide-react';
import { TemplateLayout, ElementPosition, BadgeTemplate, CardTheme, DEFAULT_LAYOUTS, DEFAULT_THEMES, Attendee } from '../types';
import { compressImage } from '../utils/imageCompression';

interface TemplateEditorProps {
    isOpen: boolean;
    onClose: () => void;
    templateType: BadgeTemplate;
    currentLayout: TemplateLayout;
    onSaveLayout: (layout: TemplateLayout) => void;
    theme: CardTheme;
    onThemeChange?: (theme: CardTheme) => void;
    attendees: Attendee[];
    schoolBranding: {
        name: string;
        address: string;
        phone: string;
        tagline: string;
    };
    onImageUpload?: (id: string, file: File) => void;
    customLabels?: Record<string, string>;
    editingTemplateId?: string | null;
    editingTemplateName?: string;
    onTemplateUpdated?: () => void;
}

type ElementKey = keyof TemplateLayout;

interface DraggableElementData {
    key: ElementKey;
    label: string;
    icon: React.ReactNode;
    type: 'text' | 'photo';
}

const ELEMENTS: DraggableElementData[] = [
    { key: 'name', label: 'Name', icon: <Type size={14} />, type: 'text' },
    { key: 'image', label: 'Photo', icon: <ImageIcon size={14} />, type: 'photo' },
    { key: 'company', label: 'Company', icon: <Building2 size={14} />, type: 'text' },
    { key: 'registrationId', label: 'ID', icon: <Hash size={14} />, type: 'text' },
    { key: 'role', label: 'Role', icon: <User size={14} />, type: 'text' },
    { key: 'qrCode', label: 'QR Code', icon: <Hash size={14} />, type: 'photo' },
    { key: 'fatherName', label: "Father's Name", icon: <User size={14} />, type: 'text' },
    { key: 'motherName', label: "Mother's Name", icon: <User size={14} />, type: 'text' },
    { key: 'dateOfBirth', label: 'DOB', icon: <Hash size={14} />, type: 'text' },
    { key: 'className', label: 'Class', icon: <Hash size={14} />, type: 'text' },
    { key: 'contactNumber', label: 'Contact', icon: <Hash size={14} />, type: 'text' },
    { key: 'address', label: 'Address', icon: <Hash size={14} />, type: 'text' },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
    isOpen,
    onClose,
    templateType,
    currentLayout,
    onSaveLayout,
    theme,
    onThemeChange,
    attendees,
    schoolBranding,
    onImageUpload,
    customLabels: initialCustomLabels = {},
    editingTemplateId = null,
    editingTemplateName = '',
    onTemplateUpdated,
}) => {
    const [layout, setLayout] = useState<TemplateLayout>({ ...currentLayout });
    const [selectedElement, setSelectedElement] = useState<ElementKey | null>(null);
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [localTheme, setLocalTheme] = useState<CardTheme>(theme);
    const [customColor1, setCustomColor1] = useState('#4f46e5');
    const [customColor2, setCustomColor2] = useState('#0ea5e9');
    const [leftPanelTab, setLeftPanelTab] = useState<'colors' | 'elements'>('colors');
    const [textElementsOpen, setTextElementsOpen] = useState(true);
    const [photoElementsOpen, setPhotoElementsOpen] = useState(true);
    const [customTextCount, setCustomTextCount] = useState(0);
    const [customPhotoCount, setCustomPhotoCount] = useState(0);
    const [customElements, setCustomElements] = useState<DraggableElementData[]>([]);
    const [customLabels, setCustomLabels] = useState<Record<string, string>>(initialCustomLabels);
    const [editingLabel, setEditingLabel] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateIcon, setTemplateIcon] = useState('default');
    const [templateVisibility, setTemplateVisibility] = useState<'private' | 'public'>('private');
    const [isSaving, setIsSaving] = useState(false);
    const [customPhotoImages, setCustomPhotoImages] = useState<Record<string, string>>({});
    const canvasRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);
    const uploadingPhotoKey = useRef<string | null>(null);

    const ICON_OPTIONS = [
        { id: 'default', icon: <Bookmark size={20} />, label: 'Default' },
        { id: 'school', icon: <School size={20} />, label: 'School' },
        { id: 'graduation', icon: <GraduationCap size={20} />, label: 'Education' },
        { id: 'briefcase', icon: <Briefcase size={20} />, label: 'Corporate' },
        { id: 'award', icon: <Award size={20} />, label: 'Event' },
        { id: 'users', icon: <Users size={20} />, label: 'Conference' },
        { id: 'star', icon: <Star size={20} />, label: 'VIP' },
        { id: 'heart', icon: <Heart size={20} />, label: 'Special' },
        { id: 'crown', icon: <Crown size={20} />, label: 'Premium' },
        { id: 'shield', icon: <Shield size={20} />, label: 'Security' },
        { id: 'zap', icon: <Zap size={20} />, label: 'Quick' },
        { id: 'sparkles', icon: <Sparkles size={20} />, label: 'Custom' },
    ];

    useEffect(() => {
        setLayout({ ...currentLayout });
    }, [currentLayout, isOpen]);

    useEffect(() => {
        setLocalTheme(theme);
    }, [theme, isOpen]);

    useEffect(() => {
        setCustomLabels(initialCustomLabels);
    }, [initialCustomLabels, isOpen]);

    useEffect(() => {
        if (isOpen && attendees.length > 0 && !selectedAttendee) {
            setSelectedAttendee(attendees[0]);
        }
    }, [isOpen, attendees, selectedAttendee]);

    useEffect(() => {
        if (selectedAttendee?.image) {
            setPreviewImage(selectedAttendee.image);
        } else {
            setPreviewImage(null);
        }
    }, [selectedAttendee]);

    const handleThemePresetClick = (presetTheme: CardTheme) => {
        setLocalTheme(presetTheme);
    };

    const handleCustomGradient = () => {
        const customTheme: CardTheme = {
            ...localTheme,
            id: 'custom',
            name: 'Custom',
            headerGradient: `from-[${customColor1}] to-[${customColor2}]`,
        };
        setLocalTheme(customTheme);
    };

    const handleImageUploadClick = (photoKey?: string) => {
        uploadingPhotoKey.current = photoKey || 'image';
        imageInputRef.current?.click();
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Compress image to under 200KB
            const compressedImage = await compressImage(file);

            const targetKey = uploadingPhotoKey.current || 'image';

            if (targetKey === 'image') {
                // Main attendee photo
                setPreviewImage(compressedImage);
                if (selectedAttendee && onImageUpload) {
                    const response = await fetch(compressedImage);
                    const blob = await response.blob();
                    const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    onImageUpload(selectedAttendee.id, compressedFile);
                }
            } else {
                // Custom photo element
                setCustomPhotoImages(prev => ({
                    ...prev,
                    [targetKey]: compressedImage
                }));
            }
        } catch (err) {
            console.error('Image compression failed:', err);
            // Fallback to original file
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                const targetKey = uploadingPhotoKey.current || 'image';
                if (targetKey === 'image') {
                    setPreviewImage(result);
                    if (selectedAttendee && onImageUpload) {
                        onImageUpload(selectedAttendee.id, file);
                    }
                } else {
                    setCustomPhotoImages(prev => ({
                        ...prev,
                        [targetKey]: result
                    }));
                }
            };
            reader.readAsDataURL(file);
        }

        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
        uploadingPhotoKey.current = null;
    };

    const handleMouseDown = useCallback((e: React.MouseEvent, elementKey: ElementKey) => {
        e.preventDefault();
        setSelectedElement(elementKey);
        setIsDragging(true);
        hasDragged.current = false;

        const element = layout[elementKey];
        if (!element || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const elementX = (element.x / 100) * rect.width;
        const elementY = (element.y / 100) * rect.height;

        dragOffset.current = {
            x: e.clientX - rect.left - elementX,
            y: e.clientY - rect.top - elementY,
        };
    }, [layout]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !selectedElement || !canvasRef.current) return;

        hasDragged.current = true;

        const rect = canvasRef.current.getBoundingClientRect();
        let newX = ((e.clientX - rect.left - dragOffset.current.x) / rect.width) * 100;
        let newY = ((e.clientY - rect.top - dragOffset.current.y) / rect.height) * 100;

        newX = Math.max(5, Math.min(95, newX));
        newY = Math.max(5, Math.min(95, newY));
        newX = Math.round(newX / 2) * 2;
        newY = Math.round(newY / 2) * 2;

        setLayout(prev => ({
            ...prev,
            [selectedElement]: {
                ...prev[selectedElement],
                x: newX,
                y: newY,
            },
        }));
    }, [isDragging, selectedElement]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const toggleVisibility = (elementKey: ElementKey) => {
        setLayout(prev => {
            const element = prev[elementKey];
            if (!element) return prev;
            return {
                ...prev,
                [elementKey]: { ...element, visible: !element.visible },
            };
        });
    };

    const updateFontSize = (elementKey: ElementKey, fontSize: number) => {
        setLayout(prev => {
            const element = prev[elementKey];
            if (!element) return prev;
            return {
                ...prev,
                [elementKey]: { ...element, fontSize },
            };
        });
    };

    const updateImageSize = (key: ElementKey, width: number) => {
        setLayout(prev => {
            const element = prev[key];
            if (!element) return prev;
            return {
                ...prev,
                [key]: { ...element, width },
            };
        });
    };

    const addNewTextElement = () => {
        // Add a new custom text element
        const newCount = customTextCount + 1;
        setCustomTextCount(newCount);
        const newKey = `customText${newCount}` as ElementKey;

        // Add to layout
        setLayout(prev => ({
            ...prev,
            [newKey]: { x: 50, y: 50 + ((newCount - 1) * 8), fontSize: 14, textAlign: 'center' as const, visible: true },
        }));

        // Add to custom elements list
        setCustomElements(prev => [...prev, {
            key: newKey,
            label: `Text ${newCount}`,
            icon: <Type size={14} />,
            type: 'text'
        }]);
    };

    const addNewPhotoElement = () => {
        // Add a new custom photo element
        const newCount = customPhotoCount + 1;
        setCustomPhotoCount(newCount);
        const newKey = `customPhoto${newCount}` as ElementKey;

        // Add to layout
        setLayout(prev => ({
            ...prev,
            [newKey]: { x: 30 + ((newCount - 1) * 15), y: 60, width: 15, visible: true },
        }));

        // Add to custom elements list
        setCustomElements(prev => [...prev, {
            key: newKey,
            label: `Image ${newCount}`,
            icon: <ImageIcon size={14} />,
            type: 'photo'
        }]);
    };

    const handleReset = () => {
        setLayout({ ...DEFAULT_LAYOUTS[templateType] });
        setLocalTheme(theme);
        setCustomTextCount(0);
        setCustomPhotoCount(0);
        setCustomElements([]);
        setCustomLabels({});
    };

    const handleSave = () => {
        onSaveLayout(layout);
        if (onThemeChange && localTheme.id !== theme.id) {
            onThemeChange(localTheme);
        }
        onClose();
    };

    const handleSaveAsTemplate = async () => {
        if (!templateName.trim()) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: templateName.trim(),
                    icon: templateIcon,
                    baseTemplate: templateType,
                    layout,
                    theme: localTheme,
                    customLabels,
                    visibility: templateVisibility
                })
            });

            if (response.ok) {
                setShowSaveModal(false);
                setTemplateName('');
                setTemplateIcon('default');
                setTemplateVisibility('private');
                // Notify parent to refresh templates list
                if (onTemplateUpdated) {
                    onTemplateUpdated();
                }
                handleSave();
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to save template');
            }
        } catch (err) {
            alert('Error saving template');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateExistingTemplate = async () => {
        if (!editingTemplateId) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/templates/${editingTemplateId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    layout,
                    theme: localTheme,
                    customLabels
                })
            });

            if (response.ok) {
                setShowSaveModal(false);
                // Notify parent to refresh templates list
                if (onTemplateUpdated) {
                    onTemplateUpdated();
                }
                handleSave();
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to update template');
            }
        } catch (err) {
            alert('Error updating template');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // Get visible elements for template and separate by type
    const getVisibleElements = () => {
        const templateElements = ELEMENTS.filter(el => {
            if (templateType === 'conference') {
                return ['name', 'image', 'company', 'registrationId', 'role', 'qrCode'].includes(el.key);
            }
            if (templateType === 'company-id') {
                return ['name', 'image', 'company', 'registrationId', 'role', 'contactNumber', 'address', 'qrCode'].includes(el.key);
            }
            return ['name', 'image', 'company', 'registrationId', 'fatherName', 'motherName', 'dateOfBirth', 'className', 'contactNumber', 'address'].includes(el.key);
        });
        // Include custom elements
        return [...templateElements, ...customElements];
    };

    const visibleElements = getVisibleElements();
    const textElements = visibleElements.filter(el => el.type === 'text');
    const photoElements = visibleElements.filter(el => el.type === 'photo');

    // Count visible elements
    const visibleTextCount = textElements.filter(el => layout[el.key]?.visible).length;
    const visiblePhotoCount = photoElements.filter(el => layout[el.key]?.visible).length;

    const previewData = selectedAttendee || {
        name: 'John Doe',
        company: 'Acme Corp',
        schoolName: 'Sample School',
        registrationId: 'REG-001',
        role: 'Attendee',
        fatherName: 'Robert Doe',
        motherName: 'Jane Doe',
        dateOfBirth: '01-01-2000',
        className: '10',
        contactNumber: '+91 9876543210',
        address: '123 Main Street',
    };

    const getElementValue = (key: ElementKey): string => {
        const attendee = selectedAttendee;

        // Special cases for photo and QR code
        if (key === 'image') return 'PHOTO';
        if (key === 'qrCode') return '▢▢▢';

        // Get the label for this element (custom label or default based on key)
        const label = customLabels[key] || getDefaultLabel(key);

        // Look for data in extras using this label (case-insensitive match)
        if (attendee?.extras) {
            // First try exact match
            if (attendee.extras[label]) {
                return attendee.extras[label];
            }
            // Try case-insensitive match
            const lowerLabel = label.toLowerCase();
            for (const [extraKey, extraValue] of Object.entries(attendee.extras)) {
                if (extraKey.toLowerCase() === lowerLabel) {
                    return String(extraValue);
                }
            }
        }

        // Return the label as placeholder (shows what data is expected)
        return label;
    };

    // Helper to get default label for standard element keys
    const getDefaultLabel = (key: string): string => {
        const labels: Record<string, string> = {
            name: 'Name',
            company: 'Company',
            registrationId: 'ID',
            role: 'Role',
            fatherName: "Father's Name",
            motherName: "Mother's Name",
            dateOfBirth: 'DOB',
            className: 'Class',
            contactNumber: 'Contact',
            address: 'Address',
            schoolId: 'School ID',
            schoolName: 'School',
            section: 'Section',
            passType: 'Pass Type'
        };
        return labels[key] || key;
    };

    const renderPhotoElement = (pos: ElementPosition) => {
        const imageToShow = previewImage || selectedAttendee?.image;
        const imageWidth = pos.width || 20;
        const pixelSize = Math.round((imageWidth / 100) * 320);

        const handlePhotoClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!hasDragged.current) {
                handleImageUploadClick();
            }
        };

        const handlePhotoMouseDown = (e: React.MouseEvent) => {
            hasDragged.current = false;
            handleMouseDown(e, 'image');
        };

        return (
            <div
                className={`template-element ${selectedElement === 'image' ? 'selected' : ''} ${!pos.visible ? 'opacity-30' : ''}`}
                style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: isDragging && selectedElement === 'image' ? 'grabbing' : 'grab',
                }}
                onMouseDown={handlePhotoMouseDown}
            >
                <div className="drag-handle" />
                <div
                    className="rounded-xl bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-md group relative"
                    style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
                    onClick={handlePhotoClick}
                >
                    {imageToShow ? (
                        <img src={imageToShow} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                            <Camera size={Math.max(16, pixelSize / 4)} />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload size={16} className="text-white" />
                    </div>
                </div>
            </div>
        );
    };

    const renderElementControl = (el: DraggableElementData) => {
        const pos = layout[el.key];
        if (!pos) return null;

        const displayLabel = customLabels[el.key] || el.label;
        const isEditing = editingLabel === el.key;

        return (
            <div
                key={el.key}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedElement === el.key
                    ? 'bg-indigo-600/20 border-indigo-500/40'
                    : pos.visible
                        ? 'bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50'
                        : 'bg-slate-800/30 border-slate-700/30 opacity-50'
                    }`}
                onClick={() => setSelectedElement(el.key)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-slate-400 flex-shrink-0">{el.icon}</span>
                        {isEditing ? (
                            <input
                                type="text"
                                className="flex-1 min-w-0 bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                defaultValue={displayLabel}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => {
                                    const newLabel = e.target.value.trim();
                                    if (newLabel && newLabel !== el.label) {
                                        setCustomLabels(prev => ({ ...prev, [el.key]: newLabel }));
                                    } else if (!newLabel || newLabel === el.label) {
                                        setCustomLabels(prev => {
                                            const copy = { ...prev };
                                            delete copy[el.key];
                                            return copy;
                                        });
                                    }
                                    setEditingLabel(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                    }
                                    if (e.key === 'Escape') {
                                        setEditingLabel(null);
                                    }
                                }}
                            />
                        ) : (
                            <button
                                className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-indigo-300 transition-colors group/label text-left truncate"
                                onClick={(e) => { e.stopPropagation(); setEditingLabel(el.key); }}
                                title="Click to rename (for Excel column mapping)"
                            >
                                <span className="truncate">{displayLabel}</span>
                                <Pencil size={10} className="text-slate-500 group-hover/label:text-indigo-400 opacity-0 group-hover/label:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(el.key); }}
                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${pos.visible ? 'text-indigo-400 hover:bg-indigo-500/20' : 'text-slate-500 hover:bg-slate-600/50'}`}
                            title={pos.visible ? 'Hide' : 'Show'}
                        >
                            {pos.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Remove element from layout
                                setLayout(prev => {
                                    const newLayout = { ...prev };
                                    delete newLayout[el.key];
                                    return newLayout;
                                });
                                // Remove from custom elements if it's a custom element
                                if (el.key.startsWith('customText') || el.key.startsWith('customPhoto')) {
                                    setCustomElements(prev => prev.filter(e => e.key !== el.key));
                                }
                                // Clear custom label if exists
                                setCustomLabels(prev => {
                                    const copy = { ...prev };
                                    delete copy[el.key];
                                    return copy;
                                });
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                            title="Remove element"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {el.type === 'photo' && pos.visible && (
                    <>
                        {/* Don't show upload for QR Code - it's auto-generated */}
                        {el.key !== 'qrCode' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleImageUploadClick(el.key); }}
                                className="w-full mb-2 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Upload size={12} />
                                {el.key === 'image' ? 'Upload Photo' : (customPhotoImages[el.key] ? 'Replace Image' : 'Upload Image')}
                            </button>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider w-10">Size</span>
                            <input
                                type="range"
                                min="10"
                                max="40"
                                value={pos.width || 20}
                                onChange={(e) => updateImageSize(el.key, parseInt(e.target.value))}
                                className="flex-1 accent-indigo-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-slate-300 w-7">{pos.width || 20}%</span>
                        </div>
                    </>
                )}

                {pos.fontSize !== undefined && pos.visible && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider w-10">Size</span>
                        <input
                            type="range"
                            min="8"
                            max="32"
                            value={pos.fontSize}
                            onChange={(e) => updateFontSize(el.key, parseInt(e.target.value))}
                            className="flex-1 accent-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-slate-300 w-7">{pos.fontSize}</span>
                    </div>
                )}

                <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                    <span>X: {Math.round(pos.x)}%</span>
                    <span>Y: {Math.round(pos.y)}%</span>
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="absolute inset-0" onClick={onClose} />

            <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
            />

            <div className="relative w-full max-w-6xl max-h-[90vh] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-slide-in-up flex">

                {/* Left Panel - Colors & Add Elements */}
                <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col min-h-0 overflow-hidden">
                    {/* Tab Switcher */}
                    <div className="p-2 border-b border-slate-700 flex gap-1 flex-shrink-0">
                        <button
                            onClick={() => setLeftPanelTab('colors')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${leftPanelTab === 'colors'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Palette size={16} />
                            Colors
                        </button>
                        <button
                            onClick={() => setLeftPanelTab('elements')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${leftPanelTab === 'elements'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Plus size={16} />
                            Add Element
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        {leftPanelTab === 'colors' ? (
                            <>
                                {/* Theme Presets */}
                                <div className="mb-4">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Theme Presets</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {DEFAULT_THEMES.map(preset => (
                                            <button
                                                key={preset.id}
                                                onClick={() => handleThemePresetClick(preset)}
                                                className={`aspect-square rounded-lg bg-gradient-to-br ${preset.headerGradient} transition-all ${localTheme.id === preset.id
                                                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105'
                                                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                    }`}
                                                title={preset.name}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">Active: <span className="text-indigo-400">{localTheme.name}</span></p>
                                </div>

                                {/* Custom Gradient */}
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Custom Gradient</p>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Start Color</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={customColor1}
                                                    onChange={(e) => setCustomColor1(e.target.value)}
                                                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-600"
                                                />
                                                <input
                                                    type="text"
                                                    value={customColor1}
                                                    onChange={(e) => setCustomColor1(e.target.value)}
                                                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">End Color</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={customColor2}
                                                    onChange={(e) => setCustomColor2(e.target.value)}
                                                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-600"
                                                />
                                                <input
                                                    type="text"
                                                    value={customColor2}
                                                    onChange={(e) => setCustomColor2(e.target.value)}
                                                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                        {/* Preview */}
                                        <div
                                            className="h-8 rounded-lg shadow-inner"
                                            style={{ background: `linear-gradient(to right, ${customColor1}, ${customColor2})` }}
                                        />
                                        <button
                                            onClick={handleCustomGradient}
                                            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                                        >
                                            Apply Custom Colors
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Simplified Add Elements - Just Text and Image buttons */}
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Add New Element</p>
                                <p className="text-xs text-slate-500 mb-4">Click to add a new element to your card</p>

                                <div className="space-y-3">
                                    {/* Add Text Button */}
                                    <button
                                        onClick={addNewTextElement}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 hover:border-indigo-400/50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Type size={24} className="text-indigo-300" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white font-semibold">Text</p>
                                            <p className="text-xs text-slate-400">Add a text field to your card</p>
                                        </div>
                                        <Plus size={20} className="ml-auto text-indigo-400 group-hover:rotate-90 transition-transform" />
                                    </button>

                                    {/* Add Image Button */}
                                    <button
                                        onClick={addNewPhotoElement}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <ImageIcon size={24} className="text-emerald-300" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white font-semibold">Image</p>
                                            <p className="text-xs text-slate-400">Add a photo element to your card</p>
                                        </div>
                                        <Plus size={20} className="ml-auto text-emerald-400 group-hover:rotate-90 transition-transform" />
                                    </button>
                                </div>

                                {/* Info */}
                                <div className="mt-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                    <p className="text-xs text-slate-400">
                                        <span className="text-indigo-400 font-medium">Tip:</span> Added elements will appear in the Elements panel on the right. You can drag them on the card to reposition.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Center Panel - Card Preview */}
                <div className="flex-1 p-6 bg-slate-900/50 overflow-y-auto min-h-0 flex flex-col items-center">
                    <div className="mb-4 text-center flex-shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                            <Move size={20} className="text-indigo-400" />
                            Card Preview
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">Drag elements to reposition • Click photo to upload</p>
                    </div>

                    {/* Canvas */}
                    <div
                        ref={canvasRef}
                        className="template-canvas editing relative flex-shrink-0"
                        style={{
                            borderRadius: `${localTheme.borderRadius}px`,
                            cursor: isDragging ? 'grabbing' : 'default'
                        }}
                    >
                        {/* Header gradient preview */}
                        <div
                            className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-br ${localTheme.headerGradient}`}
                            style={{ borderRadius: `${localTheme.borderRadius}px ${localTheme.borderRadius}px 0 0` }}
                        />

                        <div className="template-canvas-grid" />

                        {visibleElements.map(el => {
                            const pos = layout[el.key];
                            if (!pos || !pos.visible) return null;

                            // Render photo-type elements
                            if (el.type === 'photo') {
                                if (el.key === 'image') {
                                    return <React.Fragment key={el.key}>{renderPhotoElement(pos)}</React.Fragment>;
                                }
                                // Render custom photo elements as placeholders
                                const imageWidth = pos.width || 15;
                                const pixelSize = Math.round((imageWidth / 100) * 320);
                                return (
                                    <div
                                        key={el.key}
                                        className={`template-element ${selectedElement === el.key ? 'selected' : ''}`}
                                        style={{
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            cursor: isDragging && selectedElement === el.key ? 'grabbing' : 'grab',
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, el.key)}
                                    >
                                        <div className="drag-handle" />
                                        <div
                                            className={`rounded-lg ${customPhotoImages[el.key] ? 'border-2 border-white shadow-md' : 'border-2 border-dashed border-slate-400 bg-slate-200'} flex items-center justify-center overflow-hidden`}
                                            style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
                                        >
                                            {customPhotoImages[el.key] ? (
                                                <img src={customPhotoImages[el.key]} alt={el.label} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-slate-400">
                                                    <ImageIcon size={Math.max(12, pixelSize / 4)} />
                                                    <span className="text-[8px] font-medium">{customLabels[el.key] || el.label}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            // Render text-type elements
                            return (
                                <div
                                    key={el.key}
                                    className={`template-element ${selectedElement === el.key ? 'selected' : ''}`}
                                    style={{
                                        left: `${pos.x}%`,
                                        top: `${pos.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: pos.fontSize ? `${pos.fontSize}px` : '14px',
                                        color: pos.y < 26 ? 'white' : localTheme.primaryTextColor,
                                        cursor: isDragging && selectedElement === el.key ? 'grabbing' : 'grab',
                                        fontWeight: el.key === 'name' ? 700 : 400,
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, el.key)}
                                >
                                    <div className="drag-handle" />
                                    <span className="whitespace-nowrap">{getElementValue(el.key)}</span>
                                </div>
                            );
                        })}
                    </div>

                    {selectedAttendee && (
                        <div className="mt-4 text-center text-xs text-slate-500 flex-shrink-0">
                            Previewing: <span className="text-indigo-400">{selectedAttendee.name}</span>
                        </div>
                    )}
                </div>

                {/* Right Panel - Element Controls with Collapsible Groups */}
                <div className="w-72 bg-slate-800 border-l border-slate-700 p-4 flex flex-col overflow-hidden min-h-0">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Layers size={18} className="text-indigo-400" />
                            Elements
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                        {/* Text Elements Group */}
                        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                            <button
                                onClick={() => setTextElementsOpen(!textElementsOpen)}
                                className="w-full flex items-center justify-between p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {textElementsOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                    <Type size={16} className="text-indigo-400" />
                                    <span className="text-sm font-medium text-white">Text Elements</span>
                                </div>
                                <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                                    {visibleTextCount}/{textElements.length}
                                </span>
                            </button>
                            {textElementsOpen && (
                                <div className="p-2 space-y-2 bg-slate-800/30">
                                    {textElements.map(el => renderElementControl(el))}
                                </div>
                            )}
                        </div>

                        {/* Photo Elements Group */}
                        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                            <button
                                onClick={() => setPhotoElementsOpen(!photoElementsOpen)}
                                className="w-full flex items-center justify-between p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {photoElementsOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                    <ImageIcon size={16} className="text-emerald-400" />
                                    <span className="text-sm font-medium text-white">Photo Elements</span>
                                </div>
                                <span className="text-xs bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">
                                    {visiblePhotoCount}/{photoElements.length}
                                </span>
                            </button>
                            {photoElementsOpen && (
                                <div className="p-2 space-y-2 bg-slate-800/30">
                                    {photoElements.map(el => renderElementControl(el))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 flex-shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={handleReset}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
                            >
                                <RotateCcw size={14} />
                                Reset
                            </button>
                            <button
                                onClick={() => {
                                    // Pre-fill with existing template name if editing
                                    if (editingTemplateId && editingTemplateName && !templateName) {
                                        setTemplateName(editingTemplateName);
                                    }
                                    setShowSaveModal(true);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-600/20 text-sm"
                            >
                                <Save size={14} />
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Template Modal */}
            {showSaveModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Save as Template</h3>
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Template Name */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1.5">Template Name</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="e.g., School ID Card 2024"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    autoFocus
                                />
                            </div>

                            {/* Icon Selection */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1.5">Choose an Icon</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {ICON_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setTemplateIcon(opt.id)}
                                            className={`aspect-square rounded-xl flex items-center justify-center transition-all ${templateIcon === opt.id
                                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-800'
                                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                }`}
                                            title={opt.label}
                                        >
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Selected: <span className="text-indigo-400">{ICON_OPTIONS.find(o => o.id === templateIcon)?.label}</span>
                                </p>
                            </div>

                            {/* Visibility Toggle */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1.5">Visibility</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTemplateVisibility('private')}
                                        className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${templateVisibility === 'private'
                                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                    >
                                        🔒 Private
                                    </button>
                                    <button
                                        onClick={() => setTemplateVisibility('public')}
                                        className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${templateVisibility === 'public'
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                    >
                                        🌍 Public
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {templateVisibility === 'private'
                                        ? 'Only you can see and use this template'
                                        : 'Anyone can see and use this template'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                {editingTemplateId ? (
                                    <>
                                        <button
                                            onClick={handleUpdateExistingTemplate}
                                            disabled={isSaving}
                                            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} />
                                                    Update
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleSaveAsTemplate}
                                            disabled={!templateName.trim() || isSaving}
                                            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <Bookmark size={16} />
                                            Save as New
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleSaveAsTemplate}
                                        disabled={!templateName.trim() || isSaving}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Bookmark size={16} />
                                                Save Template
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
