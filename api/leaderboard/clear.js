const fs = require('fs');
const path = require('path');
const os = require('os');

let blobModule = null;
try {
  blobModule = require('@vercel/blob');
} catch (e) {}

const LEADERBOARD_FILE = path.join(os.tmpdir(), 'leaderboard.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'POST') {
    if (blobModule && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await blobModule.put('leaderboard.json', '[]', {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json'
        });
      } catch (e) {
        console.warn('Blob clear error:', e.message);
      }
    }
    try {
      fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf8');
    } catch (e) {}
    res.status(200).json({ success: true, count: 0, message: 'All usernames and leaderboard data cleared' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
