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
    // Use built-in fetch in Node.js 18+
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow' 
    });
    
    clearTimeout(timeoutId);
    return response.status < 400;
  } catch (error) {
    console.log(`[VALIDATE] Error validating ${url}:`, error.message);
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
        const testUrl = `${baseHost}${pattern}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
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
 * Generate detailed actionable findings
 */
function generateFindings(data) {
  const findings = [];
  const fixes = [];
  
  // Critical Issue: Slow Load Time
  if (data.loadTime > 4) {
    findings.push({
      issue: `Page takes ${data.loadTime.toFixed(1)}s to load on mobile - users expect under 3s`,
      impact: "critical",
      category: "performance",
      metric: `${data.loadTime.toFixed(1)}s load time`,
      threshold: "Target: <3s"
    });
    fixes.push({
      action: "Implement critical resource prioritization",
      detail: "Load essential content first, defer everything else",
      difficulty: "medium",
      priority: 1
    });
  } else if (data.loadTime > 2.5) {
    findings.push({
      issue: `Page loads in ${data.loadTime.toFixed(1)}s - could be faster on mobile`,
      impact: "high",
      category: "performance", 
      metric: `${data.loadTime.toFixed(1)}s load time`,
      threshold: "Target: <2.5s"
    });
  }
  
  // Large Resource Issues  
  if (data.largestResource && parseInt(data.largestResource.size) > 1000000) {
    const sizeMB = (parseInt(data.largestResource.size) / 1024 / 1024).toFixed(1);
    findings.push({
      issue: `Largest resource is ${sizeMB}MB - too heavy for mobile connections`,
      impact: "high",
      category: "resources",
      metric: `${sizeMB}MB file`,
      threshold: "Target: <1MB"
    });
    
    if (data.largestResource.type === 'image') {
      fixes.push({
        action: "Optimize and compress the large image",
        detail: "Use modern formats (WebP/AVIF), resize for mobile screens, implement lazy loading",
        difficulty: "easy",
        priority: 1
      });
    } else if (data.largestResource.type === 'script') {
      fixes.push({
        action: "Split the large JavaScript bundle",
        detail: "Use code splitting, tree shaking, and load non-critical code after page render",
        difficulty: "medium", 
        priority: 2
      });
    }
  }
  
  // Too Many Requests
  if (data.totalRequests > 100) {
    findings.push({
      issue: `${data.totalRequests} HTTP requests slow down mobile loading`,
      impact: "high",
      category: "resources",
      metric: `${data.totalRequests} requests`,
      threshold: "Target: <50 requests"
    });
    fixes.push({
      action: "Bundle and minimize HTTP requests",
      detail: "Combine CSS/JS files, use CSS sprites for icons, implement resource bundling",
      difficulty: "medium",
      priority: 2
    });
  } else if (data.totalRequests > 50) {
    findings.push({
      issue: `${data.totalRequests} requests could be optimized for mobile`,
      impact: "medium", 
      category: "resources",
      metric: `${data.totalRequests} requests`,
      threshold: "Target: <30 requests"
    });
  }
  
  // Resource Size Issues
  const totalSizeMB = (data.totalSize / 1024 / 1024).toFixed(1);
  if (data.totalSize > 5000000) {
    findings.push({
      issue: `Total page weight is ${totalSizeMB}MB - too heavy for mobile users`,
      impact: "high",
      category: "resources",
      metric: `${totalSizeMB}MB total`,
      threshold: "Target: <3MB"
    });
    fixes.push({
      action: "Reduce total page weight",
      detail: "Compress images, minify CSS/JS, remove unused code, use modern formats",
      difficulty: "medium",
      priority: 2
    });
  }
  
  // Third-party Script Issues
  if (data.thirdPartyScripts > 8) {
    findings.push({
      issue: `${data.thirdPartyScripts} third-party scripts slow down page loading`,
      impact: "high",
      category: "third-party",
      metric: `${data.thirdPartyScripts} external scripts`,
      threshold: "Target: <5 scripts"
    });
    fixes.push({
      action: "Audit and reduce third-party scripts",
      detail: "Remove unnecessary tracking, defer analytics scripts, combine similar tools",
      difficulty: "easy",
      priority: 2
    });
  } else if (data.thirdPartyScripts > 5) {
    findings.push({
      issue: `${data.thirdPartyScripts} third-party scripts could be optimized`,
      impact: "medium",
      category: "third-party",
      metric: `${data.thirdPartyScripts} external scripts`,
      threshold: "Target: <3 scripts"
    });
    fixes.push({
      action: "Defer non-critical third-party scripts",
      detail: "Load analytics and tracking scripts after main content is visible",
      difficulty: "easy",
      priority: 3
    });
  }
  
  // Mobile Usability Issues
  if (data.hasForms) {
    findings.push({
      issue: "Forms not optimized for mobile users",
      impact: "medium",
      category: "usability",
      metric: "Missing mobile optimization",
      threshold: "Target: Full mobile optimization"
    });
    fixes.push({
      action: "Optimize forms for mobile",
      detail: "Add autocomplete attributes, proper input types, clear labels, and touch-friendly sizing",
      difficulty: "easy",
      priority: 3
    });
  }
  
  // Image Optimization Issues
  if (data.imageCount > 30) {
    findings.push({
      issue: `${data.imageCount} images increase page load time on mobile`,
      impact: "medium",
      category: "resources",
      metric: `${data.imageCount} images`,
      threshold: "Target: <20 images"
    });
    fixes.push({
      action: "Implement image lazy loading and optimization",
      detail: "Load images only when needed, compress all images, use modern formats",
      difficulty: "easy",
      priority: 3
    });
  }
  
  // Add fallback findings if we don't have enough
  if (findings.length === 0) {
    findings.push({
      issue: "Page could benefit from performance optimization",
      impact: "low",
      category: "general",
      metric: "Basic optimization needed",
      threshold: "Target: Optimized mobile experience"
    });
    fixes.push({
      action: "Implement basic performance optimizations",
      detail: "Compress images, minify CSS/JS, enable gzip compression, optimize loading strategy",
      difficulty: "easy",
      priority: 1
    });
  }
  
  // Sort fixes by priority
  fixes.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  
  return { findings, fixes };
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