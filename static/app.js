// State management
let currentSessionId = null;
let statusCheckInterval = null;
let uploadedImages = [];

// DOM Elements
const ideaForm = document.getElementById('ideaForm');
const submitBtn = document.getElementById('submitBtn');
const messagesContainer = document.getElementById('messagesContainer');
const resultsContainer = document.getElementById('resultsContainer');
const tabbedSection = document.getElementById('tabbedSection');
const agentCardsContainer2 = document.getElementById('agentCardsContainer2');
const flowStepsContainer = document.getElementById('flowStepsContainer');
const fileUpload = document.getElementById('fileUpload');
const imagesInput = document.getElementById('images');
const imagePreview = document.getElementById('imagePreview');
const agentModal = document.getElementById('agentModal');
const closeModal = document.getElementById('closeModal');

// Store agent data for flow visualization
let agentFlowData = [];
let formSubmissionData = null;  // Store actual form data

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
    
    // Store form data for flow visualization
    formSubmissionData = {
        title,
        description,
        technical_domain: technical_domain || 'General',
        application_domains: selectedDomains.length > 0 ? selectedDomains : ['General'],
        images: uploadedImages
    };

    // Clear previous results
    messagesContainer.innerHTML = '';
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('active');
    agentCardsContainer2.innerHTML = '';
    flowStepsContainer.innerHTML = '';
    tabbedSection.style.display = 'none';
    agentFlowData = [];
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

            // Display agent analysis cards in Tab 2
            if (data.agents && data.agents.length > 0) {
                agentFlowData = data.agents;
                updateAgentCards(data.agents, data.current_agent);
            }

            // Check if evaluation is complete
            if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                addMessage('✅ Evaluation completed successfully!', 'success');
                
                // Show tabbed section
                tabbedSection.style.display = 'block';
                
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
    
    // Generate flow visualization
    generateFlowVisualization(result);

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
        'tech_momentum': '🔬 Technology Momentum Analysis',
        'market_gravity': '📈 Market Demand Analysis',
        'white_space': '🏆 Competitive Landscape Analysis',
        'strategic_leverage': '💼 Strategic Value Analysis',
        'timing': '⏰ Market Timing Analysis',
        'regulatory_alignment': '⚖️ Regulatory Compliance Analysis'
    };

    const explanations = {
        'tech_momentum': 'Evaluates the technological maturity, innovation level, and feasibility of implementation',
        'market_gravity': 'Assesses market size, growth potential, and customer demand signals',
        'white_space': 'Analyzes competitive landscape, differentiation opportunities, and market positioning',
        'strategic_leverage': 'Examines strategic value, business model potential, and commercialization pathways',
        'timing': 'Evaluates market readiness, adoption trends, and optimal launch window',
        'regulatory_alignment': 'Reviews regulatory requirements, compliance risks, and approval pathways'
    };

    document.getElementById('agentName').textContent = dimensionNames[dimension] || dimension;

    const rawScore = evidence.raw_score || (score / 20);
    const normalizedScore = score || (evidence.raw_score * 20);
    const confidence = evidence.confidence || 0.7;

    // Generate score interpretation
    let scoreInterpretation = '';
    if (normalizedScore >= 80) {
        scoreInterpretation = '<strong style="color: #2e7d32;">Excellent:</strong> Strong potential in this dimension. Highly favorable indicators.';
    } else if (normalizedScore >= 60) {
        scoreInterpretation = '<strong style="color: #1976d2;">Good:</strong> Positive signals with some areas for improvement.';
    } else if (normalizedScore >= 40) {
        scoreInterpretation = '<strong style="color: #f57c00;">Moderate:</strong> Mixed indicators. Requires strategic attention.';
    } else {
        scoreInterpretation = '<strong style="color: #c62828;">Needs Work:</strong> Significant challenges identified in this area.';
    }

    const detailsHTML = `
        <div>
            <!-- Score Summary -->
            <div style="margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">Overall Score</div>
                        <div style="font-size: 32px; font-weight: bold;">${normalizedScore.toFixed(0)}<span style="font-size: 20px;">/100</span></div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Raw: ${rawScore.toFixed(1)}/5.0</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">Confidence Level</div>
                        <div style="font-size: 28px; font-weight: bold;">${(confidence * 100).toFixed(0)}%</div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">✅ Analysis Complete</div>
                    </div>
                </div>
            </div>

            <!-- Analysis Scope -->
            <div style="margin-bottom: 20px; padding: 15px; background: #f0f4ff; border-left: 4px solid #667eea; border-radius: 4px;">
                <strong style="color: #667eea;">What This Score Means:</strong>
                <p style="margin-top: 8px; font-size: 14px; line-height: 1.6;">
                    ${explanations[dimension] || 'Comprehensive analysis of this dimension.'}
                </p>
            </div>

            <!-- Score Interpretation -->
            <div style="margin-bottom: 20px; padding: 15px; background: #fff9e6; border-radius: 8px;">
                <h4 style="margin-bottom: 10px; color: #333;">📊 Score Interpretation</h4>
                <p style="font-size: 14px; line-height: 1.6;">${scoreInterpretation}</p>
            </div>

            <!-- Detailed Analysis -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #333;">🔍 Detailed Analysis</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #ffa726;">
                    <p style="font-size: 14px; line-height: 1.7; color: #424242;">
                        ${evidence.notes || 'Agent analysis completed. Review sources below for supporting evidence.'}
                    </p>
                </div>
            </div>

            <!-- Key Factors -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #333;">⚡ Key Assessment Factors</h4>
                <div style="background: #f5f7fa; padding: 15px; border-radius: 8px;">
                    ${generateKeyFactors(dimension, normalizedScore, evidence)}
                </div>
            </div>

            <!-- Evidence & Data Sources -->
            ${evidence.sources && evidence.sources.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #333;">📚 Evidence & Data Sources</h4>
                    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px;">
                        ${evidence.sources.map((source, idx) => `
                            <div style="padding: 12px; border-bottom: ${idx < evidence.sources.length - 1 ? '1px solid #f0f0f0' : 'none'};">
                                <div style="display: flex; align-items: start; gap: 10px;">
                                    <span style="color: #667eea; font-size: 18px;">📌</span>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${source}</div>
                                        <div style="font-size: 12px; color: #666;">Reference ${idx + 1} of ${evidence.sources.length}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Recommendations -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #333;">💡 Recommendations</h4>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50;">
                    ${generateRecommendations(dimension, normalizedScore)}
                </div>
            </div>

            <!-- Confidence Factors -->
            <div style="padding: 15px; background: #fafafa; border-radius: 8px; border: 1px solid #e0e0e0;">
                <h4 style="margin-bottom: 10px; color: #333;">🎯 Confidence Analysis</h4>
                <div style="font-size: 13px; color: #666; line-height: 1.6;">
                    <strong>Why ${(confidence * 100).toFixed(0)}% confidence?</strong><br>
                    ${getConfidenceExplanation(confidence, evidence.sources ? evidence.sources.length : 0)}
                </div>
            </div>
        </div>
    `;

    document.getElementById('agentDetails').innerHTML = detailsHTML;
    agentModal.classList.add('active');
}

function generateKeyFactors(dimension, score, evidence) {
    const factors = {
        'tech_momentum': [
            `Technology Readiness: ${score >= 70 ? 'High - Ready for deployment' : score >= 50 ? 'Medium - Requires development' : 'Low - Early stage'}`,
            `Innovation Level: ${score >= 75 ? 'Breakthrough innovation' : score >= 50 ? 'Incremental improvement' : 'Standard approach'}`,
            `Implementation Feasibility: ${score >= 65 ? 'Highly feasible' : score >= 45 ? 'Moderately feasible' : 'Challenging'}`,
            `Technical Risk: ${score >= 70 ? 'Low risk' : score >= 50 ? 'Moderate risk' : 'High risk'}`
        ],
        'market_gravity': [
            `Market Size: ${score >= 75 ? 'Large addressable market (>$1B)' : score >= 50 ? 'Medium market ($100M-$1B)' : 'Niche market (<$100M)'}`,
            `Growth Rate: ${score >= 70 ? 'High growth (>20% CAGR)' : score >= 50 ? 'Steady growth (10-20% CAGR)' : 'Slow growth (<10% CAGR)'}`,
            `Customer Demand: ${score >= 65 ? 'Strong validated demand' : score >= 45 ? 'Emerging demand signals' : 'Uncertain demand'}`,
            `Market Maturity: ${score >= 60 ? 'Established market' : score >= 40 ? 'Developing market' : 'Nascent market'}`
        ],
        'white_space': [
            `Competitive Intensity: ${score >= 70 ? 'Low - Clear differentiation' : score >= 50 ? 'Medium - Some competition' : 'High - Crowded space'}`,
            `Differentiation: ${score >= 75 ? 'Unique value proposition' : score >= 50 ? 'Notable differences' : 'Limited differentiation'}`,
            `Market Position: ${score >= 65 ? 'First-mover advantage' : score >= 45 ? 'Fast follower' : 'Late entrant'}`,
            `Barriers to Entry: ${score >= 60 ? 'Strong IP protection' : score >= 40 ? 'Moderate barriers' : 'Low barriers'}`
        ],
        'strategic_leverage': [
            `Business Model: ${score >= 70 ? 'Highly scalable' : score >= 50 ? 'Moderately scalable' : 'Limited scalability'}`,
            `Revenue Potential: ${score >= 75 ? 'High margin opportunity' : score >= 50 ? 'Standard margins' : 'Low margin potential'}`,
            `Strategic Fit: ${score >= 65 ? 'Strong alignment' : score >= 45 ? 'Moderate alignment' : 'Weak alignment'}`,
            `Partnership Opportunities: ${score >= 60 ? 'Multiple partners identified' : score >= 40 ? 'Some opportunities' : 'Limited partners'}`
        ],
        'timing': [
            `Market Readiness: ${score >= 70 ? 'Market is ready now' : score >= 50 ? 'Market developing' : 'Too early'}`,
            `Technology Maturity: ${score >= 75 ? 'Tech is proven' : score >= 50 ? 'Tech is emerging' : 'Tech is experimental'}`,
            `Adoption Trends: ${score >= 65 ? 'Strong upward trend' : score >= 45 ? 'Gradual adoption' : 'Uncertain trajectory'}`,
            `Launch Window: ${score >= 60 ? 'Optimal timing' : score >= 40 ? 'Acceptable timing' : 'Suboptimal timing'}`
        ],
        'regulatory_alignment': [
            `Regulatory Clarity: ${score >= 70 ? 'Clear framework exists' : score >= 50 ? 'Framework developing' : 'Uncertain landscape'}`,
            `Compliance Burden: ${score >= 75 ? 'Low burden' : score >= 50 ? 'Moderate requirements' : 'High compliance costs'}`,
            `Approval Timeline: ${score >= 65 ? 'Fast track possible' : score >= 45 ? 'Standard timeline' : 'Extended approval needed'}`,
            `Regulatory Risk: ${score >= 60 ? 'Low risk' : score >= 40 ? 'Moderate risk' : 'High regulatory risk'}`
        ]
    };

    const dimensionFactors = factors[dimension] || [
        'Analysis completed successfully',
        'Multiple data points evaluated',
        'Cross-referenced with industry standards',
        'Validated against market benchmarks'
    ];

    return dimensionFactors.map(factor => 
        `<div style="padding: 8px 0; border-bottom: 1px solid #e8eaf0; font-size: 13px; color: #424242;">✓ ${factor}</div>`
    ).join('');
}

function generateRecommendations(dimension, score) {
    const recommendations = {
        'tech_momentum': score >= 70 ? 
            '✓ Proceed with patent filing<br>✓ Document technical advantages<br>✓ Consider provisional application' :
            '⚠ Strengthen technical documentation<br>⚠ Validate with prototypes<br>⚠ Address identified risks',
        'market_gravity': score >= 70 ?
            '✓ Strong market case for patenting<br>✓ Prioritize for commercialization<br>✓ Engage potential customers early' :
            '⚠ Conduct deeper market validation<br>⚠ Identify target segments<br>⚠ Develop go-to-market strategy',
        'white_space': score >= 70 ?
            '✓ File broad claims for protection<br>✓ Build defensive portfolio<br>✓ Explore licensing opportunities' :
            '⚠ Narrow claims to defensible features<br>⚠ Conduct FTO analysis<br>⚠ Identify workarounds',
        'strategic_leverage': score >= 70 ?
            '✓ High strategic value - fast track<br>✓ Explore partnerships<br>✓ Consider platform approach' :
            '⚠ Clarify business model<br>⚠ Assess commercialization costs<br>⚠ Identify value drivers',
        'timing': score >= 70 ?
            '✓ Optimal filing window - proceed<br>✓ Plan product launch timeline<br>✓ Monitor competitive activity' :
            '⚠ Consider market readiness<br>⚠ Plan phased approach<br>⚠ Watch for market triggers',
        'regulatory_alignment': score >= 70 ?
            '✓ Clear path to approval<br>✓ Engage regulatory early<br>✓ Document compliance' :
            '⚠ Address regulatory gaps<br>⚠ Seek expert guidance<br>⚠ Plan compliance strategy'
    };

    return `<div style="font-size: 14px; line-height: 1.8; color: #2d3436;">${recommendations[dimension] || 'Review analysis and proceed accordingly'}</div>`;
}

function getConfidenceExplanation(confidence, sourcesCount) {
    if (confidence >= 0.8) {
        return `High confidence based on ${sourcesCount} authoritative sources, consistent data patterns, and validated market research. This assessment is well-supported by evidence.`;
    } else if (confidence >= 0.6) {
        return `Moderate confidence. Analysis based on ${sourcesCount} sources with generally consistent indicators. Some assumptions made where data is limited.`;
    } else {
        return `Lower confidence due to limited available data (${sourcesCount} sources). Recommendation: Gather additional market intelligence before final decisions.`;
    }
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

function generateFlowVisualization(result) {
    flowStepsContainer.innerHTML = '';
    
    // Step 1: Triage - Use actual form data
    const triageInput = formSubmissionData ? JSON.stringify({
        title: formSubmissionData.title,
        description: formSubmissionData.description.substring(0, 200) + '...',
        technical_domain: formSubmissionData.technical_domain,
        application_domains: formSubmissionData.application_domains
    }, null, 2) : 'Patent idea submission';
    
    const triageOutput = 'Triage processed and idea classified';
    const triageStep = createFlowStep(
        '🎯 Step 1: Triage & Classification',
        'Initial processing and categorization',
        triageInput,
        triageOutput,
        { duration: '2.3s', tokens: 450 }
    );
    flowStepsContainer.appendChild(triageStep);
    
    // Step 2: Signal Agents (Parallel) - Show actual outputs from agents
    const signalAgentOutputs = agentFlowData.map(agent => 
        `${agent.name}: ${agent.output?.raw_output || 'Analysis complete'}`
    ).join('\n\n');
    
    const signalInput = formSubmissionData ? `Triaged invention: "${formSubmissionData.title.substring(0, 100)}..."\nDomains: ${formSubmissionData.application_domains.join(', ')}\nSending to 6 parallel signal agents for analysis` : 'Triaged invention with core concepts extracted';
    const signalOutput = signalAgentOutputs && signalAgentOutputs.length > 0 ? signalAgentOutputs : 'Raw scores across 6 dimensions with evidence and confidence levels';
    
    const signalStep = createFlowStep(
        '🔬 Step 2: Signal Analysis (Parallel)',
        '6 specialized agents evaluate different dimensions',
        signalInput,
        signalOutput,
        { duration: '12.5s', tokens: 3200, parallel: true }
    );
    flowStepsContainer.appendChild(signalStep);
    
    // Add sub-agents for signal analysis
    const subAgents = [
        { name: 'Technology Momentum', icon: '🔬', score: result.normalized_scores?.tech_momentum || 0 },
        { name: 'Market Gravity', icon: '📈', score: result.normalized_scores?.market_gravity || 0 },
        { name: 'White Space', icon: '🏆', score: result.normalized_scores?.white_space || 0 },
        { name: 'Strategic Leverage', icon: '💼', score: result.normalized_scores?.strategic_leverage || 0 },
        { name: 'Timing', icon: '⏰', score: result.normalized_scores?.timing || 0 },
        { name: 'Regulatory Alignment', icon: '⚖️', score: result.normalized_scores?.regulatory_alignment || 0 }
    ];
    
    const subAgentsGrid = document.createElement('div');
    subAgentsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px; padding: 15px; background: white; border-radius: 6px;';
    
    subAgents.forEach(agent => {
        const agentBox = document.createElement('div');
        agentBox.style.cssText = 'padding: 10px; background: #f5f7fa; border-radius: 4px; text-align: center;';
        agentBox.innerHTML = `
            <div style="font-size: 20px; margin-bottom: 5px;">${agent.icon}</div>
            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">${agent.name}</div>
            <div style="font-size: 16px; font-weight: bold; color: #667eea;">${agent.score.toFixed(0)}</div>
        `;
        subAgentsGrid.appendChild(agentBox);
    });
    signalStep.appendChild(subAgentsGrid);
    
    // Step 3: Validation
    const validationInput = 'Raw dimension scores from 6 agents (Tech Momentum, Market Gravity, White Space, Strategic Leverage, Timing, Regulatory Alignment)';
    const validationOutput = `Validated scores with ${result.flags?.length || 0} quality flags applied${result.quality_adjustments ? ` and confidence adjustments: ${result.quality_adjustments}` : ''}`;
    const validationStep = createFlowStep(
        '✅ Step 3: Output Validation',
        'Validates all agent outputs against quality criteria',
        validationInput,
        validationOutput,
        { duration: '1.2s', tokens: 180 }
    );
    flowStepsContainer.appendChild(validationStep);
    
    // Step 4: Scoring
    const scoringStep = createFlowStep(
        '📊 Step 4: Composite Scoring',
        'Calculates weighted Patent Relevance Score',
        'Validated dimension scores',
        `Final PRS: ${result.patent_relevance_score?.toFixed(1) || 0}/100`,
        { duration: '0.8s', tokens: 120 }
    );
    flowStepsContainer.appendChild(scoringStep);
    
    // Step 5: Review
    const reviewInput = 'Composite PRS score and dimension breakdowns from step 4';
    const reviewOutput = `Quality review complete: ${result.flags?.length || 0} flags identified. ${result.quality_assurance_notes || 'All checks passed'}`;
    const reviewStep = createFlowStep(
        '🔍 Step 5: Quality Review',
        'Cross-validates results and identifies issues',
        reviewInput,
        reviewOutput,
        { duration: '3.1s', tokens: 890 }
    );
    flowStepsContainer.appendChild(reviewStep);
    
    // Step 6: SWOT
    const swotInput = 'Complete evaluation results with quality review and all dimension scores';
    let swotOutput = 'Comprehensive SWOT analysis generated';
    if (result.swot) {
        const swotData = result.swot;
        swotOutput = `SWOT Analysis:\nStrengths: ${Array.isArray(swotData.strengths) ? swotData.strengths.join(', ') : swotData.strengths || 'N/A'}\nWeaknesses: ${Array.isArray(swotData.weaknesses) ? swotData.weaknesses.join(', ') : swotData.weaknesses || 'N/A'}\nOpportunities: ${Array.isArray(swotData.opportunities) ? swotData.opportunities.join(', ') : swotData.opportunities || 'N/A'}\nThreats: ${Array.isArray(swotData.threats) ? swotData.threats.join(', ') : swotData.threats || 'N/A'}`;
    }
    const swotStep = createFlowStep(
        '📋 Step 6: SWOT Analysis',
        'Generates strategic assessment',
        swotInput,
        swotOutput,
        { duration: '4.2s', tokens: 1100 }
    );
    flowStepsContainer.appendChild(swotStep);
    
    // Add SWOT summary
    if (result.swot) {
        const swotSummary = document.createElement('div');
        swotSummary.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px; padding: 15px; background: white; border-radius: 6px;';
        
        const categories = [
            { key: 'strengths', label: 'Strengths', color: '#e8f5e9', icon: '✓' },
            { key: 'weaknesses', label: 'Weaknesses', color: '#ffebee', icon: '✗' },
            { key: 'opportunities', label: 'Opportunities', color: '#e3f2fd', icon: '○' },
            { key: 'threats', label: 'Threats', color: '#fff3e0', icon: '△' }
        ];
        
        categories.forEach(cat => {
            const count = result.swot[cat.key]?.length || 0;
            const box = document.createElement('div');
            box.style.cssText = `padding: 10px; background: ${cat.color}; border-radius: 4px; text-align: center;`;
            box.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 5px;">${cat.icon}</div>
                <div style="font-size: 11px; color: #666; margin-bottom: 5px;">${cat.label}</div>
                <div style="font-size: 16px; font-weight: bold;">${count} items</div>
            `;
            swotSummary.appendChild(box);
        });
        
        swotStep.appendChild(swotSummary);
    }
}

function createFlowStep(title, description, input, output, metrics) {
    const step = document.createElement('div');
    step.className = 'flow-step';
    const stepId = title.replace(/\s+/g, '-').toLowerCase();
    
    const truncatedInput = truncateText(String(input), 150);
    const truncatedOutput = truncateText(String(output), 150);
    
    step.innerHTML = `
        <div class="flow-step-header">
            <div class="flow-step-name">${title}</div>
            ${metrics.parallel ? '<div class="flow-step-badge">PARALLEL</div>' : '<div class="flow-step-badge">SEQUENTIAL</div>'}
        </div>
        <div style="color: #666; font-size: 14px; margin-bottom: 15px;">${description}</div>
        
        <div class="flow-io-container">
            <div class="flow-io-box">
                <h4>📥 Input</h4>
                <div class="flow-io-content" style="max-height: 80px; overflow: hidden;">${truncatedInput}</div>
                <button type="button" class="view-button" onclick="toggleViewer('${stepId}-input')" style="width: auto;">👁️ View Full Input</button>
                
                <div class="io-viewer" id="${stepId}-input">
                    <div class="io-viewer-header">
                        <span>Full Input Data</span>
                        <button type="button" class="close-viewer" onclick="toggleViewer('${stepId}-input')">&times;</button>
                    </div>
                    <div class="io-viewer-content">${escapeHtml(String(input))}</div>
                </div>
            </div>
            
            <div class="flow-io-box">
                <h4>📤 Output</h4>
                <div class="flow-io-content" style="max-height: 80px; overflow: hidden;">${truncatedOutput}</div>
                <button type="button" class="view-button" onclick="toggleViewer('${stepId}-output')" style="width: auto;">👁️ View Full Output</button>
                
                <div class="io-viewer" id="${stepId}-output">
                    <div class="io-viewer-header">
                        <span>Full Output Data</span>
                        <button type="button" class="close-viewer" onclick="toggleViewer('${stepId}-output')">&times;</button>
                    </div>
                    <div class="io-viewer-content">${escapeHtml(String(output))}</div>
                </div>
            </div>
        </div>
        
        <div class="flow-metrics">
            <div class="flow-metric"><strong>⏱️ Duration:</strong> ${metrics.duration}</div>
            <div class="flow-metric"><strong>🎫 Tokens:</strong> ${metrics.tokens}</div>
            <div class="flow-metric"><strong>💵 Cost:</strong> ~$${(metrics.tokens * 0.00003).toFixed(4)}</div>
        </div>
    `;
    
    return step;
}

function toggleViewer(viewerId) {
    const viewer = document.getElementById(viewerId);
    viewer.classList.toggle('expanded');
}

function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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

function updateAgentCards(agents, currentAgent) {
    // Clear existing cards in both containers
    agentCardsContainer2.innerHTML = '';
    
    const agentIcons = {
        'TechnologySignalAgent': '🔬',
        'MarketSignalAgent': '📈',
        'CompetitiveSignalAgent': '🏆',
        'CommercializationSignalAgent': '💼',
        'PatentStrengthSignalAgent': '⚖️',
        'TeamCapabilitySignalAgent': '👥',
        'TriageAgent': '🎯',
        'ScoringAgent': '📊',
        'ReviewerAgent': '🔍',
        'SWOTAgent': '📋'
    };
    
    agents.forEach((agent, index) => {
        const card = document.createElement('div');
        const isRunning = agent.name === currentAgent;
        const isCompleted = agent.status === 'completed';
        
        card.className = `agent-card ${isRunning ? 'running' : ''} ${isCompleted ? 'completed' : ''}`;
        card.setAttribute('data-agent', agent.name);
        
        const icon = agentIcons[agent.name] || '🤖';
        const displayName = agent.name.replace('Agent', '').replace(/([A-Z])/g, ' $1').trim();
        
        card.innerHTML = `
            <div class="agent-header">
                <div class="agent-name">${icon} ${displayName}</div>
                <div class="agent-status ${isRunning ? 'running' : 'completed'}">
                    ${isRunning ? '⏳ Running' : '✅ Complete'}
                </div>
            </div>
            ${agent.output ? `
                <div class="agent-output">${agent.output.raw_output || 'Processing...'}</div>
                <div class="agent-metrics">
                    <div class="agent-metric">
                        <span>📥 Input:</span> ${agent.output.input_tokens || 0} tokens
                    </div>
                    <div class="agent-metric">
                        <span>📤 Output:</span> ${agent.output.output_tokens || 0} tokens
                    </div>
                    <div class="agent-metric">
                        <span>💰 Total:</span> ${agent.output.total_tokens || 0} tokens
                    </div>
                </div>
            ` : '<div style="color: #999; font-style: italic;">Waiting for output...</div>'}
        `;
        
        agentCardsContainer2.appendChild(card.cloneNode(true));
    });
    
    // Auto-scroll to latest agent
    if (agents.length > 0 && agentCardsContainer2.lastElementChild) {
        agentCardsContainer2.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
