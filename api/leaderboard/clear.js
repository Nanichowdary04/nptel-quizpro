const fs = require('fs');
const path = require('path');
const os = require('os');

const LEADERBOARD_FILE = path.join(os.tmpdir(), 'leaderboard.json');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf8');
      res.status(200).json({ success: true, count: 0, message: 'All usernames and leaderboard data cleared' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to clear leaderboard' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
