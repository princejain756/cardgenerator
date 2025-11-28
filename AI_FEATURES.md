# AI-Powered Features

## File Upload with Mistral AI Analysis

Mani ID Pro now uses **Mistral AI** (via OpenRouter) to intelligently parse and categorize uploaded attendee files.

### Supported File Formats
- `.txt` - Plain text files
- `.csv` - Comma-separated values
- `.tsv` - Tab-separated values
- `.xlsx` / `.xls` - Microsoft Excel files
- `.md` - Markdown files

### How It Works

1. **Upload Your File**: Click "Import Data" and select any supported file type
2. **AI Processing**: Mistral AI analyzes the content and extracts:
   - Attendee names
   - Company/organization
   - Pass types (conference, workshop, lite, etc.)
   - Registration IDs
   - Roles (Speaker, Attendee, Organizer)
   - Workshop tracks

3. **Smart Categorization**: The AI intelligently:
   - Identifies column headers regardless of format
   - Handles various data layouts
   - Categorizes attendees by role
   - Extracts multiple pass types and tracks
   - Generates registration IDs if missing

### AI Model Details
- **Model**: `mistralai/mistral-small-2409`
- **Provider**: OpenRouter
- **Temperature**: 0.3 (for consistent parsing)
- **Max Tokens**: 4000

### Fallback Mechanism
If AI processing fails (network issues, API errors), the system automatically falls back to basic TSV/CSV parsing to ensure your data is never lost.

### Demographics Analysis
The "Generate Insight" button uses the same Mistral AI model to provide:
- Industry representation analysis
- Seniority/role distribution
- Executive summary of attendee demographics

### Privacy & Security
- File processing happens via secure HTTPS API calls
- No data is stored on external servers
- API calls include proper referrer headers for tracking
