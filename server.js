/**
 * CodeBru Speed Audit - Open Source Performance Analysis Tool
 * Simple, engineer-focused mobile performance auditing
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { runAudit } = require('./src/audit-engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API endpoint for running audits
app.post('/api/audit', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`[AUDIT] Starting audit for ${url}`);
    const results = await runAudit(url);
    res.json(results);
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ 
      error: 'Audit failed', 
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'CodeBru Speed Audit',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   CodeBru Speed Audit Server           ║
║   Running on port ${PORT}                 ║
║   Open http://localhost:${PORT}           ║
╚════════════════════════════════════════╝
  `);
});