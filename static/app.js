// State management
let currentSessionId = null;
let statusCheckInterval = null;
let uploadedImages = [];

// DOM Elements
const ideaForm = document.getElementById('ideaForm');
const submitBtn = document.getElementById('submitBtn');
const messagesContainer = document.getElementById('messagesContainer');
const resultsContainer = document.getElementById('resultsContainer');
const fileUpload = document.getElementById('fileUpload');
const imagesInput = document.getElementById('images');
const imagePreview = document.getElementById('imagePreview');
const agentModal = document.getElementById('agentModal');
const closeModal = document.getElementById('closeModal');

// File upload handlers
fileUpload.addEventListener('click', () => imagesInput.click());
fileUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUpload.style.borderColor = '#667eea';
    fileUpload.style.background = 'rgba(102, 126, 234, 0.05)';
});

fileUpload.addEventListener('dragleave', () => {
    fileUpload.style.borderColor = '#ddd';
    fileUpload.style.background = '';
});

fileUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect({ target: { files: files } });
    fileUpload.style.borderColor = '#ddd';
    fileUpload.style.background = '';
});

imagesInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    uploadedImages = [];
    imagePreview.innerHTML = '';

    files.forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                uploadedImages.push({
                    name: file.name,
                    data: event.target.result // base64
                });

                const previewItem = document.createElement('div');
                previewItem.className = 'image-item';
                previewItem.innerHTML = `
                    <img src="${event.target.result}" alt="${file.name}">
                    <button class="image-remove" onclick="removeImage(${index})" type="button">×</button>
                `;
                imagePreview.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        }
    });
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreviews();
}

function renderImagePreviews() {
    imagePreview.innerHTML = '';
    uploadedImages.forEach((img, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-item';
        previewItem.innerHTML = `
            <img src="${img.data}" alt="${img.name}">
            <button class="image-remove" onclick="removeImage(${index})" type="button">×</button>
        `;
        imagePreview.appendChild(previewItem);
    });
}

// Form submission
ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const technical_domain = document.getElementById('technical_domain').value;
    const selectedDomains = Array.from(document.querySelectorAll('input[name="application_domains"]:checked'))
        .map(cb => cb.value);

    if (!title.trim() || !description.trim()) {
        addMessage('Please fill in the required fields', 'error');
        return;
    }

    // Clear previous results
    messagesContainer.innerHTML = '';
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('active');
    submitBtn.disabled = true;

    addMessage('🚀 Starting evaluation...', 'info');

    try {
        // Submit evaluation
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                technical_domain: technical_domain || 'General',
                application_domains: selectedDomains.length > 0 ? selectedDomains : ['General'],
                images: uploadedImages
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentSessionId = data.session_id;

        addMessage(`✅ Evaluation session started (ID: ${currentSessionId.substring(0, 8)}...)`, 'success');
        addMessage('⏳ Running signal agents in parallel...', 'info');

        // Start polling for status
        pollEvaluationStatus();

    } catch (error) {
        addMessage(`❌ Error: ${error.message}`, 'error');
        submitBtn.disabled = false;
    }
});

function pollEvaluationStatus() {
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${currentSessionId}`);
            if (!response.ok) throw new Error('Failed to fetch status');

            const data = await response.json();

            // Display progress messages
            if (data.progress && data.progress.length > 0) {
                const existingMessages = document.querySelectorAll('.message[data-id]');
                const lastDisplayedId = existingMessages.length > 0 ? 
                    parseInt(existingMessages[existingMessages.length - 1].getAttribute('data-id')) : -1;

                data.progress.forEach((msg, idx) => {
                    if (idx > lastDisplayedId) {
                        const type = msg.includes('✅') || msg.includes('success') ? 'success' :
                                    msg.includes('❌') || msg.includes('error') ? 'error' :
                                    msg.includes('⚠️') ? 'warning' : 'info';
                        addMessage(msg, type, idx);
                    }
                });
            }

            // Check if evaluation is complete
            if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                addMessage('✅ Evaluation completed successfully!', 'success');
                fetchAndDisplayResults();
                submitBtn.disabled = false;
            } else if (data.status === 'failed') {
                clearInterval(statusCheckInterval);
                addMessage(`❌ Evaluation failed: ${data.error}`, 'error');
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 1000);
}

async function fetchAndDisplayResults() {
    try {
        const response = await fetch(`/api/result/${currentSessionId}`);
        if (!response.ok) throw new Error('Failed to fetch results');

        const data = await response.json();
        console.log('Received result data:', data); // Debug log
        
        // Handle both wrapped and unwrapped response formats
        const result = data.result || data;
        displayResults(result);
    } catch (error) {
        addMessage(`Error loading results: ${error.message}`, 'error');
        console.error('Full error:', error);
    }
}

function displayResults(result) {
    console.log('Displaying results:', result); // Debug log
    
    if (!result) {
        addMessage('Error: No result data received', 'error');
        return;
    }
    
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('active');

    // Main PRS Score
    const prsCard = document.createElement('div');
    prsCard.className = 'score-card';
    const prsScore = result.patent_relevance_score || result.prs_score || 0;
    prsCard.innerHTML = `
        <div class="score-header">
            <h2>Patent Relevance Score (PRS)</h2>
            <div class="score-badge">${prsScore.toFixed(1)}/100</div>
        </div>
        <div style="text-align: center; color: #666;">
            ${prsScore >= 75 ? '🟢 Highly Relevant' : 
              prsScore >= 50 ? '🟡 Moderately Relevant' : 
              '🔴 Low Relevance'}
        </div>
    `;
    resultsContainer.appendChild(prsCard);

    // Dimension Scores
    const dimensionCard = document.createElement('div');
    dimensionCard.className = 'score-card';
    dimensionCard.innerHTML = `<div class="score-header"><h2>Dimension Scores</h2></div>`;
    
    const dimensionGrid = document.createElement('div');
    dimensionGrid.className = 'dimension-grid';

    const dimensionNames = {
        'tech_momentum': 'Technology Momentum',
        'market_gravity': 'Market Gravity',
        'white_space': 'White Space',
        'strategic_leverage': 'Strategic Leverage',
        'timing': 'Timing',
        'regulatory_alignment': 'Regulatory Alignment'
    };

    // Use normalized_scores for display
    const scores = result.normalized_scores || result.dimension_scores || {};
    
    Object.entries(scores).forEach(([key, score]) => {
        const item = document.createElement('div');
        item.className = 'dimension-item';
        
        // Get evidence from evidence_map if available
        const evidence = result.evidence_map && result.evidence_map[key] ? result.evidence_map[key] : {};
        const confidence = evidence.confidence || 0.7; // Default confidence
        
        const confidenceClass = confidence >= 0.8 ? 'confidence-high' :
                               confidence >= 0.5 ? 'confidence-medium' : 'confidence-low';
        
        item.innerHTML = `
            <div class="dimension-label">${dimensionNames[key] || key}</div>
            <div class="dimension-score">${typeof score === 'number' ? score.toFixed(0) : score}</div>
            <span class="confidence-badge ${confidenceClass}">
                ${(confidence * 100).toFixed(0)}% confident
            </span>
            <button class="button" style="margin-top: 10px; padding: 8px 12px; font-size: 12px;" 
                    onclick="showAgentDetails('${key}', '${JSON.stringify(evidence).replace(/"/g, '&quot;')}', ${score})">
                View Details
            </button>
        `;
        dimensionGrid.appendChild(item);
    });

    dimensionCard.appendChild(dimensionGrid);
    resultsContainer.appendChild(dimensionCard);

    // SWOT Analysis
    if (result.swot) {
        const swotCard = document.createElement('div');
        swotCard.className = 'swot-section';
        swotCard.innerHTML = `<h3>SWOT Analysis</h3>`;
        
        const swotGrid = document.createElement('div');
        swotGrid.className = 'swot-grid';

        const swotCategories = [
            { key: 'strengths', label: 'Strengths', class: 'strengths' },
            { key: 'weaknesses', label: 'Weaknesses', class: 'weaknesses' },
            { key: 'opportunities', label: 'Opportunities', class: 'opportunities' },
            { key: 'threats', label: 'Threats', class: 'threats' }
        ];

        swotCategories.forEach(cat => {
            const swotItem = document.createElement('div');
            swotItem.className = `swot-item ${cat.class}`;
            swotItem.innerHTML = `<h4>${cat.label}</h4>`;

            const ul = document.createElement('ul');
            const items = result.swot[cat.key] || [];
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
            swotItem.appendChild(ul);
            swotGrid.appendChild(swotItem);
        });

        swotCard.appendChild(swotGrid);
        resultsContainer.appendChild(swotCard);
    }

    // Quality Flags
    if (result.flags && result.flags.length > 0) {
        const flagsCard = document.createElement('div');
        flagsCard.className = 'flags-section';
        flagsCard.innerHTML = `<h3>⚠️ Quality Flags</h3>`;

        result.flags.forEach(flag => {
            const flagItem = document.createElement('div');
            flagItem.className = 'flag-item';
            flagItem.textContent = flag;
            flagsCard.appendChild(flagItem);
        });

        resultsContainer.appendChild(flagsCard);
    }

    // Metrics
    if (result.usage_summary) {
        const metricsCard = document.createElement('div');
        metricsCard.className = 'metrics-section';
        metricsCard.innerHTML = `<h3>Evaluation Metrics</h3>`;

        const metricsGrid = document.createElement('div');
        metricsGrid.className = 'metrics-grid';

        const metrics = [
            { label: 'Total Tokens', value: result.usage_summary.total_tokens || 0 },
            { label: 'Estimated Cost', value: `$${(result.usage_summary.estimated_cost || 0).toFixed(4)}` },
            { label: 'Duration', value: `${(result.usage_summary.duration || 0).toFixed(2)}s` },
            { label: 'Agents Run', value: result.usage_summary.agents_executed || 0 }
        ];

        metrics.forEach(m => {
            const metricItem = document.createElement('div');
            metricItem.className = 'metric-item';
            metricItem.innerHTML = `
                <div class="metric-value">${m.value}</div>
                <div class="metric-label">${m.label}</div>
            `;
            metricsGrid.appendChild(metricItem);
        });

        metricsCard.appendChild(metricsGrid);
        resultsContainer.appendChild(metricsCard);
    }
}

function showAgentDetails(dimension, evidenceData, score) {
    const evidence = typeof evidenceData === 'string' ? JSON.parse(evidenceData) : evidenceData;
    const dimensionNames = {
        'tech_momentum': '🔬 Technology Momentum Agent',
        'market_gravity': '📈 Market Gravity Agent',
        'white_space': '🏆 White Space Agent',
        'strategic_leverage': '💼 Strategic Leverage Agent',
        'timing': '⏰ Timing Agent',
        'regulatory_alignment': '⚖️ Regulatory Alignment Agent'
    };

    document.getElementById('agentName').textContent = dimensionNames[dimension] || dimension;

    const rawScore = evidence.raw_score || (score / 20); // Convert normalized to raw if needed
    const normalizedScore = score || (evidence.raw_score * 20);
    const confidence = evidence.confidence || 0.7;

    const detailsHTML = `
        <div>
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f7fa; border-radius: 8px;">
                <strong>Overall Score:</strong> ${rawScore.toFixed(1)}/5 (${normalizedScore.toFixed(0)}/100)<br>
                <strong>Confidence:</strong> ${(confidence * 100).toFixed(0)}%<br>
                <strong>Status:</strong> ✅ Analysis Complete
            </div>

            <h4 style="margin: 15px 0 10px 0;">Agent Notes:</h4>
            <p style="font-size: 14px; line-height: 1.6; background: #fff9e6; padding: 12px; border-radius: 6px; border-left: 4px solid #ffb74d;">
                ${evidence.notes || 'No additional notes provided'}
            </p>

            ${evidence.sources && evidence.sources.length > 0 ? `
                <h4 style="margin: 15px 0 10px 0;">Evidence & Sources:</h4>
                <div class="source-list">
                    ${evidence.sources.map(source => `
                        <div class="source-item">
                            <strong>📌</strong> ${source}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('agentDetails').innerHTML = detailsHTML;
    agentModal.classList.add('active');
}

// Modal close handlers
closeModal.addEventListener('click', () => {
    agentModal.classList.remove('active');
});

agentModal.addEventListener('click', (e) => {
    if (e.target === agentModal) {
        agentModal.classList.remove('active');
    }
});

function addMessage(text, type = 'info', id = null) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    if (id !== null) message.setAttribute('data-id', id);
    message.textContent = text;
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
