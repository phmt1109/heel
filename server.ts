import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb', type: ['text/*', 'application/json'] }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Proxy endpoint to bypass CORS when running locally or in preview
  app.all('/api/proxy', async (req, res) => {
    try {
      const targetUrl = (req.query.url as string) || (req.headers['x-target-url'] as string);
      if (!targetUrl) {
        res.status(400).json({ error: 'Missing target URL parameter (?url=...)' });
        return;
      }

      // Filter and forward headers
      const forwardedHeaders: Record<string, string> = {};
      const forbiddenHeaders = ['host', 'connection', 'content-length', 'transfer-encoding', 'x-target-url'];
      for (const [key, value] of Object.entries(req.headers)) {
        const lowerKey = key.toLowerCase();
        if (!forbiddenHeaders.includes(lowerKey) && typeof value === 'string') {
          forwardedHeaders[lowerKey] = value;
        }
      }

      const method = req.method.toUpperCase();
      const fetchOpts: RequestInit = {
        method,
        headers: forwardedHeaders,
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
        fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const targetResponse = await fetch(targetUrl, fetchOpts);

      // Copy response status
      res.status(targetResponse.status);

      // Copy response headers
      targetResponse.headers.forEach((val, key) => {
        const lower = key.toLowerCase();
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lower)) {
          res.setHeader(key, val);
        }
      });
      res.setHeader('Access-Control-Allow-Origin', '*');

      // If streaming response (e.g. SSE)
      if (targetResponse.body) {
        const reader = targetResponse.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                res.write(Buffer.from(value));
              }
            }
            res.end();
          } catch (streamErr) {
            console.error('Proxy stream error:', streamErr);
            res.end();
          }
        };
        await pump();
      } else {
        const data = await targetResponse.text();
        res.send(data);
      }
    } catch (err: any) {
      console.error('Proxy error:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Proxy request failed', details: err?.message || String(err) });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
