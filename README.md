# HTML Style Processor Backend Service

Backend service that fetches HTML and computed styles from Google Cloud Storage and processes them.

## Installation

```bash
npm install
```

## Configuration

Add your credentials to `.env`:
```
GOOGLE_CREDENTIALS=/path/to/service-account.json
DATABASE_URL=postgresql://user:password@host:port/database
CLAUDE_API_KEY=your_claude_api_key_here
```

## Run

```bash
npm start
```

## API Endpoints

### Step 1: Fetch Files from GCS
```bash
GET /api/gcs/fetch
```
Returns HTML and computed styles JSON from GCS bucket.

### Step 2: Process HTML with Styles
```bash
GET /api/html-processor/process
```
Returns styled HTML with inline styles applied.

### Step 3: Extract Widgets
```bash
GET /api/widgets/extract
```
Returns HTML with widget placeholders (pure HTML output).
- Extracts widget elements: h1, h2, h3, h4, h5, h6, p, svg, img, video, span, button, a, etc.
- Replaces widgets with {{widget-1}}, {{widget-2}}, etc.
- **Stores all widgets in database** (NeonDB PostgreSQL)
- Returns HTML with widget placeholders

### Step 4: Extract Components
```bash
GET /api/components/extract
```
Returns cleaned HTML with component placeholders (pure HTML output).
- Takes widget-replaced HTML from Step 3 as input
- Extracts specific IDs: pinnedTopLeft, pinnedTopRight, pinnedBottomLeft
- Extracts all top-level sections
- Replaces components with {{wigoh-id-001}}, {{wigoh-id-002}}, etc.
- **Stores each component in database** (NeonDB PostgreSQL)
- Returns HTML template with component placeholders

### Step 5: Optimize Components with AI
```bash
GET /api/ai/optimize
```
Returns optimization results (JSON response).
- Fetches all extracted components from database
- Sends each component to Claude AI for optimization
- Uses XML prompting for better structured output
- Reduces code by 70-85% while maintaining pixel-perfect visual output
- **Stores optimized components in database** (NeonDB PostgreSQL)
- Returns summary with line reduction statistics

**AI Optimization Features:**
- CSS Grid-first responsive layout
- Inline styles only (no external CSS)
- Maintains all {{widget-xx}} placeholders
- Pixel-perfect visual match to original
- Responsive design using grid functions (repeat, minmax, clamp)

**Requirements:**
- Set `CLAUDE_API_KEY` in `.env` file
- Components must be extracted first (Step 4)

### Step 6: Reconstruct Final HTML
```bash
GET /api/reconstruction/build
```
Returns fully reconstructed HTML (HTML response).
- Fetches `placeholder_html` from database (template with `{{wigoh-id-XXX}}`)
- Fetches all `optimized_components` from database
- Replaces `{{wigoh-id-001}}` with matching optimized component (matches `wig-id="{{wigoh-id-001}}"`)
- Fetches all `widgets` from database
- Replaces `{{widget-1}}`, `{{widget-2}}`, etc. with actual widget HTML
- **Saves final reconstructed HTML to database** (NeonDB PostgreSQL)
- Returns complete HTML with all components and widgets assembled

**Reconstruction Process:**
1. Template: `<div>{{wigoh-id-001}}</div>`
2. Find optimized component with `wig-id="{{wigoh-id-001}}"`
3. Replace placeholder with optimized component HTML
4. Find widgets: `{{widget-1}}`, `{{widget-2}}`, etc.
5. Replace widget placeholders with actual HTML
6. Return final assembled HTML

### Step 7: Convert HTML to JSON
```bash
GET /api/html-to-json/convert
```
Returns DOM tree JSON structure (JSON response).
- Fetches reconstructed HTML from database
- Parses HTML into hierarchical DOM tree structure
- Converts to JSON format with tagName, attributes, and children
- **Saves JSON to database** (NeonDB PostgreSQL)
- Returns complete DOM tree as JSON

**JSON Structure:**
```json
{
  "tagName": "div",
  "attributes": {
    "id": "root",
    "style": "display:grid;..."
  },
  "children": [
    {
      "tagName": "section",
      "attributes": { "wig-id": "{{wigoh-id-001}}" },
      "children": [...]
    },
    "Text content here"
  ]
}
```

### Step 8: Upload JSON to GCS
```bash
GET /api/gcs-upload/upload
```
Returns upload confirmation with job details (JSON response).
- Fetches JSON from database
- Generates unique job ID (timestamp-based)
- Uploads to GCS bucket: `wigoh-migration/karthik_local/try_10/wigoh_migrator-280501/`
- Makes file publicly accessible
- Returns job ID, file path, and public URL

**Response:**
```json
{
  "success": true,
  "message": "JSON uploaded to GCS successfully",
  "data": {
    "jobId": "job_1234567890_abc123",
    "fileName": "job_1234567890_abc123.json",
    "filePath": "gs://wigoh-migration/karthik_local/try_10/wigoh_migrator-280501/job_1234567890_abc123.json",
    "publicUrl": "https://storage.googleapis.com/wigoh-migration/karthik_local/try_10/wigoh_migrator-280501/job_1234567890_abc123.json",
    "totalNodes": 1234
  }
}
```

## Database

The service automatically creates six tables:

### Components Table
Stores individual extracted components:

```sql
CREATE TABLE components (
  id SERIAL PRIMARY KEY,
  placeholder_id VARCHAR(50) NOT NULL,
  original_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Indexes: `placeholder_id`, `original_id`

### Placeholder HTML Table
Stores the cleaned HTML with placeholders:

```sql
CREATE TABLE placeholder_html (
  id SERIAL PRIMARY KEY,
  html_content TEXT NOT NULL,
  total_placeholders INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

This table stores the main HTML template with `{{wigoh-id-001}}` style placeholders.

### Widgets Table
Stores extracted widget elements:

```sql
CREATE TABLE widgets (
  id SERIAL PRIMARY KEY,
  widget_key VARCHAR(50) NOT NULL,
  widget_html TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Index: `widget_key`

Widget elements extracted: h1, h2, h3, h4, h5, h6, p, svg, img, video, span, button, a, text, wow-image, wix-video, wow-svg, wow-icon, wow-canvas, main

### Optimized Components Table
Stores AI-optimized component HTML:

```sql
CREATE TABLE optimized_components (
  id SERIAL PRIMARY KEY,
  component_id INTEGER REFERENCES components(id),
  original_html TEXT NOT NULL,
  optimized_html TEXT NOT NULL,
  original_lines INTEGER,
  optimized_lines INTEGER,
  reduction_percentage DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Index: `component_id`

This table stores Claude AI-optimized versions of components with 70-85% line reduction while maintaining pixel-perfect visual output.

### Reconstructed HTML Table
Stores the final assembled HTML:

```sql
CREATE TABLE reconstructed_html (
  id SERIAL PRIMARY KEY,
  html_content TEXT NOT NULL,
  total_components INTEGER,
  total_widgets INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

This table stores the final HTML after replacing all component and widget placeholders with their actual optimized HTML from the database.

### HTML JSON Table
Stores the DOM tree JSON representation:

```sql
CREATE TABLE html_json (
  id SERIAL PRIMARY KEY,
  json_content JSONB NOT NULL,
  total_nodes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

This table stores the hierarchical DOM tree structure in JSON format (JSONB for efficient querying) with tagName, attributes, and children for each node.

## Project Structure

```
.
├── controllers/
│   └── mainController.ts              # HTTP request handlers
├── services/
│   ├── gcsService.ts                  # Step 1: GCS file fetching
│   ├── htmlStyleProcessorService.ts   # Step 2: HTML style processing
│   ├── widgetExtractionService.ts     # Step 3: Widget extraction
│   ├── componentExtractionService.ts  # Step 4: Component extraction
│   ├── aiService.ts                   # Step 5: AI optimization with Claude
│   ├── reconstructionService.ts       # Step 6: HTML reconstruction
│   ├── htmlToJsonService.ts           # Step 7: HTML to JSON conversion
│   ├── gcsUploadService.ts            # Step 8: Upload JSON to GCS
│   └── databaseService.ts             # Database connection & operations
├── routes/
│   ├── gcsRoutes.ts                   # Step 1 route
│   ├── htmlProcessorRoutes.ts         # Step 2 route
│   ├── widgetRoutes.ts                # Step 3 route
│   ├── componentRoutes.ts             # Step 4 route
│   ├── aiRoutes.ts                    # Step 5 route
│   ├── reconstructionRoutes.ts        # Step 6 route
│   ├── htmlToJsonRoutes.ts            # Step 7 route
│   └── gcsUploadRoutes.ts             # Step 8 route
├── server.js                           # Entry point
└── package.json
```
