# CodeBru Speed Audit

Open source mobile performance audit tool by CodeBru, Inc - built by engineers, for engineers.

## Features

- **Smart Page Discovery**: Automatically finds high-value pages (pricing, signup, products, etc.)
- **Mobile-First Analysis**: iPhone 12 simulation with real performance metrics
- **Actionable Insights**: Clear findings with specific fix recommendations
- **Engineer-Focused**: Clean, functional interface built for technical teams
- **Production Ready**: Docker deployment with health checks and monitoring

## Demo

🔗 **Live Demo**: https://speed.codebru.com

## Quick Start

### Local Development

```bash
# Clone and setup
git clone https://github.com/codebru/speed-audit
cd speed-audit
npm install

# Install Playwright
npx playwright install chromium

# Start development server
npm run dev
```

Visit http://localhost:3000

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or with plain Docker
docker build -t codebru-speed-audit .
docker run -p 3000:3000 codebru-speed-audit
```

### VPS Deployment

1. **Clone on your server**:
```bash
git clone https://github.com/codebru/speed-audit
cd speed-audit
```

2. **Deploy with Docker Compose**:
```bash
docker-compose up -d
```

3. **Setup reverse proxy** (nginx example):
```nginx
server {
    listen 80;
    server_name speed-audit.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Usage

### Run Audit

```bash
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## CLI Usage

```bash
# Run audit from command line
npm run audit https://example.com
```

## How It Works

1. **URL Validation**: Checks if site is accessible
2. **Page Discovery**: Finds high-value pages using industry patterns
3. **Mobile Simulation**: Loads pages with iPhone 12 + slow connection
4. **Performance Analysis**: Measures load times, resource counts, file sizes
5. **Finding Generation**: Converts metrics into actionable recommendations

### Page Discovery Patterns

- **SaaS/Services**: `/pricing`, `/plans`, `/demo`, `/signup`
- **E-commerce**: `/products`, `/shop`, `/cart`, `/checkout`
- **Booking/Services**: `/book`, `/schedule`, `/appointment`
- **Contact**: `/contact`, `/contact-us`

### Metrics Collected

- **Load Time**: Time to interactive
- **Resource Count**: Total HTTP requests
- **File Sizes**: Largest resources by size
- **Third-party Scripts**: External tracking/analytics
- **Form Usability**: Autocomplete and mobile optimization

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Web Interface │───▶│  Express API │───▶│  Audit Engine   │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                           ┌─────────▼─────────┐
                                           │   Playwright      │
                                           │   (Chromium)      │
                                           └───────────────────┘
```

## Development

### Project Structure

```
├── server.js              # Express server
├── src/
│   └── audit-engine.js    # Core audit logic
├── public/
│   ├── index.html         # Web interface
│   ├── style.css          # Engineer-focused styling
│   └── app.js             # Frontend JavaScript
├── Dockerfile             # Production container
└── docker-compose.yml     # Deployment config
```

### Adding New Findings

Edit `src/audit-engine.js` in the `generateFindings()` function:

```javascript
// Add new performance check
if (data.someMetric > threshold) {
  findings.push({
    issue: "Description of the issue",
    impact: "high|medium|low",
    category: "performance|usability|third-party"
  });
  
  fixes.push({
    action: "What to do",
    detail: "How to implement",
    difficulty: "easy|medium|hard"
  });
}
```

## Production Considerations

### Performance

- **Resource Limits**: 2GB RAM, 1 CPU core recommended
- **Concurrent Audits**: Limited by Playwright browser instances
- **Timeout**: 30 second max per page audit

### Security

- Runs as non-root user in container
- No file system writes outside /tmp
- Input validation on all URLs
- Rate limiting recommended for production

### Monitoring

- Health check endpoint: `/api/health`
- Structured logging with rotation
- Docker healthcheck configured

## License

MIT License - see LICENSE file

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## Support

- **Issues**: https://github.com/codebru/speed-audit/issues
- **Professional Services**: https://codebru.com

---

**Built by [CodeBru, Inc](https://codebru.com)** - Expert performance optimization services available.