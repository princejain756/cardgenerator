const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ParsedAttendee {
  name: string;
  company: string;
  passType: string;
  registrationId: string;
  role?: 'Speaker' | 'Attendee' | 'Organizer';
  tracks?: string[];
}

export const analyzeFileWithMistral = async (fileContent: string, fileType: string): Promise<ParsedAttendee[]> => {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER API key');
  }
  try {
    // Extract just the header row for analysis
    const lines = fileContent.split('\n').filter(l => l.trim());
    const headerLine = lines[0] || '';
    
    // Take a small sample (first 3 rows) for context
    const sampleLines = lines.slice(0, 3).join('\n');

    const prompt = `You are analyzing a ${fileType} file with attendee data. 

Sample data (header + 2 rows):
${sampleLines}

Analyze ONLY the column headers and tell me which column number (0-indexed) maps to each field:
- name: Which column has attendee names?
- company: Which column has company/organization?
- passType: Which column has pass/ticket type?
- registrationId: Which column has registration/ticket ID?
- role: Which column indicates role (Speaker/Attendee/Organizer)? (optional)
- tracks: Which columns have workshop/track names? (can be multiple)

Return ONLY a JSON object with the column mappings. Example:
{
  "name": 2,
  "company": 3,
  "passType": 4,
  "registrationId": 1,
  "role": -1,
  "tracks": [5, 6, 7]
}

Use -1 if a field is not found. For tracks, list all column indices that contain workshop/track/session names.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'AgileID Pro'
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
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

      const name = columns[columnMapping.name] || 'Unknown';
      const company = columns[columnMapping.company] || 'Self';
      const passType = columns[columnMapping.passType] || 'General Entry';
      const registrationId = columns[columnMapping.registrationId] || `AUTO_${i + 1}`;
      
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
      let role: 'Speaker' | 'Attendee' | 'Organizer' = 'Attendee';
      const roleColumn = columnMapping.role >= 0 ? columns[columnMapping.role] : '';
      if (roleColumn) {
        if (roleColumn.toLowerCase().includes('speaker')) role = 'Speaker';
        else if (roleColumn.toLowerCase().includes('organizer')) role = 'Organizer';
      }

      parsedData.push({
        name,
        company,
        passType,
        registrationId,
        role,
        tracks
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
        model: 'google/gemma-3-27b-it:free',
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
