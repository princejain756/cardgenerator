const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ParsedAttendee {
  name: string;
  company: string;
  passType: string;
  registrationId: string;
  role?: 'Speaker' | 'Attendee' | 'Organizer' | 'Student' | 'Teacher';
  tracks?: string[];
  schoolId?: string;
  schoolName?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  contactNumber?: string;
  address?: string;
  className?: string;
  section?: string;
  emergencyContact?: string;
  extras?: Record<string, string>;
  template?: 'conference' | 'school-classic' | 'company-id';
}

export const analyzeFileWithMistral = async (
  fileContent: string,
  fileType: string,
  customLabels?: Record<string, string>,
  selectedTemplate?: 'conference' | 'school-classic' | 'company-id'
): Promise<ParsedAttendee[]> => {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER API key');
  }
  try {
    // Extract just the header row for analysis
    const lines = fileContent.split('\n').filter(l => l.trim());
    const headerLine = lines[0] || '';

    // Take a small sample (first 3 rows) for context
    const sampleLines = lines.slice(0, 3).join('\n');
    const headerDelimiter = headerLine.includes('\t') ? '\t' : ',';
    const headerColumns = headerLine.split(headerDelimiter).map((h: string) => h.trim());

    // Build custom label hints if provided
    let customLabelHints = '';
    if (customLabels && Object.keys(customLabels).length > 0) {
      const labelMappings = Object.entries(customLabels).map(([key, label]) => `"${label}" -> ${key}`).join(', ');
      customLabelHints = `\n\nIMPORTANT: The user has renamed some fields. Use these custom labels to help map columns:\n${labelMappings}\n\nFor example, if a column is named "Student Name", map it to "name" if the user renamed the name field to "Student Name".`;
    }

    // Template-specific hints
    let templateHint = '';
    if (selectedTemplate === 'school-classic') {
      templateHint = '\n\nCONTEXT: The user selected SCHOOL ID template. Prioritize mapping: name, schoolId (roll number), className (class/grade), section, fatherName, motherName, dateOfBirth, address, contactNumber, schoolName.';
    } else if (selectedTemplate === 'company-id') {
      templateHint = '\n\nCONTEXT: The user selected CORPORATE template. Prioritize mapping: name, company, role (designation/title), registrationId (employee ID), contactNumber, address.';
    } else {
      templateHint = '\n\nCONTEXT: The user selected CONFERENCE template. Prioritize mapping: name, company, passType (ticket type), registrationId, role, tracks.';
    }

    const prompt = `You are analyzing a ${fileType} file for ID card generation.
${templateHint}

Sample data (header + 2 rows):
${sampleLines}
${customLabelHints}

Map the column headers to these fields (0-indexed):
- name: attendee or student name
- company: company/organization (or leave -1 for school rosters)
- passType: pass/ticket type or category
- registrationId: ticket/registration number
- role: Speaker/Attendee/Organizer/Teacher/Student
- tracks: workshop/track/session columns (array)
- schoolId: school-issued ID / roll number
- schoolName: school name
- fatherName
- motherName
- dateOfBirth
- contactNumber (phone)
- address (full address)
- className (class/grade)
- section (class section)
- emergencyContact
- extras: array of any other useful columns with { "label": "fieldLabel", "index": columnNumber }. Include EVERY column in extras using the header name as the label, even if it also maps to a primary field.

Return ONLY JSON like:
{
  "name": 2,
  "company": 3,
  "passType": 4,
  "registrationId": 1,
  "role": -1,
  "tracks": [5, 6, 7],
  "schoolId": 8,
  "schoolName": 9,
  "fatherName": 10,
  "motherName": 11,
  "dateOfBirth": 12,
  "contactNumber": 13,
  "address": 14,
  "className": 15,
  "section": 16,
  "emergencyContact": 17,
  "extras": [{"label": "bloodGroup", "index": 18}, {"label": "city", "index": 4}]
}

Use -1 if a field is not present.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'AgileID Pro'
      },
      body: JSON.stringify({
        model: 'google/gemma-3n-e4b-it:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error Details:', errorData);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from AI');
    }

    // Parse the column mapping
    let columnMapping: any;
    try {
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
      }
      columnMapping = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse column mapping:', content);
      throw new Error('Failed to parse AI response');
    }

    // Now parse all data rows using the column mapping
    const parsedData: ParsedAttendee[] = [];
    const dataLines = lines.slice(1); // Skip header

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      // Split by tab or comma
      const delimiter = line.includes('\t') ? '\t' : ',';
      const columns = line.split(delimiter).map(c => c.trim());

      // Skip if it looks like a section header
      if (columns.length < 3) continue;

      const pick = (idx: number) => (typeof idx === 'number' && idx >= 0 && columns[idx]) ? columns[idx] : '';

      const name = pick(columnMapping.name) || 'Unknown';
      const company = pick(columnMapping.company) || pick(columnMapping.schoolName) || 'Self';
      const passType = pick(columnMapping.passType) || 'Student ID';
      const registrationId = pick(columnMapping.registrationId) || pick(columnMapping.schoolId) || pick(columnMapping.id) || `AUTO_${i + 1}`;

      // Extract tracks from multiple columns
      const tracks: string[] = [];
      if (Array.isArray(columnMapping.tracks)) {
        for (const trackCol of columnMapping.tracks) {
          const trackValue = columns[trackCol];
          if (trackValue && trackValue !== '' && trackValue.toLowerCase() !== 'name') {
            tracks.push(trackValue);
          }
        }
      }

      // Determine role
      let role: 'Speaker' | 'Attendee' | 'Organizer' | 'Student' | 'Teacher' = 'Attendee';
      const roleColumn = columnMapping.role >= 0 ? columns[columnMapping.role] : '';
      if (roleColumn) {
        const lowerRole = roleColumn.toLowerCase();
        if (lowerRole.includes('speaker')) role = 'Speaker';
        else if (lowerRole.includes('organizer')) role = 'Organizer';
        else if (lowerRole.includes('teacher')) role = 'Teacher';
        else if (lowerRole.includes('student')) role = 'Student';
      }

      const extras: Record<string, string> = {};
      if (Array.isArray(columnMapping.extras)) {
        columnMapping.extras.forEach((extra: any) => {
          const label = extra?.label;
          const idx = extra?.index;
          const value = pick(idx);
          if (label && value) {
            extras[label] = value;
          }
        });
      }

      // Always include EVERY header/value as extra for custom label matching
      // Even if a column is mapped to a primary field, we still add it to extras
      // so that when users rename elements, they can access the original column data
      headerColumns.forEach((label, idx) => {
        const value = pick(idx);
        if (value !== undefined && value !== null && `${value}`.trim() !== '') {
          extras[label] = value;
        }
      });

      const schoolHints = [
        pick(columnMapping.schoolId),
        pick(columnMapping.schoolName),
        pick(columnMapping.fatherName),
        pick(columnMapping.motherName),
        pick(columnMapping.className),
        pick(columnMapping.section),
        pick(columnMapping.dateOfBirth),
        pick(columnMapping.emergencyContact),
        pick(columnMapping.address)
      ].filter(Boolean);
      const passIsStudent = passType.toLowerCase().includes('student');
      const roleIsStudent = role === 'Student' || role === 'Teacher';
      const hasSchoolSignals = schoolHints.length > 0 || passIsStudent || roleIsStudent;
      const companyValue = pick(columnMapping.company);
      const educationHeaders = headerColumns.some(h => /grade|gpa|class|student|school|university|age/i.test(h));
      const hasCorporateSignals = !hasSchoolSignals && companyValue && companyValue.toLowerCase() !== 'self';
      const template: ParsedAttendee['template'] = hasSchoolSignals || educationHeaders ? 'school-classic' : hasCorporateSignals ? 'company-id' : 'conference';

      parsedData.push({
        name,
        company,
        passType,
        registrationId,
        role,
        tracks,
        schoolId: pick(columnMapping.schoolId),
        schoolName: pick(columnMapping.schoolName),
        fatherName: pick(columnMapping.fatherName),
        motherName: pick(columnMapping.motherName),
        dateOfBirth: pick(columnMapping.dateOfBirth),
        contactNumber: pick(columnMapping.contactNumber),
        address: pick(columnMapping.address),
        className: pick(columnMapping.className),
        section: pick(columnMapping.section),
        emergencyContact: pick(columnMapping.emergencyContact),
        extras,
        template
      });
    }

    return parsedData;
  } catch (error) {
    console.error('Mistral AI Analysis Error:', error);
    throw error;
  }
};

export const analyzeDemographics = async (companies: string[], passTypes: string[]): Promise<string> => {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER API key');
  }
  try {
    const companySample = companies.slice(0, 100).join(", ");
    const passSample = passTypes.slice(0, 100).join(", ");

    const prompt = `I have a list of conference attendees.
Companies: ${companySample}
Pass Types: ${passSample}

Please provide a concise, professional executive summary (max 3 bullet points) describing the demographic profile of this conference. 
Focus on the types of industries represented (e.g., Banking, Tech, Consulting) and the seniority implied by the pass types.
Keep it brief and in plain text format.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'AgileID Pro'
      },
      body: JSON.stringify({
        model: 'google/gemma-3n-e4b-it:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error Details:', errorData);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Analysis complete.";
  } catch (error) {
    console.error("Mistral Analysis Error:", error);
    return "Unable to generate AI insights at this time. Please check your connection.";
  }
};
