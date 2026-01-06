import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Attendee } from '../types';
import { X, Save } from 'lucide-react';

interface EditModalProps {
  attendee: Attendee | null; // Null means we might be in bulk mode or closed
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<Attendee>) => void;
  isBulk?: boolean; // If true, we only show fields common for bulk edit
  count?: number; // Number of items being edited in bulk
}

export const EditModal: React.FC<EditModalProps> = ({ 
  attendee, 
  isOpen, 
  onClose, 
  onSave, 
  isBulk = false,
  count = 0
}) => {
  const [formData, setFormData] = useState<Partial<Attendee>>({});

  useEffect(() => {
    if (isOpen && !isBulk && attendee) {
      setFormData({ ...attendee });
    } else if (isOpen && isBulk) {
      setFormData({}); // Reset for bulk edit
    }
  }, [isOpen, attendee, isBulk]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof Attendee, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900/50 p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isBulk ? `Bulk Edit (${count} items)` : 'Edit Attendee'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isBulk ? 'Fields left blank will remain unchanged.' : 'Update badge details.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {!isBulk && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  required={!isBulk}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Registration ID</label>
                <input
                  type="text"
                  value={formData.registrationId || ''}
                  onChange={(e) => handleChange('registrationId', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  required={!isBulk}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Company {isBulk && <span className="text-slate-500 font-normal italic">(Optional)</span>}
            </label>
            <input
              type="text"
              value={formData.company || ''}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder={isBulk ? "Leave blank to keep existing" : ""}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Pass Type {isBulk && <span className="text-slate-500 font-normal italic">(Optional)</span>}
            </label>
            <input
              type="text"
              value={formData.passType || ''}
              onChange={(e) => handleChange('passType', e.target.value)}
              placeholder={isBulk ? "Leave blank to keep existing" : ""}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">School ID</label>
              <input
                type="text"
                value={formData.schoolId || ''}
                onChange={(e) => handleChange('schoolId', e.target.value)}
                placeholder={isBulk ? "Auto-detected from file" : ""}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">School Name</label>
              <input
                type="text"
                value={formData.schoolName || ''}
                onChange={(e) => handleChange('schoolName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Class</label>
              <input
                type="text"
                value={formData.className || ''}
                onChange={(e) => handleChange('className', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
              <input
                type="text"
                value={formData.section || ''}
                onChange={(e) => handleChange('section', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Father's Name</label>
              <input
                type="text"
                value={formData.fatherName || ''}
                onChange={(e) => handleChange('fatherName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mother's Name</label>
              <input
                type="text"
                value={formData.motherName || ''}
                onChange={(e) => handleChange('motherName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date of Birth</label>
              <input
                type="text"
                value={formData.dateOfBirth || ''}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                placeholder="e.g., 29-08-2005"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contact Number</label>
              <input
                type="text"
                value={formData.contactNumber || ''}
                onChange={(e) => handleChange('contactNumber', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
            <textarea
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-600/20 transition-all transform active:scale-95"
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
