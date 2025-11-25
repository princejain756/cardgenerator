import { Attendee } from '../types';

export const parseTSVData = (text: string): Attendee[] => {
  const lines = text.split('\n');
  const attendees: Attendee[] = [];
  
  // Skip headers if detected, usually the first line containing "SL. NO."
  let startProcessing = false;

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // Detect header row to start processing
    if (cleanLine.toUpperCase().startsWith('SL. NO.')) {
      startProcessing = true;
      return;
    }

    if (!startProcessing) {
      // Sometimes data starts immediately if no header provided in snippet
      // But based on user input, there are headers.
      // If we see a record looking line before header, we might miss it, 
      // but let's assume standard format provided.
      // If line 1 matches pattern, treat as data.
      if (cleanLine.match(/^\d+\t/)) {
        startProcessing = true;
      } else {
        return;
      }
    }

    // Ignore section headers like "Only Workshop Passes"
    if (cleanLine.toLowerCase().includes('only workshop passes')) return;

    const columns = line.split('\t');

    // Robust check for column length. 
    // Based on input: 0:SL, 1:RegID, 2:Name, 3:Company, 4:Track/Pass
    if (columns.length < 4) return;

    const name = columns[2]?.trim();
    const company = columns[3]?.trim();
    
    // Filter out rows that are effectively empty or headers
    if (!name || name === 'NAME') return;

    // Determine Pass Type and additional tracks
    const rawPassData = columns.slice(4).filter(c => c && c.trim() !== '');
    const mainPass = rawPassData[0] || 'General Entry';
    const tracks = rawPassData.slice(1);

    // Heuristic for Role detection
    let role: 'Speaker' | 'Attendee' | 'Organizer' = 'Attendee';
    const lowerTracks = tracks.map(t => t.toLowerCase());

    if (lowerTracks.some(t => t.includes('speaker'))) {
      role = 'Speaker';
    } else if (lowerTracks.some(t => t.includes('organizer'))) {
      role = 'Organizer';
    }

    attendees.push({
      id: `att-${index}`,
      registrationId: columns[1]?.trim() || 'N/A',
      name: name,
      company: company,
      passType: mainPass,
      tracks: tracks,
      role: role
    });
  });

  return attendees;
};
