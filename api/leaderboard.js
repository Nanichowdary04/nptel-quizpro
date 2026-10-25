const fs = require('fs');
const path = require('path');
const os = require('os');

let blobModule = null;
try {
  blobModule = require('@vercel/blob');
} catch (e) {}

const LEADERBOARD_FILE = path.join(os.tmpdir(), 'leaderboard.json');

async function readLeaderboard() {
  if (blobModule && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await blobModule.list({ prefix: 'leaderboard.json' });
      const target = blobs.find(b => b.pathname === 'leaderboard.json');
      if (target) {
        const response = await fetch(`${target.url}?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) return data;
        }
      }
    } catch (e) {
      console.warn('Blob read fallback:', e.message);
    }
  }

  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    const rootSeed = path.join(process.cwd(), 'leaderboard.json');
    if (fs.existsSync(rootSeed)) {
      const data = fs.readFileSync(rootSeed, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {}
  return [];
}

async function writeLeaderboard(entries) {
  let savedToBlob = false;
  if (blobModule && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await blobModule.put('leaderboard.json', JSON.stringify(entries, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      });
      savedToBlob = true;
    } catch (e) {
      console.warn('Blob write error:', e.message);
    }
  }

  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (err) {}
  return savedToBlob || true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const list = await readLeaderboard();
    res.status(200).json(list);
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const entry = body || {};
      const cleanUser = String(entry.username || '').trim().replace(/\s+/g, ' ');
      if (!cleanUser || cleanUser.length < 1 || cleanUser.length > 24) {
        res.status(400).json({ error: 'Username must be between 1 and 24 characters' });
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

      const list = await readLeaderboard();
      list.push(newRecord);
      list.sort((a, b) =>
        (Number(b.percent) || 0) - (Number(a.percent) || 0) ||
        (Number(b.correct) || 0) - (Number(a.correct) || 0) ||
        (Number(a.seconds) || 0) - (Number(b.seconds) || 0)
      );
      const topList = list.slice(0, 50);
      await writeLeaderboard(topList);

      res.status(200).json({ success: true, count: topList.length });
    } catch (e) {
      res.status(400).json({ error: 'Invalid payload' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
