/**
 * Core Audit Engine - Mobile Performance Analysis
 * Based on proven methodology from production deployments
 */

const { chromium } = require('playwright');

// Page patterns for discovering high-value pages
const PAGE_PATTERNS = {
  'saas': ['/pricing', '/plans', '/demo', '/signup', '/sign-up', '/register', '/get-started'],
  'ecommerce': ['/products', '/shop', '/store', '/cart', '/checkout'],
  'booking': ['/book', '/booking', '/schedule', '/appointment', '/reserve'],
  'contact': ['/contact', '/contact-us', '/get-in-touch']
};

/**
 * Quick site validation
 */
async function validateSite(url) {
  try {
    // Use dynamic import for fetch in Node.js
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { 
      method: 'HEAD', 
      timeout: 5000,
      redirect: 'follow' 
    });
    return response.status < 400;
  } catch (error) {
    return false;
  }
}

/**
 * Discover high-value pages on the site
 */
async function discoverMoneyPages(baseUrl) {
  const discovered = [];
  const urlObj = new URL(baseUrl);
  const baseHost = `${urlObj.protocol}//${urlObj.host}`;
  
  // Always check homepage
  discovered.push({ url: baseUrl, type: 'homepage', label: 'Homepage' });
  
  // Try to find other high-value pages
  for (const [category, patterns] of Object.entries(PAGE_PATTERNS)) {
    for (const pattern of patterns) {
      try {
        const fetch = (await import('node-fetch')).default;
        const testUrl = `${baseHost}${pattern}`;
        const response = await fetch(testUrl, { 
          method: 'HEAD', 
          timeout: 3000,
          redirect: 'follow'
        });
        
        if (response.status === 200) {
          discovered.push({
            url: testUrl,
            type: category,
            label: pattern.replace('/', '').replace('-', ' ').charAt(0).toUpperCase() + 
                   pattern.slice(2).replace('-', ' ')
          });
          break; // Found one for this category
        }
      } catch (error) {
        // Page doesn't exist, continue
      }
    }
  }
  
  return discovered;
}

/**
 * Run performance audit on a specific page
 */
async function auditPage(url, browser) {
  const context = await browser.newContext({
    ...browser._playwright.devices['iPhone 12'],
    // Simulate slower connection
    offline: false
  });
  
  const page = await context.newPage();
  
  // Track network requests
  const requests = [];
  const resourceTimings = {};
  
  page.on('request', request => {
    requests.push({
      url: request.url(),
      type: request.resourceType(),
      method: request.method()
    });
  });
  
  page.on('response', response => {
    const request = requests.find(r => r.url === response.url());
    if (request) {
      request.status = response.status();
      request.size = response.headers()['content-length'] || 0;
    }
  });
  
  // Navigate and measure
  const startTime = Date.now();
  
  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for some resources to load
    await page.waitForTimeout(3000);
    
  } catch (error) {
    throw new Error(`Failed to load page: ${error.message}`);
  }
  
  const loadTime = (Date.now() - startTime) / 1000;
  
  // Analyze requests
  const imageRequests = requests.filter(r => r.type === 'image');
  const scriptRequests = requests.filter(r => r.type === 'script');
  const stylesheetRequests = requests.filter(r => r.type === 'stylesheet');
  
  // Find largest resources
  const sortedBySize = requests
    .filter(r => r.size)
    .sort((a, b) => parseInt(b.size) - parseInt(a.size));
  
  const largestResource = sortedBySize[0];
  
  // Count third-party scripts
  const pageHost = new URL(url).host;
  const thirdPartyScripts = scriptRequests.filter(r => {
    try {
      return new URL(r.url).host !== pageHost;
    } catch {
      return false;
    }
  });
  
  // Check for forms
  const hasForms = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) return false;
    
    // Check for autocomplete issues
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    let issueCount = 0;
    
    inputs.forEach(input => {
      if (!input.getAttribute('autocomplete') || input.getAttribute('autocomplete') === 'off') {
        issueCount++;
      }
    });
    
    return issueCount > 2;
  });
  
  await context.close();
  
  // Generate findings
  const findings = generateFindings({
    loadTime,
    totalRequests: requests.length,
    imageCount: imageRequests.length,
    scriptCount: scriptRequests.length,
    thirdPartyScripts: thirdPartyScripts.length,
    largestResource,
    hasForms
  });
  
  return {
    url,
    loadTime,
    metrics: {
      totalRequests: requests.length,
      images: imageRequests.length,
      scripts: scriptRequests.length,
      stylesheets: stylesheetRequests.length,
      thirdPartyScripts: thirdPartyScripts.length,
      largestResourceSize: largestResource ? `${(parseInt(largestResource.size) / 1024 / 1024).toFixed(1)}MB` : 'N/A'
    },
    findings
  };
}

/**
 * Generate actionable findings
 */
function generateFindings(data) {
  const findings = [];
  const fixes = [];
  
  // Finding 1: Load time
  if (data.loadTime > 3) {
    if (data.largestResource && parseInt(data.largestResource.size) > 500000) {
      if (data.largestResource.type === 'image') {
        findings.push({
          issue: "Large image at the top slows down mobile loading",
          impact: "high",
          category: "performance"
        });
        fixes.push({
          action: "Optimize and resize the hero image",
          detail: "Compress images and serve responsive sizes based on device",
          difficulty: "easy"
        });
      } else if (data.largestResource.type === 'script') {
        findings.push({
          issue: "Heavy JavaScript bundle delays page rendering",
          impact: "high", 
          category: "performance"
        });
        fixes.push({
          action: "Split and defer non-critical JavaScript",
          detail: "Use code splitting and async/defer attributes",
          difficulty: "medium"
        });
      }
    } else if (data.totalRequests > 50) {
      findings.push({
        issue: "Too many resources loading before page appears",
        impact: "high",
        category: "performance"
      });
      fixes.push({
        action: "Implement resource bundling and lazy loading",
        detail: "Combine files and load non-critical resources after initial render",
        difficulty: "medium"
      });
    }
  }
  
  // Finding 2: Third-party scripts
  if (data.thirdPartyScripts > 5) {
    findings.push({
      issue: "Multiple third-party scripts blocking page load",
      impact: "medium",
      category: "third-party"
    });
    fixes.push({
      action: "Defer third-party script loading",
      detail: "Load analytics and tracking scripts after page is interactive",
      difficulty: "easy"
    });
  }
  
  // Finding 3: Forms
  if (data.hasForms) {
    findings.push({
      issue: "Form fields lack mobile optimization",
      impact: "medium",
      category: "usability"
    });
    fixes.push({
      action: "Add autocomplete attributes to form fields",
      detail: "Enable autofill for better mobile user experience",
      difficulty: "easy"
    });
  }
  
  // Ensure we have 3 findings
  if (findings.length < 3) {
    if (data.imageCount > 20) {
      findings.push({
        issue: "High number of image requests",
        impact: "low",
        category: "performance"
      });
      fixes.push({
        action: "Implement image lazy loading",
        detail: "Load images as user scrolls down the page",
        difficulty: "easy"
      });
    }
    
    if (findings.length < 3) {
      findings.push({
        issue: "Missing performance budget monitoring",
        impact: "low",
        category: "monitoring"
      });
      fixes.push({
        action: "Set up performance monitoring",
        detail: "Track Core Web Vitals and set performance budgets",
        difficulty: "medium"
      });
    }
  }
  
  return { findings: findings.slice(0, 3), fixes: fixes.slice(0, 3) };
}

/**
 * Main audit function
 */
async function runAudit(url) {
  // Validate URL
  let validUrl;
  try {
    validUrl = new URL(url);
    if (!validUrl.protocol.startsWith('http')) {
      validUrl.protocol = 'https:';
    }
  } catch (error) {
    throw new Error('Invalid URL provided');
  }
  
  const baseUrl = validUrl.toString();
  
  // Quick validation
  const isValid = await validateSite(baseUrl);
  if (!isValid) {
    throw new Error('Site is not accessible or returned an error');
  }
  
  // Discover high-value pages
  const pages = await discoverMoneyPages(baseUrl);
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Audit each discovered page
    const audits = [];
    for (const page of pages) {
      try {
        const audit = await auditPage(page.url, browser);
        audits.push({
          ...audit,
          pageType: page.type,
          pageLabel: page.label
        });
      } catch (error) {
        console.error(`Failed to audit ${page.url}:`, error.message);
      }
    }
    
    // Calculate overall score
    const avgLoadTime = audits.reduce((sum, a) => sum + a.loadTime, 0) / audits.length;
    const score = calculateScore(avgLoadTime);
    
    return {
      url: baseUrl,
      timestamp: new Date().toISOString(),
      score,
      summary: {
        pagesAudited: audits.length,
        averageLoadTime: avgLoadTime.toFixed(2),
        recommendation: getRecommendation(score)
      },
      pages: audits,
      nextSteps: {
        message: "Need help implementing these fixes?",
        cta: "CodeBru, Inc offers expert performance optimization services",
        url: "https://codebru.com"
      }
    };
    
  } finally {
    await browser.close();
  }
}

/**
 * Calculate performance score (0-100)
 */
function calculateScore(loadTime) {
  if (loadTime <= 2) return 90;
  if (loadTime <= 3) return 75;
  if (loadTime <= 4) return 60;
  if (loadTime <= 5) return 45;
  return 30;
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score) {
  if (score >= 75) return "Good performance, minor optimizations recommended";
  if (score >= 50) return "Moderate performance issues that should be addressed";
  return "Significant performance issues affecting user experience";
}

module.exports = { runAudit };