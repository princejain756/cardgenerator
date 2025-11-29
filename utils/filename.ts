import { Attendee } from '../types';

type ImageExtension = 'png' | 'jpg';

const sanitize = (value: string): string => {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

const applyTemplate = (template: string, attendee: Attendee): string => {
  const safeTemplate = template && template.trim() ? template : '{name}_IDCARD';
  const replacements: Record<string, string> = {
    name: attendee.name || 'Attendee',
    company: attendee.company || 'Company',
    registrationId: attendee.registrationId || 'ID',
    schoolId: attendee.schoolId || attendee.registrationId || 'ID',
    passType: attendee.passType || 'Pass',
    role: attendee.role || 'Attendee'
  };

  return safeTemplate.replace(/\{(name|company|registrationId|schoolId|passType|role)\}/gi, (_, key) => {
    const normalizedKey = key.toLowerCase();
    return replacements[normalizedKey] ?? '';
  });
};

export const buildCardFilename = (
  attendee: Attendee,
  template: string,
  extension: ImageExtension
): string => {
  const rendered = applyTemplate(template, attendee);
  const sanitized = sanitize(rendered);
  const fallback = sanitized || 'IDCard';
  return `${fallback}.${extension}`;
};
