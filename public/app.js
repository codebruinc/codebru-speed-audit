/**
 * CodeBru Speed Audit - Frontend JavaScript
 * Clean, functional interface for performance auditing
 */

class SpeedAudit {
  constructor() {
    this.form = document.getElementById('auditForm');
    this.urlInput = document.getElementById('urlInput');
    this.auditButton = document.getElementById('auditButton');
    this.loadingSection = document.getElementById('loading');
    this.resultsSection = document.getElementById('results');
    this.errorSection = document.getElementById('error');
    
    this.init();
  }
  
  init() {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    const url = this.urlInput.value.trim();
    if (!url) return;
    
    // Add https:// if not present
    const auditUrl = url.startsWith('http') ? url : `https://${url}`;
    
    await this.runAudit(auditUrl);
  }
  
  async runAudit(url) {
    this.showLoading();
    
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Audit failed');
      }
      
      const results = await response.json();
      this.showResults(results);
      
    } catch (error) {
      this.showError(error.message);
    }
  }
  
  showLoading() {
    this.hideAllSections();
    this.loadingSection.classList.remove('hidden');
    this.auditButton.disabled = true;
    this.auditButton.textContent = 'Running...';
    
    // Update loading messages
    const messages = [
      'Discovering high-value pages...',
      'Loading pages with mobile simulation...',
      'Analyzing performance metrics...',
      'Generating actionable recommendations...'
    ];
    
    let index = 0;
    const updateMessage = () => {
      document.getElementById('loadingStatus').textContent = messages[index];
      index = (index + 1) % messages.length;
    };
    
    updateMessage();
    this.loadingInterval = setInterval(updateMessage, 2000);
  }
  
  showResults(data) {
    this.hideAllSections();
    clearInterval(this.loadingInterval);
    
    // Update score circle
    this.updateScore(data.score);
    
    // Update summary
    document.getElementById('scoreSummary').textContent = 
      `Performance Score: ${data.score}`;
    document.getElementById('scoreRecommendation').textContent = 
      data.summary.recommendation;
    document.getElementById('avgLoadTime').textContent = 
      `${data.summary.averageLoadTime}s`;
    document.getElementById('pagesAudited').textContent = 
      data.summary.pagesAudited;
    
    // Update page results
    this.renderPageResults(data.pages);
    
    this.resultsSection.classList.remove('hidden');
    this.resetForm();
  }
  
  showError(message) {
    this.hideAllSections();
    clearInterval(this.loadingInterval);
    
    document.getElementById('errorMessage').textContent = message;
    this.errorSection.classList.remove('hidden');
    this.resetForm();
  }
  
  updateScore(score) {
    const circle = document.querySelector('.score-fill');
    const circumference = 314; // 2 * π * 50
    const offset = circumference - (score / 100) * circumference;
    
    setTimeout(() => {
      circle.style.strokeDashoffset = offset;
      
      // Color based on score
      if (score >= 75) {
        circle.style.stroke = '#059669'; // green
      } else if (score >= 50) {
        circle.style.stroke = '#d97706'; // orange
      } else {
        circle.style.stroke = '#dc2626'; // red
      }
    }, 500);
    
    // Animate score number
    let current = 0;
    const increment = score / 30;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        current = score;
        clearInterval(timer);
      }
      document.getElementById('scoreValue').textContent = Math.floor(current);
    }, 50);
  }
  
  renderPageResults(pages) {
    const container = document.getElementById('pageResults');
    container.innerHTML = '';
    
    pages.forEach(page => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'page-result';
      
      const loadTimeClass = 
        page.loadTime <= 2 ? 'loadtime-fast' :
        page.loadTime <= 4 ? 'loadtime-medium' : 'loadtime-slow';
      
      pageDiv.innerHTML = `
        <div class="page-header">
          <div>
            <div class="page-title">${page.pageLabel}</div>
            <div class="page-url">${page.url}</div>
          </div>
          <div class="page-loadtime ${loadTimeClass}">
            ${page.loadTime.toFixed(1)}s
          </div>
        </div>
        
        <div class="page-metrics">
          <div class="page-metric">
            <span class="page-metric-value">${page.metrics.totalRequests}</span>
            <span class="page-metric-label">Requests</span>
          </div>
          <div class="page-metric">
            <span class="page-metric-value">${page.metrics.images}</span>
            <span class="page-metric-label">Images</span>
          </div>
          <div class="page-metric">
            <span class="page-metric-value">${page.metrics.scripts}</span>
            <span class="page-metric-label">Scripts</span>
          </div>
          <div class="page-metric">
            <span class="page-metric-value">${page.metrics.thirdPartyScripts}</span>
            <span class="page-metric-label">3rd Party</span>
          </div>
          <div class="page-metric">
            <span class="page-metric-value">${page.metrics.largestResourceSize}</span>
            <span class="page-metric-label">Largest File</span>
          </div>
        </div>
        
        <div class="findings">
          <h4>Issues Found</h4>
          ${page.findings.findings.map(finding => `
            <div class="finding finding-${finding.impact}">
              <div class="finding-issue">${finding.issue}</div>
              <div class="finding-category">${finding.category}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="fixes">
          <h4>Recommended Fixes</h4>
          ${page.findings.fixes.map(fix => `
            <div class="fix">
              <div class="fix-action">${fix.action}</div>
              <div class="fix-detail">${fix.detail}</div>
              <span class="fix-difficulty difficulty-${fix.difficulty}">
                ${fix.difficulty}
              </span>
            </div>
          `).join('')}
        </div>
      `;
      
      container.appendChild(pageDiv);
    });
  }
  
  hideAllSections() {
    this.loadingSection.classList.add('hidden');
    this.resultsSection.classList.add('hidden');
    this.errorSection.classList.add('hidden');
  }
  
  resetForm() {
    this.auditButton.disabled = false;
    this.auditButton.textContent = 'Run Audit';
  }
}

// Global reset function for error handling
function resetAudit() {
  window.speedAudit.hideAllSections();
  window.speedAudit.resetForm();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.speedAudit = new SpeedAudit();
});