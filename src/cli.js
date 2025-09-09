#!/usr/bin/env node

/**
 * CodeBru Speed Audit CLI
 * Command line interface for running audits
 */

const { runAudit } = require('./audit-engine');

async function cli() {
  const url = process.argv[2];
  
  if (!url) {
    console.log(`
CodeBru Speed Audit CLI

Usage:
  npm run audit <url>
  node src/cli.js <url>

Example:
  npm run audit https://example.com
    `);
    process.exit(1);
  }
  
  console.log(`🔍 Starting audit for ${url}...`);
  console.log('');
  
  try {
    const results = await runAudit(url);
    
    // Print results
    console.log(`📊 Performance Score: ${results.score}/100`);
    console.log(`⏱️  Average Load Time: ${results.summary.averageLoadTime}s`);
    console.log(`📄 Pages Audited: ${results.summary.pagesAudited}`);
    console.log(`💡 ${results.summary.recommendation}`);
    console.log('');
    
    results.pages.forEach((page, index) => {
      console.log(`━━━ Page ${index + 1}: ${page.pageLabel} ━━━`);
      console.log(`URL: ${page.url}`);
      console.log(`Load Time: ${page.loadTime.toFixed(1)}s`);
      console.log('');
      
      console.log('🔍 Issues Found:');
      page.findings.findings.forEach((finding, i) => {
        const impact = finding.impact.toUpperCase();
        console.log(`  ${i + 1}. [${impact}] ${finding.issue}`);
      });
      console.log('');
      
      console.log('🛠️  Recommended Fixes:');
      page.findings.fixes.forEach((fix, i) => {
        const difficulty = fix.difficulty.toUpperCase();
        console.log(`  ${i + 1}. [${difficulty}] ${fix.action}`);
        console.log(`     ${fix.detail}`);
      });
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Need help implementing these fixes?');
    console.log('CodeBru, Inc offers expert performance optimization:');
    console.log('https://codebru.com');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error(`❌ Audit failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error(`❌ Unexpected error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`❌ Unhandled rejection: ${reason}`);
  process.exit(1);
});

cli();