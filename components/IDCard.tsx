import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Attendee, CardTemplate, TemplateSettings } from '../types';
import { QrCode, Building2, Ticket, Star, X, Hash, ListChecks, Plus, Edit2, Check, Download, Trash2, Phone, MapPin, CalendarDays } from 'lucide-react';
import QRCode from 'qrcode';
import { toJpeg, toPng } from 'html-to-image';
import { buildCardFilename } from '../utils/filename';

interface IDCardProps {
  data: Attendee;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onFieldEdit?: (fieldKey: string) => void;
  onImageUpload: (file: File) => void;
  onDelete: () => void;
  downloadFormat: 'png' | 'jpg';
  filenameTemplate: string;
  template: CardTemplate;
  templateSettings: TemplateSettings;
  hiddenFields?: Set<string>;
  onLogoUpload?: (file: File) => void;
  onColorChange?: (color: string) => void;
  onPrincipalSignUpload?: (file: File) => void;
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
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

const formatDateShort = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // Format as DD-MM-YYYY
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatDateRange = (start?: string, end?: string) => {
  const startText = formatDateShort(start) || start;
  const endText = formatDateShort(end) || end;
  if (startText && endText) return `${startText} - ${endText}`;
  return startText || endText || '';
};

const formatClass = (className?: string, section?: string) => {
  if (!className && !section) return '';
  if (className && section) return `${className} - ${section}`;
  return className || section || '';
};

const getCustomFields = (extras?: Record<string, string>, exclude: string[] = []) => {
  if (!extras) return [];
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return Object.entries(extras)
    .filter(([key, value]) => value && !skip.has(key.toLowerCase()))
    .map(([key, value]) => ({ key, value }));
};

export const IDCard: React.FC<IDCardProps> = ({
  data,
  isSelected,
  onToggleSelect,
  onEdit,
  onFieldEdit,
  onImageUpload,
  onLogoUpload,
  onColorChange,
  onPrincipalSignUpload,
  onDelete,
  downloadFormat,
  filenameTemplate,
  template,
  templateSettings,
  hiddenFields
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signInputRef = useRef<HTMLInputElement>(null);
  const headerBg = getCategoryColor(data.passType);
  const borderColor = getBorderColor(data.passType);

  const isHidden = (label?: string) => {
    if (!hiddenFields || !label) return false;
    const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const labelNorm = normalize(label);

    for (const field of hiddenFields) {
      const base = normalize(field);
      const variants = new Set<string>([base]);
      if (base.includes('dateofbirth')) {
        variants.add('dob');
        variants.add('birthdate');
      }
      if (base === 'dob') {
        variants.add('dateofbirth');
        variants.add('birthdate');
      }

      for (const variant of variants) {
        if (
          variant === labelNorm ||
          variant.includes(labelNorm) ||
          labelNorm.includes(variant)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const palette = {
    primary: templateSettings.primaryColor || '#1d4ed8',
    accent: templateSettings.accentColor || '#38bdf8'
  };
  const schoolGradient = `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`;
  const qrValue = data.barcodeValue || data.registrationId || data.id;
  useEffect(() => {
    if (!qrValue) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(qrValue, { margin: 0, width: 256 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrValue]);
  const triggerFieldEdit = (fieldKey: string) => {
    if (onFieldEdit) return onFieldEdit(fieldKey);
    return onEdit();
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

  const handleLogoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLogoUpload) {
      onLogoUpload(file);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    if (onColorChange) {
      onColorChange(newColor);
    }
  };

  const handleSignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    signInputRef.current?.click();
  };

  const handleSignFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPrincipalSignUpload) {
      onPrincipalSignUpload(file);
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

  const renderAvatar = (size = 'w-24 h-24', bordered = true) => (
    <div className={`relative ${size} rounded-full bg-white ${bordered ? 'border-4 border-white shadow-lg' : ''} flex items-center justify-center overflow-hidden`}>
      {data.image ? (
        <img
          src={data.image}
          alt={data.name}
          className="w-full h-full object-cover object-center"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-3xl font-bold text-slate-700 relative`}>
          <div className={`absolute inset-0 opacity-10 ${headerBg}`}></div>
          {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      )}
      {/* Background Removal Processing Indicator */}
      {data.isProcessingImage && (
        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[10px] text-blue-600 mt-2 font-semibold">Removing background...</p>
        </div>
      )}
      {isImageLoading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center no-export">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );

  const renderSchoolCard = () => {
    // Reference design implementation
    const primaryColor = templateSettings.primaryColor || '#1d4ed8'; // Use template color

    return (
      <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-lg relative">
        <input
          type="file"
          ref={logoInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleLogoFileChange}
        />
        {/* Header with Curve */}
        <div
          className="relative h-[180px] overflow-hidden"
          style={{ backgroundColor: primaryColor }}
        >
          {/* Visible Color Picker Button */}
          <div className="absolute top-2 right-2 z-30 no-export">
            <label
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center cursor-pointer bg-white/20 backdrop-blur-sm"
              title="Change card color"
            >
              <span className="text-lg pointer-events-none">🎨</span>
              <input
                type="color"
                value={primaryColor}
                onChange={handleColorChange}
                className="absolute opacity-0 w-0 h-0"
              />
            </label>
          </div>
          {/* Curve SVG */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 320" className="w-full h-auto block translate-y-1">
              <path fill="#ffffff" fillOpacity="1" d="M0,224L80,213.3C160,203,320,181,480,181.3C640,181,800,203,960,213.3C1120,224,1280,224,1360,224L1440,224L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
            </svg>
          </div>

          <div className="relative z-10 flex items-start p-3 gap-2 pt-4">
            {/* Logo Placeholder */}
            <div
              className={`w-14 h-14 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${templateSettings.logo ? '' : 'rounded-full bg-white border-2 border-yellow-400 shadow-md'
                }`}
              onClick={handleLogoClick}
              title="Click to upload school logo"
            >
              {templateSettings.logo ? (
                <img src={templateSettings.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-blue-700 font-bold text-xl">
                  {templateSettings.brandName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* School Details */}
            <div className="text-white flex-1 text-center pr-2">
              <h2 className="text-lg font-bold leading-tight mb-0.5 drop-shadow-md line-clamp-2">{templateSettings.brandName}</h2>
              <p className="text-[9px] font-medium opacity-90 mb-0.5">(Govt. Recognised)</p>
              <p className="text-[9px] leading-tight opacity-90 max-w-[180px] mx-auto line-clamp-2">
                {data.address ? data.address.split(',').slice(1).join(',') : 'Place your address, District State and Pin - 000000'}
              </p>
              <div className="mt-0.5 bg-blue-800/50 inline-block px-2 py-0.5 rounded text-[10px] font-bold border border-blue-400/30">
                Phone No.: {templateSettings.contactNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Photo Section */}
        <div className="relative z-20 flex flex-col items-center -mt-16">
          <div
            className="w-28 h-32 bg-white p-1 shadow-lg border border-slate-200 cursor-pointer group relative"
            onClick={handleImageClick}
            title="Click to upload photo"
          >
            {data.image ? (
              <img
                src={data.image}
                alt={data.name}
                className="w-full h-full object-cover object-center border border-slate-100"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                <Plus className="opacity-50 group-hover:opacity-100 transition-opacity" size={24} />
              </div>
            )}
            {/* Hover overlay for existing image */}
            {data.image && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="text-white" size={20} />
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-2">{data.name}</h1>
        </div>

        {/* Data Table */}
        <div className="px-6 mt-4 flex-1">
          <div className="border-t border-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {(templateSettings.layout?.table || ['fatherName', 'motherName', 'dob', 'contactNumber', 'bloodGroup']).map((fieldKey) => {
                  // Get the value from data
                  const value = (data as any)[fieldKey] || (data.extraFields || {})[fieldKey];
                  if (!value) return null;

                  // Get the label
                  const fieldLabels: Record<string, string> = {
                    fatherName: "Father's Name",
                    motherName: "Mother's Name",
                    dob: 'D.O.B.',
                    contactNumber: 'Contact No.',
                    bloodGroup: 'Blood Group',
                    address: 'Address',
                    schoolId: 'School ID',
                    className: 'Class',
                    section: 'Section',
                    ...templateSettings.layout?.defaults
                  };

                  const label = fieldLabels[fieldKey] || fieldKey.replace(/([A-Z])/g, ' $1').trim();
                  const displayValue = fieldKey === 'dob' ? formatDateShort(value) : value;

                  return (
                    <tr key={fieldKey}>
                      <td className="py-1.5 font-semibold text-slate-600 w-1/3">{label}</td>
                      <td className="py-1.5 text-slate-800 pl-2">{displayValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dynamic Footer Fields */}
          {(templateSettings.layout?.footer || ['address']).some(fieldKey => {
            const value = (data as any)[fieldKey] || (data.extraFields || {})[fieldKey];
            return !!value;
          }) && (
              <div className="mt-3 pt-2 border-t border-slate-200">
                {(templateSettings.layout?.footer || ['address']).map((fieldKey) => {
                  const value = (data as any)[fieldKey] || (data.extraFields || {})[fieldKey];
                  if (!value) return null;

                  const fieldLabels: Record<string, string> = {
                    address: 'Add.',
                    className: 'Class',
                    section: 'Section',
                    ...templateSettings.layout?.defaults
                  };

                  const label = fieldLabels[fieldKey] || fieldKey.replace(/([A-Z])/g, ' $1').trim();

                  return (
                    <p key={fieldKey} className="text-[11px] text-slate-600 leading-tight mb-1">
                      <span className="font-bold">{label}:</span> {value}
                    </p>
                  );
                })}
              </div>
            )}

          {/* Custom extra fields */}
          {getCustomFields(data.extraFields, [
            ...(templateSettings.layout?.table || []),
            ...(templateSettings.layout?.footer || []),
            'address'
          ]).length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-[11px] uppercase text-slate-400 font-bold mb-2">Custom</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getCustomFields(data.extraFields, [
                  ...(templateSettings.layout?.table || []),
                  ...(templateSettings.layout?.footer || []),
                  'address'
                ]).map(({ key, value }) => (
                  <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.12em] truncate">{key}</p>
                    <p className="text-[12px] font-semibold text-slate-800 break-words leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(data.tracks) && data.tracks.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase text-slate-400 font-bold mb-2">Tracks / Tags</p>
              <div className="flex flex-wrap gap-2">
                {data.tracks.map((track, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 border border-slate-200">
                    {track}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 pt-2 flex items-end justify-between mt-auto">
          <input
            type="file"
            ref={signInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleSignFileChange}
          />
          <div className="text-sm font-bold text-slate-800">
            Class : {formatClass(data.className, data.section) || '1st'}
          </div>
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group"
            onClick={handleSignClick}
            title="Click to upload principal signature"
          >
            <div className="w-20 h-8 flex items-end justify-center relative">
              {templateSettings.principalSign ? (
                <img
                  src={templateSettings.principalSign}
                  alt="Principal Signature"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="font-cursive text-blue-800 text-lg leading-none transform -rotate-6 group-hover:opacity-70 transition-opacity">Sign</div>
              )}
            </div>
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide group-hover:text-blue-600 transition-colors">Principal Sign.</div>
          </div>
        </div>
      </div>
    );
  };

  const renderConferenceCard = () => {
    const heroGradient = {
      backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`
    };
    const eventName = data.eventName || templateSettings.brandName || '';
    const eventSubtitle = data.eventSubtitle || templateSettings.brandTagline || '';
    const eventRange = formatDateRange(data.eventStartDate, data.eventEndDate);
    const validityRange = formatDateRange(data.validFrom, data.validTo);
    const sponsor = data.sponsor || templateSettings.footerNote || '';
    const barcodeText = data.barcodeValue || data.registrationId;
    const roleLine = data.jobTitle || data.role || data.company;
    const location = data.address || templateSettings.address;
    const passLabel = data.passType || 'General Entry';
    const customFields = getCustomFields(data.extraFields, ['address']);

    return (
      <div className={`flex flex-col h-full bg-white rounded-[28px] overflow-hidden border ${borderColor} shadow-2xl relative`}>
        <div className="relative h-48 overflow-hidden">
          <div className="absolute inset-0" style={heroGradient}></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.18),transparent_30%)]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-slate-900/40 to-slate-900/60 mix-blend-overlay"></div>
          <div className="absolute top-4 right-4 w-16 h-16 rounded-full border border-white/20 bg-white/5 backdrop-blur"></div>
          {(eventName || eventSubtitle) && (
            <div className="absolute top-5 left-6 right-24 text-white space-y-1">
              {eventSubtitle && <p className="text-[11px] uppercase tracking-[0.24em] font-semibold text-white/80 line-clamp-1">{eventSubtitle}</p>}
              {eventName && <h3 className="text-2xl font-black leading-snug line-clamp-2">{eventName}</h3>}
            </div>
          )}
          <div className="absolute bottom-4 left-6 text-white/90 space-y-1 text-sm">
            {eventRange && (
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="opacity-80" />
                <span className="font-semibold tracking-wide">{eventRange}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-white/80 text-[13px]">
                <MapPin size={14} className="opacity-80" />
                <span className="line-clamp-1">{location}</span>
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 left-0 right-0 text-white">
            <svg viewBox="0 0 500 60" preserveAspectRatio="none" className="w-full h-12">
              <path d="M0,30 C120,60 180,0 320,35 C420,60 500,10 500,10 L500,60 L0,60 Z" fill="#ffffff"></path>
            </svg>
          </div>
        </div>

        <div className="flex-1 px-6 pb-5 pt-0 relative flex flex-col">
          <div className="relative w-full flex justify-center -mt-14">
            <div className="relative group/avatar cursor-pointer" onClick={handleImageClick}>
              {renderAvatar('w-28 h-28')}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity no-export rounded-full">
                <Plus className="text-white" size={32} />
              </div>
            </div>
          </div>

          <h1
            className="mt-3 text-2xl font-black text-slate-900 leading-tight text-center line-clamp-2 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); triggerFieldEdit('name'); }}
          >
            {data.name}
          </h1>
          {roleLine && (
            <p
              className="text-sm font-semibold text-indigo-600 text-center mt-1 line-clamp-2 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('jobTitle'); }}
            >
              {roleLine}
            </p>
          )}

          <div className="mt-4 flex justify-center">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white px-4 py-3 rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center gap-3">
              <div className="text-sm font-black tracking-wide uppercase">Pass</div>
              <div className="text-left">
                <p className="text-[11px] uppercase text-white/80 font-semibold leading-tight">Category</p>
                <p className="text-base font-black leading-none">{passLabel}</p>
              </div>
            </div>
          </div>

          {validityRange && (
            <div
              className="mt-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('validity'); }}
            >
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays size={14} />
                <span className="text-[11px] uppercase tracking-[0.14em] font-bold">Validity</span>
              </div>
              <span className="text-sm font-semibold text-slate-800">{validityRange}</span>
            </div>
          )}

          {!isHidden('Registration ID') && (
            <div
              className="mt-3 bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('registrationId'); }}
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Ticket size={14} />
                <span className="text-[11px] uppercase tracking-[0.14em] font-bold">ID</span>
              </div>
              <span className="text-sm font-mono font-semibold text-slate-800">{data.registrationId}</span>
            </div>
          )}

          {(customFields.length > 0 || sponsor || barcodeText) && (
            <div className="mt-auto pt-5 space-y-4">
              {(customFields.length > 0 || sponsor) && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-inner">
                  {customFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 auto-rows-fr">
                      {customFields.slice(0, 8).map(({ key, value }) => (
                        <div
                          key={key}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col justify-between min-h-[64px] cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); triggerFieldEdit(`custom:${key}`); }}
                        >
                          <p className="text-[9px] uppercase text-slate-400 font-bold tracking-[0.12em] truncate">{key}</p>
                          <p className="text-[11px] font-semibold text-slate-800 break-words leading-snug line-clamp-3">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {customFields.length > 8 && (
                    <p className="mt-2 text-[10px] text-slate-500">+{customFields.length - 8} more fields hidden</p>
                  )}
                  {sponsor && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.16em]">Sponsored By</p>
                      <p className="text-sm font-semibold text-slate-800 line-clamp-2">{sponsor}</p>
                    </div>
                  )}
                </div>
              )}

              {barcodeText && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-inner">
                  <div className="text-left">
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.14em]">Scan / Barcode</p>
                    <p className="text-[11px] font-mono text-slate-600">{barcodeText}</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-lg border border-slate-200">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR" className="w-14 h-14" />
                    ) : (
                      <QrCode size={44} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmployeeCard = () => {
    const heroGradient = { backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})` };
    const company = data.company || templateSettings.brandName || 'Organization';
    const tagline = data.passType || templateSettings.brandTagline || '';
    const employeeId = data.registrationId || data.schoolId || data.barcodeValue || data.id;
    const joinDate = data.validFrom || data.eventStartDate || '';
    const expiryDate = data.validTo || data.eventEndDate || '';
    const emergency = data.contactNumber || templateSettings.contactNumber || '';
    const qrText = data.barcodeValue || data.registrationId || data.id;
    const role = data.jobTitle || data.role || templateSettings.badgeLabel || 'Employee';

    return (
      <div className="flex flex-col h-full bg-white rounded-[26px] overflow-hidden border border-slate-200 shadow-2xl relative">
        <div className="relative h-40 overflow-hidden">
          <div className="absolute inset-0" style={heroGradient}></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.16),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_35%)]"></div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[120%] h-20 bg-white rounded-[50%]"></div>
          <div className="relative z-10 text-center text-white pt-6 px-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/80">Employee ID</p>
            <h2
              className="text-lg font-bold leading-tight cursor-pointer"
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('company'); }}
            >
              {company}
            </h2>
            {tagline && (
              <p
                className="text-[11px] text-white/80 mt-1 line-clamp-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); triggerFieldEdit('passType'); }}
              >
                {tagline}
              </p>
            )}
          </div>
        </div>

        <div className="relative flex flex-col items-center px-6 -mt-12 z-10">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
            {data.image ? (
              <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-500">
                {data.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="w-full mt-4 space-y-3 text-center">
            <div
              className="rounded-lg px-4 py-2 text-white font-bold shadow-lg cursor-pointer"
              style={{ background: palette.primary }}
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('name'); }}
            >
              {data.name || 'Employee'}
            </div>
            <div
              className="text-white font-semibold px-4 py-2 shadow-md cursor-pointer"
              style={{ background: palette.accent, clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}
              onClick={(e) => { e.stopPropagation(); triggerFieldEdit('jobTitle'); }}
            >
              {role}
            </div>
          </div>
        </div>

        <div className="px-6 mt-6 space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('registrationId'); }}>
            <span className="font-semibold text-slate-600">Employee ID</span>
            <span className="font-mono text-slate-800">{employeeId}</span>
          </div>
          {joinDate && (
            <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('validFrom'); }}>
              <span className="font-semibold text-slate-600">Joining Date</span>
              <span className="text-slate-800">{formatDateShort(joinDate) || joinDate}</span>
            </div>
          )}
          {expiryDate && (
            <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('validTo'); }}>
              <span className="font-semibold text-slate-600">Card Expiry</span>
              <span className="text-slate-800">{formatDateShort(expiryDate) || expiryDate}</span>
            </div>
          )}
          {emergency && (
            <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('contactNumber'); }}>
              <span className="font-semibold text-slate-600">Emergency</span>
              <span className="text-slate-800">{emergency}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 mt-auto flex items-center justify-between gap-3">
          <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('barcodeValue'); }}>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-bold">Verify by scanning</p>
            <p className="text-[12px] text-slate-700">{employeeId}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2 rounded-xl shadow">
            {qrText && qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" className="w-16 h-16" />
            ) : (
              <QrCode size={60} className="text-slate-600" />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMinimalCard = () => (
    <div className="flex flex-col h-full bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-xl relative group">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden z-0">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-indigo-100/50 to-purple-100/50 blur-3xl"></div>
        <div className="absolute top-10 -left-10 w-48 h-48 rounded-full bg-gradient-to-tr from-blue-100/40 to-teal-100/40 blur-2xl"></div>
      </div>

      {/* Header / Avatar Section */}
      <div className="relative z-10 flex flex-col items-center pt-8 pb-2 px-6">
        <div className="relative mb-3 group-hover:scale-105 transition-transform duration-500 ease-out">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div
            className="w-24 h-24 rounded-full p-1 bg-white shadow-lg relative overflow-hidden cursor-pointer"
            onClick={(e) => { e.stopPropagation(); triggerFieldEdit('image'); }}
          >
            {data.image ? (
              <img
                src={data.image}
                alt={data.name}
                className="w-full h-full object-cover object-center rounded-full"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            ) : (
              <div className={`w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-slate-700 bg-slate-50`}>
                {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {/* Status Indicator */}
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        <h2
          className="text-xl font-black text-slate-800 text-center leading-tight mb-1 line-clamp-1 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); triggerFieldEdit('name'); }}
        >
          {data.name}
        </h2>
        <div className="px-3 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold tracking-wide uppercase">
          {templateSettings.badgeLabel || 'Student'}
        </div>
      </div>

      {/* Info Grid */}
      <div className="relative z-10 flex-1 px-5 py-1 flex flex-col justify-center">
        <div className="bg-slate-50/80 backdrop-blur-sm rounded-xl p-3 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('registrationId'); }}>
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
              <Hash size={12} />
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">ID Number</p>
                <p className="text-xs font-bold text-slate-700 font-mono">{data.schoolId || data.registrationId}</p>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-200/60"></div>

          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('className'); }}>
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
              <Building2 size={12} />
            </div>
            <div>
                <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Class / Section</p>
                <p className="text-xs font-bold text-slate-700">{formatClass(data.className, data.section) || data.passType}</p>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-slate-200/60"></div>

          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerFieldEdit('contactNumber'); }}>
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
              <Phone size={12} />
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Emergency</p>
                <p className="text-xs font-bold text-slate-700">{data.contactNumber || templateSettings.contactNumber}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-5 pb-5 pt-1">
        <div className="flex items-center gap-2 text-slate-500 bg-white rounded-lg p-2.5 border border-slate-100 shadow-sm">
          <MapPin size={14} className="text-indigo-500 flex-shrink-0" />
          <p
            className="text-[10px] font-medium leading-snug line-clamp-2 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); triggerFieldEdit('address'); }}
          >
            {data.address || templateSettings.address}
          </p>
        </div>
        {getCustomFields(data.extraFields).length > 0 && (
          <div className="mt-3 bg-white rounded-lg border border-slate-100 p-3 shadow-sm space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
            {getCustomFields(data.extraFields).map(({ key, value }) => (
              <div
                key={key}
                className="text-[11px] text-slate-600 flex justify-between gap-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); triggerFieldEdit(`custom:${key}`); }}
              >
                <span className="uppercase tracking-[0.14em] font-bold text-slate-400 truncate">{key}</span>
                <span className="text-[12px] font-semibold text-slate-800 text-right leading-snug break-words">{value}</span>
              </div>
            ))}
          </div>
        )}
        {qrValue && (
          <div className="mt-3 bg-white rounded-lg border border-slate-100 p-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-[0.14em]">Scan / Barcode</p>
              <p className="text-[11px] font-mono text-slate-700">{qrValue}</p>
            </div>
            <div className="bg-white border border-slate-200 p-2 rounded-lg shadow w-16 h-16 flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code" className="w-14 h-14" />
              ) : (
                <QrCode size={44} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderBody = () => {
    if (template === 'school-classic') return renderSchoolCard();
    if (template === 'employee-arc') return renderEmployeeCard();
    if (template === 'mono-slim') return renderMinimalCard();
    return renderConferenceCard();
  };

  // Keep a generous, uniform card footprint so no layout gets cropped and all cards align visually.
  const sizeClass = (() => {
    const base = 'w-[360px] h-[720px]';
    return base;
  })();

  return (
    <>
      <div
        id={`card-${data.id}`}
        className={`relative ${sizeClass} bg-white rounded-[28px] overflow-hidden shadow-2xl flex flex-col print-break-inside-avoid transform transition-all hover:scale-[1.02] duration-300 group border border-slate-200 ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-slate-900' : ''}`}
      >
        <div className="absolute top-4 left-4 z-30 no-print no-export">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-sm backdrop-blur ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/90 border-slate-300 text-slate-600 hover:border-indigo-400'}`}
          >
            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        </div>

        <div className="absolute top-4 right-4 z-30 no-print no-export flex flex-col gap-2 bg-white/85 backdrop-blur rounded-xl p-1 shadow-lg border border-slate-200/80">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-9 h-9 rounded-lg bg-white text-slate-700 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center"
            title="Edit Details"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-9 h-9 rounded-lg bg-white text-slate-700 border border-slate-200 hover:border-red-400 hover:text-red-600 transition-colors flex items-center justify-center"
            title="Delete Attendee"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-lg bg-white text-slate-700 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center"
            title={`Download ${downloadFormat.toUpperCase()}`}
          >
            <Download size={15} />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        {renderBody()}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div
            className="absolute inset-0"
            onClick={() => setIsModalOpen(false)}
            aria-label="Close modal"
          ></div>

          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

            <div className={`${headerBg} p-6 flex justify-between items-start`}>
              <div className="text-white">
                <h2 className="text-xl font-bold">Card Details</h2>
                <p className="text-white/80 text-sm mt-1">Scanned information</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0`}>
                  {data.image ? (
                    <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center font-bold text-lg text-slate-700`}>
                      {data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Name</p>
                  <h3 className="text-lg font-bold text-slate-800">{data.name}</h3>
                  <p className="text-xs text-slate-500">{formatClass(data.className, data.section) || data.passType}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Hash size={14} />
                    <span className="text-[10px] font-bold uppercase">School ID</span>
                  </div>
                  <p className="font-mono font-semibold">{data.schoolId || data.registrationId}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <CalendarDays size={14} />
                    <span className="text-[10px] font-bold uppercase">D.O.B</span>
                  </div>
                  <p className="font-semibold">{formatDateShort(data.dob) || data.dob || '—'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Building2 size={14} />
                    <span className="text-[10px] font-bold uppercase">School</span>
                  </div>
                  <p className="font-semibold truncate" title={data.company}>{data.company}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Phone size={14} />
                    <span className="text-[10px] font-bold uppercase">Contact</span>
                  </div>
                  <p className="font-semibold">{data.contactNumber || templateSettings.contactNumber}</p>
                </div>
              </div>

              {data.address && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-[10px] font-bold uppercase">Address</span>
                  </div>
                  <p className="text-slate-700 text-sm leading-snug">{data.address}</p>
                </div>
              )}

              {data.tracks && data.tracks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
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
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">Verified by Mani ID Pro System</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
