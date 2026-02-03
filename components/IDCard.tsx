import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Attendee, BadgeTemplate, TemplateLayout } from '../types';
import { Building2, Ticket, Star, X, Hash, ListChecks, Plus, Edit2, Check, Download, Trash2, Phone, MapPin, CalendarClock, BadgeCheck, UserRound, Briefcase } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toJpeg, toPng } from 'html-to-image';
import { buildCardFilename } from '../utils/filename';

interface IDCardProps {
  data: Attendee;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onOpenTemplateEditor?: () => void;
  onImageUpload: (file: File) => void;
  onDelete: () => void;
  downloadFormat: 'png' | 'jpg';
  filenameTemplate: string;
  activeTemplate: BadgeTemplate;
  accentGradient: string;
  schoolBranding: {
    name: string;
    address: string;
    phone: string;
    tagline: string;
  };
  username?: string;
  baseUrl?: string;
  layout?: TemplateLayout;
  customLabels?: Record<string, string>;
}

const getCategoryColor = (passType: string): string => {
  const lower = passType.toLowerCase();
  if (lower.includes('four day')) return 'bg-gradient-to-r from-amber-500 to-orange-600';
  if (lower.includes('lite')) return 'bg-gradient-to-r from-cyan-500 to-blue-600';
  if (lower.includes('mindset')) return 'bg-gradient-to-r from-purple-500 to-pink-600';
  if (lower.includes('devex')) return 'bg-gradient-to-r from-emerald-500 to-green-600';
  return 'bg-gradient-to-r from-slate-500 to-slate-700';
};

const getBorderColor = (passType: string): string => {
  const lower = passType.toLowerCase();
  if (lower.includes('four day')) return 'border-orange-500/30';
  if (lower.includes('lite')) return 'border-cyan-500/30';
  return 'border-indigo-500/30';
};

const getRoleBadgeClasses = (role?: string) => {
  if (role === 'Speaker') return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (role === 'Organizer') return 'bg-teal-100 text-teal-700 border border-teal-200';
  return '';
};

export const IDCard: React.FC<IDCardProps> = ({
  data,
  isSelected,
  onToggleSelect,
  onEdit,
  onOpenTemplateEditor,
  onImageUpload,
  onDelete,
  downloadFormat,
  filenameTemplate,
  activeTemplate,
  accentGradient,
  schoolBranding,
  username = 'user',
  baseUrl = 'https://id.maninfini.com',
  layout,
  customLabels = {}
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const template: BadgeTemplate = activeTemplate || data.template || 'conference';
  const headerBg = template === 'school-classic' || template === 'company-id' ? `bg-gradient-to-br ${accentGradient}` : getCategoryColor(data.passType);
  const borderColor = template === 'school-classic' || template === 'company-id' ? 'border-slate-200' : getBorderColor(data.passType);

  // Helper to check if an element is visible in the layout
  const isElementVisible = (key: string): boolean => {
    if (!layout) return true; // If no layout provided, show all elements (fallback)
    const element = layout[key as keyof typeof layout];
    // Element must EXIST in the layout AND be visible (not just not-false)
    // If element doesn't exist in layout, it means user deleted it - don't show
    if (!element) return false;
    return element.visible === true;
  };

  // Get element label (custom or default)
  const getElementLabel = (key: string, defaultLabel: string): string => {
    return customLabels[key] || defaultLabel;
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImageLoading(true);
      onImageUpload(file);
    } else {
      setIsImageLoading(false);
    }
  };

  const handleImageLoad = () => setIsImageLoading(false);
  const handleImageError = () => setIsImageLoading(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const element = document.getElementById(`card-${data.id}`);
    if (element) {
      try {
        const commonOptions = {
          quality: 0.95,
          pixelRatio: 2,
          filter: (node: HTMLElement) => !node.classList?.contains('no-export')
        };
        const useJpeg = downloadFormat === 'jpg';
        const dataUrl = useJpeg
          ? await toJpeg(element, commonOptions)
          : await toPng(element, commonOptions);
        const link = document.createElement('a');
        const filename = buildCardFilename(data, filenameTemplate, downloadFormat);
        link.download = filename;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to download card:', err);
      }
    }
  };

  const renderSchoolRow = (label: string, value?: string, icon?: React.ReactNode) => (
    <div className="flex items-start justify-between bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
      <div className="flex items-center gap-2 text-[11px] uppercase text-slate-500 font-semibold tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-700 text-right max-w-[160px] leading-tight">
        {value || '—'}
      </span>
    </div>
  );

  const renderSchoolCard = () => {
    const brandName = schoolBranding.name || data.schoolName || data.company || 'School Name';
    const brandAddress = schoolBranding.address || data.address || '';
    const brandPhone = schoolBranding.phone || data.contactNumber || '';
    const brandTagline = schoolBranding.tagline || '';
    const studentId = data.schoolId || data.registrationId || 'ID Pending';
    const studentClass = data.className
      ? `Class ${data.className}${data.section ? ` • Section ${data.section}` : ''}`
      : data.section
        ? `Section ${data.section}`
        : '';
    const extras = Object.entries(data.extras || {}).filter(([, v]) => v);
    const schoolFields = [
      { label: "Father's Name", value: data.fatherName, icon: <UserRound size={14} className="text-sky-500" /> },
      { label: "Mother's Name", value: data.motherName, icon: <UserRound size={14} className="text-sky-500" /> },
      { label: 'D.O.B', value: data.dateOfBirth, icon: <CalendarClock size={14} className="text-sky-500" /> },
      { label: 'Contact No.', value: data.contactNumber, icon: <Phone size={14} className="text-sky-500" /> },
      { label: 'Address', value: data.address, icon: <MapPin size={14} className="text-sky-500" /> },
      { label: 'Emergency', value: data.emergencyContact, icon: <Phone size={14} className="text-amber-500" /> }
    ].filter((item) => item.value);

    return (
      <>
        {/* Lanyard Hole */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-100 rounded-full z-20 shadow-inner flex justify-center items-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className={`h-40 ${headerBg} relative overflow-hidden rounded-b-[28px]`}>
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id={`grid-${data.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${data.id})`} />
            </svg>
          </div>
          {brandTagline && (
            <div className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
              {brandTagline}
            </div>
          )}
          <div className="absolute inset-x-6 bottom-4 text-center text-white space-y-1">
            <p className="text-lg font-black leading-tight drop-shadow-sm">{brandName}</p>
            {brandAddress && <p className="text-xs text-white/90 leading-snug">{brandAddress}</p>}
            {brandPhone && <p className="text-[11px] font-semibold tracking-wide">Phone: {brandPhone}</p>}
          </div>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center -mt-14 px-6">
          <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden relative">
            {data.image ? (
              <img
                src={data.image}
                alt={data.name}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-700 relative">
                <div className={`absolute inset-0 opacity-10 ${headerBg}`}></div>
                {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            {isImageLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center no-export">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-export cursor-pointer" onClick={handleImageClick}>
              <Plus className="text-white" size={32} />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          <div className="mt-3 text-center space-y-0.5">
            <h1 className="text-2xl font-black text-slate-800 leading-tight">{data.name}</h1>
            <p className="text-xs uppercase text-slate-500 tracking-wide flex items-center justify-center gap-1">
              <BadgeCheck size={12} /> Student ID: {studentId}
            </p>
            {studentClass && <p className="text-xs text-slate-500">{studentClass}</p>}
          </div>
        </div>

        <div className="px-6 pt-3 pb-4 space-y-2 flex-1">
          {schoolFields.length > 0 && schoolFields.map((item) => renderSchoolRow(item.label, item.value, item.icon))}
        </div>

        <div className="px-6 pb-4 pt-1">
          <div className="flex items-center justify-between text-[11px] uppercase text-slate-500 font-semibold tracking-wide">
            <span>Principal Sign.</span>
            <span className="text-slate-700 font-bold">{brandTagline || 'Govt. Recognised'}</span>
          </div>
        </div>

        <div className={`h-1.5 w-full bg-gradient-to-r ${accentGradient}`}></div>
      </>
    );
  };

  // Helper function to get element value from data
  // ONLY looks up data from extras using the element's custom label
  // This ensures data ONLY maps to elements the user explicitly created and labeled
  const getElementValue = (key: string): string => {
    // Get the label for this element (custom label or the key itself for standard elements)
    const label = customLabels[key] || key;

    // Look for data in extras using this label (case-insensitive match)
    if (data.extras) {
      // First try exact match
      if (data.extras[label]) {
        return data.extras[label];
      }
      // Try case-insensitive match
      const lowerLabel = label.toLowerCase();
      for (const [extraKey, extraValue] of Object.entries(data.extras)) {
        if (extraKey.toLowerCase() === lowerLabel) {
          return String(extraValue);
        }
      }
    }

    // Return the label as fallback text (so the element still shows)
    return label;
  };

  // New layout-aware card renderer that uses actual layout positions
  const renderCustomLayoutCard = () => {
    if (!layout) return null;

    // Type for element position
    type ElementPosition = { x: number; y: number; visible: boolean; fontSize?: number; width?: number };

    // Get all visible elements from layout
    const visibleElements = Object.entries(layout).filter(([, pos]) => (pos as ElementPosition)?.visible) as [string, ElementPosition][];

    return (
      <>
        {/* Lanyard hole - hidden for blank template */}
        {template !== 'blank' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-100 rounded-full z-20 shadow-inner flex justify-center items-center">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
          </div>
        )}

        {/* Header gradient (top 26%) - hidden for blank template */}
        {template !== 'blank' && (
          <div className={`absolute top-0 left-0 right-0 h-[26%] bg-gradient-to-br ${accentGradient}`}>
            <div className="absolute inset-0 opacity-20">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id={`grid-custom-${data.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#grid-custom-${data.id})`} />
              </svg>
            </div>
          </div>
        )}

        {/* White body area - full height for blank template */}
        <div className={`absolute left-0 right-0 bottom-0 bg-white ${template === 'blank' ? 'top-0 rounded-2xl' : 'top-[26%] rounded-b-2xl'}`} />

        {/* Position-based elements rendering */}
        <div className="absolute inset-0 overflow-hidden">
          {visibleElements.map(([key, pos]) => {
            if (!pos) return null;


            // Handle Photo element (both main 'image' and custom 'customPhoto' elements)
            if (key === 'image' || key.startsWith('customPhoto')) {
              const size = Math.round(280 * (pos.width || 20) / 100);
              return (
                <div
                  key={key}
                  className="absolute z-10 group/avatar cursor-pointer"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={handleImageClick}
                >
                  <div
                    className="rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden"
                    style={{ width: `${size}px`, height: `${size}px` }}
                  >
                    {data.image ? (
                      <img src={data.image} alt={data.name} className="w-full h-full object-cover" onLoad={handleImageLoad} onError={handleImageError} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-700 bg-slate-100">
                        {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
              );
            }

            // Handle QR Code element
            if (key === 'qrCode') {
              const size = Math.round(280 * (pos.width || 15) / 100);
              return (
                <div
                  key={key}
                  className="absolute z-10"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <QRCodeSVG
                      value={`${baseUrl}/verify/${data.verificationCode || data.id}`}
                      size={size}
                      bgColor="white"
                      fgColor="#1e293b"
                      level="M"
                    />
                  </div>
                </div>
              );
            }

            // Handle text elements
            const value = getElementValue(key);
            if (!value) return null;

            const isInHeader = pos.y < 26;
            return (
              <div
                key={key}
                className="absolute z-10 whitespace-nowrap"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${pos.fontSize || 14}px`,
                  fontWeight: key === 'name' ? 700 : 400,
                  color: isInHeader ? 'white' : '#1e293b'
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderConferenceCard = () => (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-100 rounded-full z-20 shadow-inner flex justify-center items-center">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
      </div>

      {/* Hero Header / Art */}
      <div className={`h-36 ${headerBg} relative overflow-hidden`}>
        {/* Abstract Pattern overlay */}
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="absolute bottom-4 left-6 text-white">
          <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-80 mb-1">AGILE INDIA</h3>
          <div className="flex items-center gap-2">
            <div className="font-black text-2xl tracking-tighter">CONF<span className="opacity-75">2025</span></div>
          </div>
        </div>

        {/* Role Badge */}
        {data.role && (data.role === 'Speaker' || data.role === 'Organizer') && (
          <div className="absolute top-8 right-6">
            <div className="bg-white/90 text-slate-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-white">
              <Star size={12} className="text-amber-500" fill="currentColor" />
              {data.role.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="flex-1 px-8 pt-8 pb-6 flex flex-col items-center text-center relative">

        {/* Avatar Placeholder (Initials) or Image */}
        <div className="relative -mt-20 z-10 group/avatar cursor-pointer no-print" onClick={handleImageClick}>
          <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden relative">
            {data.image ? (
              <img
                src={data.image}
                alt={data.name}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-3xl font-bold text-slate-700 relative`}>
                <div className={`absolute inset-0 opacity-10 ${headerBg}`}></div>
                {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            {isImageLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center no-export">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            )}

            {/* Upload Overlay (Hidden in Export) */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity no-export">
              <Plus className="text-white" size={32} />
            </div>
          </div>

          {/* Plus Button Helper (Hidden in Export) */}
          <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1 rounded-full border-2 border-white shadow-md transform translate-y-1 opacity-0 group-hover/avatar:opacity-100 transition-opacity no-export">
            <Plus size={14} />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        {/* Printable Avatar (Static, no overlay) - used when printing or exporting if needed, but the logic above handles export via no-export class on overlay */}
        <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg -mt-20 z-10 hidden print:flex items-center justify-center overflow-hidden relative">
          {data.image ? (
            <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-3xl font-bold text-slate-700 relative`}>
              <div className={`absolute inset-0 opacity-10 ${headerBg}`}></div>
              {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className="mt-4 text-2xl font-black text-slate-800 leading-tight line-clamp-2">
          {data.name}
        </h1>
        {data.role && (data.role === 'Speaker' || data.role === 'Organizer') && (
          <div className={`mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClasses(data.role)}`}>
            <Star size={12} className="text-amber-500" />
            <span>{data.role}</span>
          </div>
        )}

        {/* Company */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-slate-500 font-medium text-sm">
          <Building2 size={14} />
          <span className="uppercase tracking-wide truncate max-w-[200px]">{data.company}</span>
        </div>

        {/* Divider */}
        <div className="w-12 h-1 bg-slate-100 rounded-full my-6"></div>

        {/* Tracks / Details */}
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400">
              <Ticket size={14} />
              <span className="text-xs font-semibold uppercase">Access</span>
            </div>
            <span className="text-xs font-bold text-slate-700 text-right max-w-[140px] truncate">
              {data.passType}
            </span>
          </div>

          {/* Reg ID */}
          <div className="flex justify-between items-center px-3">
            <span className="text-[10px] text-slate-400 font-mono">ID: {data.registrationId}</span>
          </div>
        </div>
      </div>

      {/* Footer / QR */}
      <div className="bg-slate-50 h-28 border-t border-slate-100 flex items-center justify-center px-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Scan for Details</span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm hover:ring-2 hover:ring-indigo-500 hover:border-transparent transition-all cursor-pointer group relative"
            title="Click to view attendee details"
          >
            <QRCodeSVG
              value={`${baseUrl}/verify/${data.verificationCode || data.id}`}
              size={64}
              bgColor="white"
              fgColor="#1e293b"
              level="M"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/10 rounded opacity-0 group-hover:opacity-100 transition-opacity no-export">
              <span className="sr-only">Scan</span>
            </div>
          </button>
          <span className="text-[10px] font-medium text-slate-500 font-mono tracking-wider">{data.verificationCode || 'N/A'}</span>
        </div>
      </div>

      {/* Decorative colored bar at very bottom */}
      <div className={`h-1.5 w-full ${headerBg}`}></div>
    </>
  );

  const renderCompanyCard = () => (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-100 rounded-full z-20 shadow-inner flex justify-center items-center">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full"></div>
      </div>

      <div className={`h-36 ${headerBg} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-15">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`grid-corp-${data.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-corp-${data.id})`} />
          </svg>
        </div>
        <div className="absolute left-6 bottom-4 text-white space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] font-semibold opacity-80">Employee ID</p>
          <h3 className="text-2xl font-black tracking-tight drop-shadow-sm">{data.company || 'Company'}</h3>
          <p className="text-xs text-white/80">Issued by HR</p>
        </div>
        {data.role && (
          <div className="absolute top-6 right-6 bg-white/90 text-slate-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-white">
            <Briefcase size={12} className="text-indigo-500" />
            {data.role}
          </div>
        )}
      </div>

      <div className="flex-1 px-8 pt-8 pb-6 flex flex-col items-center text-center relative">
        <div className="relative -mt-20 z-10 group/avatar cursor-pointer no-print" onClick={handleImageClick}>
          <div className="w-24 h-24 rounded-xl bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden relative">
            {data.image ? (
              <img
                src={data.image}
                alt={data.name}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-700 relative">
                <div className={`absolute inset-0 opacity-10 ${headerBg}`}></div>
                {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            {isImageLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center no-export">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity no-export">
              <Plus className="text-white" size={32} />
            </div>
          </div>

          <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1 rounded-full border-2 border-white shadow-md transform translate-y-1 opacity-0 group-hover/avatar:opacity-100 transition-opacity no-export">
            <Plus size={14} />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        <h1 className="mt-4 text-2xl font-black text-slate-800 leading-tight line-clamp-2">
          {data.name}
        </h1>
        <p className="text-sm text-slate-500">{data.passType || 'Employee'}</p>
        <p className="text-xs uppercase text-slate-400 mt-1">ID: {data.registrationId || data.schoolId || 'Pending'}</p>

        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400">
              <Building2 size={14} />
              <span className="text-[11px] font-semibold uppercase">Department</span>
            </div>
            <span className="text-sm font-semibold text-slate-700 text-right max-w-[150px] truncate">
              {data.tracks && data.tracks[0] ? data.tracks[0] : data.role || 'Staff'}
            </span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400">
              <Phone size={14} className="text-indigo-500" />
              <span className="text-[11px] font-semibold uppercase">Contact</span>
            </div>
            <span className="text-sm font-semibold text-slate-700 text-right max-w-[150px] truncate">
              {data.contactNumber || '—'}
            </span>
          </div>
          {data.address && (
            <div className="flex items-start gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <MapPin size={14} className="text-indigo-500 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Office</p>
                <p className="text-sm font-semibold text-slate-700 leading-snug">{data.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 h-28 border-t border-slate-100 flex items-center justify-center px-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Scan for details</span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm hover:ring-2 hover:ring-indigo-500 hover:border-transparent transition-all cursor-pointer group relative"
            title="Click to view employee details"
          >
            <QRCodeSVG
              value={`${baseUrl}/verify/${data.verificationCode || data.id}`}
              size={64}
              bgColor="white"
              fgColor="#1e293b"
              level="M"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/10 rounded opacity-0 group-hover:opacity-100 transition-opacity no-export">
              <span className="sr-only">Scan</span>
            </div>
          </button>
          <span className="text-[10px] font-medium text-slate-500 font-mono tracking-wider">{data.verificationCode || 'N/A'}</span>
        </div>
      </div>

      <div className={`h-1.5 w-full ${headerBg}`}></div>
    </>
  );
  return (
    <>
      <div
        id={`card-${data.id}`}
        className={`relative w-[320px] h-[500px] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border-[1px] ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-slate-900' : ''} ${borderColor} print-break-inside-avoid transform transition-all hover:scale-[1.02] duration-300 group`}
      >
        {/* Selection Checkbox (Hidden in Print and Export) */}
        <div className="absolute top-4 left-4 z-30 no-print no-export">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/20 border-white/50 hover:bg-white/40'}`}
          >
            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        </div>

        {/* Action Buttons (Hidden in Print and Export, Visible on Hover) */}
        <div className="absolute top-4 right-4 z-30 no-print no-export opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white hover:bg-white hover:text-indigo-600 transition-colors shadow-sm"
            title="Edit Attendee"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white hover:bg-white hover:text-red-600 transition-colors shadow-sm"
            title="Delete Attendee"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white hover:bg-white hover:text-emerald-600 transition-colors shadow-sm"
            title={`Download ${downloadFormat.toUpperCase()}`}
          >
            <Download size={14} />
          </button>
        </div>

        {/* Use custom layout renderer when layout is provided, otherwise fall back to template-based renderers */}
        {layout ? renderCustomLayoutCard() : (
          template === 'blank' ? (
            /* Blank template - just a white canvas */
            <div className="w-full h-full bg-white rounded-2xl" />
          ) : template === 'school-classic' ? renderSchoolCard() : template === 'company-id' ? renderCompanyCard() : renderConferenceCard()
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div
            className="absolute inset-0"
            onClick={() => setIsModalOpen(false)}
            aria-label="Close modal"
          ></div>

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

            {/* Modal Header */}
            <div className={`${headerBg} p-6 flex justify-between items-start`}>
              <div className="text-white">
                <h2 className="text-xl font-bold">{template === 'school-classic' ? 'Student Profile' : 'Attendee Details'}</h2>
                <p className="text-white/80 text-sm mt-1">Scanned Information</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                  {data.image ? (
                    <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-lg text-slate-700">
                      {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Name</p>
                  <h3 className="text-lg font-bold text-slate-800">{data.name}</h3>
                  {data.role && (
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <Star size={12} className="text-amber-500" />
                      <span>{data.role}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Building2 size={14} />
                    <span className="text-[10px] font-bold uppercase">{template === 'school-classic' ? 'School' : 'Company'}</span>
                  </div>
                  <p className="font-semibold text-slate-700 text-sm truncate" title={data.company || data.schoolName}>{data.schoolName || data.company}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Hash size={14} />
                    <span className="text-[10px] font-bold uppercase">Reg ID</span>
                  </div>
                  <p className="font-mono font-semibold text-slate-700 text-sm truncate" title={data.registrationId}>{data.registrationId}</p>
                </div>

                {template === 'school-classic' && (
                  <>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Hash size={14} />
                        <span className="text-[10px] font-bold uppercase">School ID</span>
                      </div>
                      <p className="font-semibold text-slate-700 text-sm truncate" title={data.schoolId || data.registrationId}>{data.schoolId || data.registrationId}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <CalendarClock size={14} />
                        <span className="text-[10px] font-bold uppercase">D.O.B</span>
                      </div>
                      <p className="font-semibold text-slate-700 text-sm truncate">{data.dateOfBirth || '—'}</p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Ticket size={14} />
                  <span className="text-xs font-bold uppercase">{template === 'school-classic' ? 'Class' : 'Pass Type'}</span>
                </div>
                {template === 'school-classic' ? (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200">
                    {data.className ? `Class ${data.className}${data.section ? ` • ${data.section}` : ''}` : 'Not set'}
                  </div>
                ) : (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200">
                    {data.passType}
                  </div>
                )}
              </div>

              {(data.tracks && data.tracks.length > 0) || (data.extras && Object.keys(data.extras).length > 0) ? (
                <div className="space-y-3">
                  {data.tracks && data.tracks.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-slate-400">
                        <ListChecks size={14} />
                        <span className="text-xs font-bold uppercase">Registered Tracks</span>
                      </div>
                      <ul className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                        {data.tracks.map((track, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                            <span>{track}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}


                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">Verified by AgileID Pro System</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
