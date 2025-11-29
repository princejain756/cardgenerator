import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Attendee, CardTemplate } from '../types';
import { X, Save } from 'lucide-react';

interface EditModalProps {
  attendee: Attendee | null; // Null means we might be in bulk mode or closed
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<Attendee>) => void;
  isBulk?: boolean; // If true, we only show fields common for bulk edit
  count?: number; // Number of items being edited in bulk
  customFields: string[];
  onAddCustomField: (label: string) => void;
  onDeleteCustomField: (label: string) => void;
  template: CardTemplate;
  focusedField?: string | null;
  onClearFocus?: () => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  attendee,
  isOpen,
  onClose,
  onSave,
  isBulk = false,
  count = 0,
  customFields,
  onAddCustomField,
  onDeleteCustomField,
  template,
  focusedField,
  onClearFocus
}) => {
  const [formData, setFormData] = useState<Partial<Attendee>>({});
  const [removedFields, setRemovedFields] = useState<Set<string>>(new Set());
  const mergedCustomFields = React.useMemo(() => {
    const extras = Object.keys(formData.extraFields || {});
    return Array.from(new Set([...(customFields || []), ...extras]));
  }, [customFields, formData.extraFields]);
  const isConference = template === 'conference-modern';
  const isSchool = template === 'school-classic';
  const isMono = template === 'mono-slim';
  const fieldRefs = React.useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});
  const assignRef = (key: string) => (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
    fieldRefs.current[key] = el;
  };

  useEffect(() => {
    if (isOpen && !isBulk && attendee) {
      setFormData({ ...attendee });
      setRemovedFields(new Set());
    } else if (isOpen && isBulk) {
      setFormData({}); // Reset for bulk edit
      setRemovedFields(new Set());
    }
  }, [isOpen, attendee, isBulk]);

  useEffect(() => {
    if (!focusedField) return;
    const node = fieldRefs.current[focusedField];
    if (node) {
      setTimeout(() => {
        node.focus();
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 30);
    }
    onClearFocus?.();
  }, [focusedField, onClearFocus, formData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extras = { ...(formData.extraFields || {}) };
    removedFields.forEach((label) => {
      extras[label] = '';
    });
    onSave({ ...formData, extraFields: extras });
    onClose();
  };

  const handleChange = (field: keyof Attendee, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExtraFieldChange = (label: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      extraFields: {
        ...(prev.extraFields || {}),
        [label]: value
      }
    }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center p-4 md:p-8 bg-slate-900/75 backdrop-blur-lg animate-in fade-in duration-150 overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative w-full max-w-4xl bg-slate-900/70 rounded-3xl shadow-[0_20px_80px_rgba(15,23,42,0.55)] border border-slate-700/70 overflow-hidden animate-in zoom-in-90 duration-200 backdrop-blur-xl flex flex-col max-h-[92vh] mt-6 mb-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 px-6 py-5 border-b border-slate-700/70 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[12px] uppercase tracking-[0.22em] text-indigo-300/80 font-semibold">{isBulk ? 'Batch Update' : 'Edit Attendee'}</p>
            <h2 className="text-2xl font-black text-white leading-tight">
              {isBulk ? `${count} selected cards` : formData.name || attendee?.name || 'Badge details'}
            </h2>
            <p className="text-slate-400 text-sm">{isBulk ? 'Only fields you fill will overwrite existing data.' : 'Tidy up the badge before you print or share.'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 pb-32 pt-4 space-y-6 custom-scrollbar min-h-0">
            {!isBulk && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    ref={assignRef('name')}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required={!isBulk}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Registration ID</label>
                  <input
                    type="text"
                    value={formData.registrationId || ''}
                    onChange={(e) => handleChange('registrationId', e.target.value)}
                    ref={assignRef('registrationId')}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required={!isBulk}
                  />
                </div>
              </div>
            )}

            {isConference && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Event Name {isBulk && <span className="text-slate-500 normal-case">(optional)</span>}</label>
                    <input
                      type="text"
                      value={formData.eventName || ''}
                      onChange={(e) => handleChange('eventName', e.target.value)}
                      placeholder={isBulk ? "Leave blank to keep existing" : ""}
                      ref={assignRef('eventName')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Event Subtitle / Tagline</label>
                    <input
                      type="text"
                      value={formData.eventSubtitle || ''}
                      onChange={(e) => handleChange('eventSubtitle', e.target.value)}
                      ref={assignRef('eventSubtitle')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Event Start Date</label>
                    <input
                      type="text"
                      value={formData.eventStartDate || ''}
                      onChange={(e) => handleChange('eventStartDate', e.target.value)}
                      placeholder="dd/mm/yyyy or text"
                      ref={assignRef('eventStartDate')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Event End Date</label>
                    <input
                      type="text"
                      value={formData.eventEndDate || ''}
                      onChange={(e) => handleChange('eventEndDate', e.target.value)}
                      placeholder="dd/mm/yyyy or text"
                      ref={assignRef('eventEndDate')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Valid From</label>
                    <input
                      type="text"
                      value={formData.validFrom || ''}
                      onChange={(e) => handleChange('validFrom', e.target.value)}
                      placeholder="dd/mm/yyyy or text"
                      ref={assignRef('validFrom')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Valid To</label>
                    <input
                      type="text"
                      value={formData.validTo || ''}
                      onChange={(e) => handleChange('validTo', e.target.value)}
                      placeholder="dd/mm/yyyy or text"
                      ref={assignRef('validTo')}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Company / School {isBulk && <span className="text-slate-500 normal-case">(optional)</span>}</label>
                  <input
                    type="text"
                    value={formData.company || ''}
                    onChange={(e) => handleChange('company', e.target.value)}
                    placeholder={isBulk ? "Leave blank to keep existing" : ""}
                    ref={assignRef('company')}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Pass Type {isBulk && <span className="text-slate-500 normal-case">(optional)</span>}</label>
                  <input
                    type="text"
                    value={formData.passType || ''}
                    onChange={(e) => handleChange('passType', e.target.value)}
                    placeholder={isBulk ? "Leave blank to keep existing" : ""}
                    ref={assignRef('passType')}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

            {(isConference || isMono) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Job Title / What they do</label>
                <input
                  type="text"
                  value={formData.jobTitle || ''}
                  onChange={(e) => handleChange('jobTitle', e.target.value)}
                  ref={assignRef('jobTitle')}
                  className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Role</label>
                <select
                  value={formData.role || ''}
                  onChange={(e) => handleChange('role', e.target.value as any)}
                  ref={assignRef('role')}
                  className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                    <option value="">Select role</option>
                    <option value="Attendee">Attendee</option>
                    <option value="Speaker">Speaker</option>
                    <option value="Organizer">Organizer</option>
                  </select>
                </div>
              </div>
            )}

            {isSchool && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">School ID</label>
                  <input
                    type="text"
                    value={formData.schoolId || ''}
                    onChange={(e) => handleChange('schoolId', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Class</label>
                  <input
                    type="text"
                    value={formData.className || ''}
                    onChange={(e) => handleChange('className', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Section</label>
                  <input
                    type="text"
                    value={formData.section || ''}
                    onChange={(e) => handleChange('section', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Contact Number</label>
                <input
                  type="text"
                  value={formData.contactNumber || ''}
                  onChange={(e) => handleChange('contactNumber', e.target.value)}
                  className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              {isSchool && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Father's Name</label>
                    <input
                      type="text"
                      value={formData.fatherName || ''}
                      onChange={(e) => handleChange('fatherName', e.target.value)}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Mother's Name</label>
                    <input
                      type="text"
                      value={formData.motherName || ''}
                      onChange={(e) => handleChange('motherName', e.target.value)}
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {isSchool && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={(e) => handleChange('dob', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Blood Group</label>
                  <input
                    type="text"
                    value={formData.bloodGroup || ''}
                    onChange={(e) => handleChange('bloodGroup', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Tracks / Tags</label>
                  <input
                    type="text"
                    value={Array.isArray(formData.tracks) ? formData.tracks.join(', ') : ''}
                    onChange={(e) => handleChange('tracks', e.target.value.split(',').map(t => t.trim()).filter(Boolean) as unknown as any)}
                    placeholder="Comma separated"
                    ref={assignRef('tracks')}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
            </div>

            {isConference && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Sponsored By</label>
                  <input
                    type="text"
                    value={formData.sponsor || ''}
                    onChange={(e) => handleChange('sponsor', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Barcode / QR Value</label>
                  <input
                    type="text"
                    value={formData.barcodeValue || ''}
                    onChange={(e) => handleChange('barcodeValue', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Address</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[110px]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Custom Fields</label>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('New field label (applies to all cards)');
                    if (name) onAddCustomField(name);
                  }}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:border-emerald-400 hover:text-white transition-colors"
                >
                  + Add Field
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mergedCustomFields.map((label) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</label>
                      <button
                        type="button"
                        onClick={() => {
                          setRemovedFields((prev) => new Set(prev).add(label));
                          onDeleteCustomField(label);
                          setFormData((prev) => {
                            const nextExtras = { ...(prev.extraFields || {}) };
                            delete nextExtras[label];
                            return { ...prev, extraFields: nextExtras };
                          });
                        }}
                        className="text-[11px] text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                      <input
                        type="text"
                        value={(formData.extraFields || {})[label] || ''}
                        onChange={(e) => handleExtraFieldChange(label, e.target.value)}
                        ref={assignRef(`custom:${label}`)}
                        className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="Optional"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-slate-900/85 backdrop-blur-md border-t border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm font-semibold border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98]"
            >
              <Save size={16} />
              {isBulk ? 'Apply Changes' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
