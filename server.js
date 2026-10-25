const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4'
};

function readLeaderboard() {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf8');
      return [];
    }
    const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading leaderboard:', err);
    return [];
  }
}

function writeLeaderboard(entries) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing leaderboard:', err);
    return false;
  }
}

const server = http.createServer((req, res) => {
  // Common CORS headers for cross-device & cloud access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API: Leaderboard (Multi-laptop shared database) ---
  if (pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      const list = readLeaderboard();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify(list));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const entry = JSON.parse(body || '{}');
          const cleanUser = String(entry.username || '').trim().replace(/\s+/g, ' ');
          if (!cleanUser || cleanUser.length < 1 || cleanUser.length > 24) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username must be between 1 and 24 characters' }));
            return;
          }

          const percent = Math.min(100, Math.max(0, Math.round(Number(entry.percent) || 0)));
          const correct = Math.max(0, Math.round(Number(entry.correct) || 0));
          const total = Math.max(1, Math.round(Number(entry.total) || 1));
          const seconds = Math.max(0, Math.round(Number(entry.seconds) || 0));
          const mode = String(entry.mode || 'Practice');

          const newRecord = {
            username: cleanUser,
            mode,
            correct,
            total,
            percent,
            seconds,
            created_at: new Date().toISOString()
          };

          const list = readLeaderboard();
          list.push(newRecord);
          // Sort by highest percent, highest correct answers, then lowest seconds
          list.sort((a, b) =>
            (Number(b.percent) || 0) - (Number(a.percent) || 0) ||
            (Number(b.correct) || 0) - (Number(a.correct) || 0) ||
            (Number(a.seconds) || 0) - (Number(b.seconds) || 0)
          );
          const topList = list.slice(0, 50);
          writeLeaderboard(topList);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: topList.length }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      return;
    }
  }

  // --- API: Clear Leaderboard & Usernames ---
  if (pathname === '/api/leaderboard/clear' && req.method === 'POST') {
    writeLeaderboard([]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: 0, message: 'All usernames and leaderboard data cleared' }));
    return;
  }

  // --- Static Files ---
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // Handle Range requests for MP4 video streaming
    const range = req.headers.range;
    if (range && ext === '.mp4') {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NPTEL QuizPro server running at: http://localhost:${PORT}/ and network 0.0.0.0:${PORT}`);
});
