"""Flask web interface for Patent Relevance Scoring Engine."""
import os
import asyncio
import json
import base64
from datetime import datetime
from pathlib import Path
from threading import Thread
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pipeline import PatentRelevancePipeline
from models import InventionInput
from hooks import PipelineHooks

# Initialize Flask app
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class SessionManager:
    """Manages evaluation sessions."""
    
    def __init__(self):
        self.sessions = {}
        self.current_session_id = None
    
    def create_session(self, session_id):
        """Create a new session."""
        self.sessions[session_id] = {
            "status": "pending",
            "progress": [],
            "result": None,
            "error": None,
            "start_time": datetime.now().isoformat(),
        }
        self.current_session_id = session_id
    
    def update_progress(self, session_id, message, level="info"):
        """Update session progress."""
        if session_id in self.sessions:
            self.sessions[session_id]["progress"].append({
                "message": message,
                "level": level,
                "timestamp": datetime.now().isoformat(),
            })
    
    def set_status(self, session_id, status):
        """Set session status."""
        if session_id in self.sessions:
            self.sessions[session_id]["status"] = status
    
    def set_result(self, session_id, result):
        """Set evaluation result."""
        if session_id in self.sessions:
            self.sessions[session_id]["result"] = result
    
    def set_error(self, session_id, error):
        """Set error."""
        if session_id in self.sessions:
            self.sessions[session_id]["error"] = error
    
    def get_session(self, session_id):
        """Get session data."""
        return self.sessions.get(session_id, {})


# Global session manager
session_manager = SessionManager()


class WebHooks(PipelineHooks):
    """Custom hooks for web interface updates."""
    
    def __init__(self, session_id, session_manager):
        super().__init__()
        self.session_id = session_id
        self.session_manager = session_manager
        self.agents_status = {}
    
    def on_agent_start(self, agent_name: str) -> None:
        """Called when agent starts."""
        super().on_agent_start(agent_name)
        message = f"🚀 Starting {agent_name}..."
        self.session_manager.update_progress(self.session_id, message)
        self.agents_status[agent_name] = "running"
    
    def on_agent_end(self, agent_name: str, output, input_tokens=0, output_tokens=0) -> None:
        """Called when agent ends."""
        super().on_agent_end(agent_name, output, input_tokens, output_tokens)
        message = f"✅ {agent_name} complete ({output_tokens} tokens)"
        self.session_manager.update_progress(self.session_id, message)
        self.agents_status[agent_name] = "complete"
    
    def on_score_generated(self, dimension: str, raw_score: float, confidence: float, sources_count: int) -> None:
        """Called when score is generated."""
        super().on_score_generated(dimension, raw_score, confidence, sources_count)
        message = f"📊 {dimension}: {raw_score:.1f}/5.0 (confidence: {confidence:.2f})"
        self.session_manager.update_progress(self.session_id, message)
    
    def on_validation_error(self, agent_name: str, error_msg: str) -> None:
        """Called when validation fails."""
        super().on_validation_error(agent_name, error_msg)
        message = f"⚠️  Validation error in {agent_name}: {error_msg}"
        self.session_manager.update_progress(self.session_id, message, level="warning")
    
    def on_quality_check(self, agent_name: str, quality_issues: list) -> None:
        """Called after quality review."""
        super().on_quality_check(agent_name, quality_issues)
        if quality_issues:
            message = f"🔍 Quality issues found ({len(quality_issues)})"
            self.session_manager.update_progress(self.session_id, message, level="warning")


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')


def run_evaluation_async(session_id, invention, images_data):
    """Run evaluation in background thread."""
    try:
        session_manager.update_progress(session_id, "📝 Processing patent idea...")
        session_manager.update_progress(session_id, "🔄 Running Technology Feasibility Agent...")
        
        # Create pipeline with custom hooks
        web_hooks = WebHooks(session_id, session_manager)
        
        # Run pipeline synchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        pipeline = PatentRelevancePipeline(enable_hooks=False)
        pipeline.hooks = web_hooks
        
        result = loop.run_until_complete(pipeline.evaluate(invention))
        
        # Add progress messages for other agents
        session_manager.update_progress(session_id, "✅ Technology Feasibility Agent complete")
        session_manager.update_progress(session_id, "🔄 Running Market Demand Agent...")
        session_manager.update_progress(session_id, "✅ Market Demand Agent complete")
        session_manager.update_progress(session_id, "🔄 Running Competitive Advantage Agent...")
        session_manager.update_progress(session_id, "✅ Competitive Advantage Agent complete")
        session_manager.update_progress(session_id, "🔄 Validating outputs...")
        session_manager.update_progress(session_id, "✅ Validation complete")
        session_manager.update_progress(session_id, "🔄 Running scoring engine...")
        session_manager.update_progress(session_id, "✅ Scoring complete - PRS: {:.1f}/100".format(result.patent_relevance_score))
        session_manager.update_progress(session_id, "🔄 Running quality review...")
        session_manager.update_progress(session_id, "✅ Quality review complete")
        session_manager.update_progress(session_id, "🔄 Generating SWOT analysis...")
        session_manager.update_progress(session_id, "✅ SWOT analysis complete!")
        
        session_manager.set_status(session_id, "completed")
        session_manager.set_result(session_id, {
            "result": result.model_dump(),
            "images": images_data,
        })
        
    except Exception as e:
        session_manager.set_status(session_id, "failed")
        session_manager.set_error(session_id, str(e))
        session_manager.update_progress(session_id, f"❌ Error: {str(e)}", level="error")


@app.route('/api/evaluate', methods=['POST'])
def evaluate():
    """Evaluate a patent idea."""
    try:
        # Get JSON data
        data = request.get_json()
        
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        technical_domain = data.get('technical_domain', 'General').strip()
        application_domains = data.get('application_domains', [])
        images = data.get('images', [])
        
        # Validate input
        if not title or len(title) < 5:
            return jsonify({"error": "Title must be at least 5 characters"}), 400
        
        if not description or len(description) < 20:
            return jsonify({"error": "Description must be at least 20 characters"}), 400
        
        # Create session
        session_id = f"eval_{int(datetime.now().timestamp() * 1000)}"
        session_manager.create_session(session_id)
        session_manager.set_status(session_id, "running")
        
        # Create invention input
        invention = InventionInput(
            idea_id=session_id,
            title=title,
            description=description,
            technical_domain=technical_domain,
            application_domains=application_domains or ['General'],
        )
        
        # Save images metadata
        images_data = []
        for idx, img in enumerate(images):
            if isinstance(img, dict) and 'data' in img:
                images_data.append({
                    "name": img.get('name', f'image_{idx}'),
                    "data": img['data'][:100] + '...' if len(img['data']) > 100 else img['data']
                })
        
        # Run evaluation in background thread
        eval_thread = Thread(target=run_evaluation_async, args=(session_id, invention, images_data))
        eval_thread.daemon = True
        eval_thread.start()
        
        return jsonify({
            "session_id": session_id,
            "status": "started",
            "message": "Evaluation started, check status for progress"
        }), 202
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status/<session_id>', methods=['GET'])
def get_status(session_id):
    """Get evaluation status."""
    session = session_manager.get_session(session_id)
    
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    # Return progress as list of messages for frontend
    progress_messages = [msg.get("message", str(msg)) if isinstance(msg, dict) else str(msg) 
                        for msg in session.get("progress", [])]
    
    return jsonify({
        "status": session.get("status"),
        "progress": progress_messages,
        "error": session.get("error"),
        "start_time": session.get("start_time"),
    }), 200


@app.route('/api/result/<session_id>', methods=['GET'])
def get_result(session_id):
    """Get evaluation result."""
    session = session_manager.get_session(session_id)
    
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    if session["status"] not in ["completed", "complete"]:
        return jsonify({"error": f"Evaluation status: {session['status']}"}), 400
    
    result_data = session.get("result", {})
    if isinstance(result_data, dict) and "result" in result_data:
        return jsonify(result_data["result"]), 200
    
    return jsonify(result_data), 200


@app.route('/uploads/<filename>', methods=['GET'])
def download_file(filename):
    """Download uploaded file."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/health', methods=['GET'])
def health():
    """Health check."""
    return jsonify({"status": "ok"}), 200


if __name__ == '__main__':
    print("🚀 Starting Patent Relevance Scoring Engine Web Interface...")
    print("📍 http://localhost:5000")
    print("✨ Open browser and submit your patent ideas!")
    app.run(debug=True, host='0.0.0.0', port=5000)
