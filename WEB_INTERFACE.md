# 🚀 Web Interface Startup Guide

## Quick Start

The web interface is now ready to launch! Follow these steps:

### 1. Install Dependencies (if needed)

```bash
pip install flask flask-cors
```

Or if using UV:
```bash
uv pip install flask flask-cors
```

### 2. Start the Web Server

```bash
python app.py
```

Or with UV:
```bash
uv run python app.py
```

You should see:
```
🚀 Starting Patent Relevance Scoring Engine Web Interface...
📍 http://localhost:5000
✨ Open browser and submit your patent ideas!
```

### 3. Open in Browser

Navigate to: **http://localhost:5000**

## Features

### 📋 Patent Submission
- **Title**: Name of your innovation (minimum 5 characters)
- **Description**: Detailed explanation (minimum 20 characters)
- **Technical Domain**: Category of technology (e.g., Software, Hardware, Biotech)
- **Application Domains**: Select multiple applicable domains:
  - DevOps
  - Cybersecurity
  - Healthcare
  - Finance
  - Education
  - Manufacturing
- **Attachments**: Upload related images (drag & drop supported)

### ⚡ Real-Time Progress
The right panel shows live updates as each agent evaluates your idea:
- 🚀 Agent start notifications
- 📊 Dimension scores as they're calculated
- ✅ Completion status
- ⚠️ Any validation issues

### 📊 Evaluation Results

Once complete, you'll see:

1. **Patent Relevance Score (PRS)**: 0-100 rating
2. **Dimension Scores**: Individual scores for:
   - Technology Feasibility (🔬)
   - Market Demand (📈)
   - Competitive Advantage (🏆)
   - Commercialization (💼)
   - Patent Strength (⚖️)
   - Team Capability (👥)

3. **Agent Details**: Click "View Details" to see:
   - Raw score (/5.0) and normalized score (/100)
   - Agent confidence level
   - Detailed analysis notes
   - Evidence and sources

4. **SWOT Analysis**:
   - 🟢 **Strengths** - Competitive advantages
   - 🔴 **Weaknesses** - Areas of concern
   - 🔵 **Opportunities** - Market potential
   - 🟠 **Threats** - External risks

5. **Quality Flags**: Any issues identified during evaluation
6. **Metrics**: Token usage, cost estimation, and execution time

## Architecture

### Backend (Python/Flask)
- **app.py**: Flask server with REST API
- **SessionManager**: Tracks multiple concurrent evaluations
- **WebHooks**: Integrates with pipeline for progress updates
- **Thread-based execution**: Non-blocking evaluation

### Frontend (HTML/CSS/JavaScript)
- **index.html**: Responsive UI with dual-panel layout
- **app.js**: Client-side logic for form handling, polling, and result display
- **CSS**: Modern gradient design with modals and animations

### Integration
- **PatentRelevancePipeline**: Backend evaluation engine
- **PipelineHooks**: Progress tracking callbacks
- **InventionInput**: Data model for patent ideas

## API Endpoints

### POST `/api/evaluate`
Submit a patent idea for evaluation.

**Request Body:**
```json
{
  "title": "Your Innovation Title",
  "description": "Detailed description...",
  "technical_domain": "Software",
  "application_domains": ["DevOps", "Finance"],
  "images": [
    {
      "name": "diagram.png",
      "data": "data:image/png;base64,..."
    }
  ]
}
```

**Response:**
```json
{
  "session_id": "eval_1234567890",
  "status": "started",
  "message": "Evaluation started, check status for progress"
}
```

### GET `/api/status/<session_id>`
Get current evaluation progress.

**Response:**
```json
{
  "status": "running",
  "progress": [
    "📝 Processing patent idea...",
    "🔄 Running Technology Feasibility Agent...",
    "✅ Technology Feasibility Agent complete"
  ],
  "error": null,
  "start_time": "2024-01-15T10:30:45.123456"
}
```

### GET `/api/result/<session_id>`
Get final evaluation results.

**Response:**
```json
{
  "prs_score": 76.5,
  "dimension_scores": {
    "technology_feasibility": {
      "raw_score": 4.2,
      "normalized_score": 84,
      "confidence": 0.92,
      "notes": "...",
      "sources": [...]
    },
    ...
  },
  "swot_analysis": {
    "strengths": [...],
    "weaknesses": [...],
    "opportunities": [...],
    "threats": [...]
  },
  "quality_flags": [],
  "usage_summary": {
    "total_tokens": 1250,
    "estimated_cost": 0.0045,
    "duration": 22.5,
    "agents_executed": 6
  }
}
```

## Troubleshooting

### Port Already in Use
If port 5000 is already in use, modify the last line of app.py:
```python
app.run(debug=True, host='0.0.0.0', port=8000)  # Change 5000 to 8000
```

### Flask Not Found
```bash
pip install flask flask-cors
```

### CORS Issues
Already configured with `CORS(app)` - works with same-origin requests.

### Large Files / Timeouts
- Max file size: 50MB
- Large evaluations may take 20-60 seconds
- Check network tab in browser DevTools if evaluation seems stuck

### Pipeline Errors
- Verify `main.py` runs successfully with `uv run python main.py`
- Check OpenAI API key is set in environment
- Review `output.json` for last successful evaluation

## Development

### Hot Reload
The Flask app runs in debug mode. Edit HTML/CSS/JS and refresh the browser.

To restart the Python backend, stop and restart app.py.

### Adding Custom Domains
Edit the checkbox list in `templates/index.html`:
```html
<input type="checkbox" name="application_domains" value="YourDomain" id="domain-custom">
<label for="domain-custom">Your Domain</label>
```

### Styling
All CSS is embedded in `index.html`. Modify the `<style>` section to customize colors, fonts, and layout.

### JavaScript Events
Key functions in `app.js`:
- `handleFileSelect()` - Image upload handling
- `pollEvaluationStatus()` - Progress polling
- `displayResults()` - Results rendering
- `showAgentDetails()` - Modal popups

## Performance Notes

- First evaluation: ~25-35 seconds (includes model initialization)
- Subsequent evaluations: ~20-25 seconds
- 6 agents run in parallel for faster evaluation
- Real-time progress updates poll every 1 second

## Next Steps

1. **Deploy**: Use a production WSGI server like Gunicorn
2. **Database**: Add persistent session storage with PostgreSQL/MongoDB
3. **Notifications**: Integrate email/Slack notifications for completed evaluations
4. **Authentication**: Add user accounts and API keys
5. **Export**: Add PDF/Excel export for results
6. **Analytics**: Track evaluation trends and common patterns

---

**Built with ❤️ using Flask, JavaScript, and OpenAI Agents SDK**
