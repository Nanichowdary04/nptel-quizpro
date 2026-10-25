const fs = require('fs');
const path = require('path');
const os = require('os');

const LEADERBOARD_FILE = path.join(os.tmpdir(), 'leaderboard.json');

function readLeaderboard() {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      return [];
    }
    const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeLeaderboard(entries) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const list = readLeaderboard();
    res.status(200).json(list);
    return;
  }

  if (req.method === 'POST') {
    try {
      const entry = req.body || {};
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

      const list = readLeaderboard();
      list.push(newRecord);
      list.sort((a, b) =>
        (Number(b.percent) || 0) - (Number(a.percent) || 0) ||
        (Number(b.correct) || 0) - (Number(a.correct) || 0) ||
        (Number(a.seconds) || 0) - (Number(b.seconds) || 0)
      );
      const topList = list.slice(0, 50);
      writeLeaderboard(topList);

      res.status(200).json({ success: true, count: topList.length });
    } catch (e) {
      res.status(400).json({ error: 'Invalid payload' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
