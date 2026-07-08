require('dotenv').config();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('\n================================================================');
  console.warn('⚠️  WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing!');
  console.warn('Please copy .env.template to .env and fill in your credentials.');
  console.warn('Google Drive integration will not work until this is configured.');
  console.warn('================================================================\n');
}

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple Local Database file
let db = { users: {} };
if (fs.existsSync(DB_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (error) {
    console.error('Failed to parse database file, resetting:', error.message);
  }
}

const saveDb = () => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

// In-memory Session Store (sessionToken -> username)
const sessions = {};

// Hash password utility using built-in PBKDF2
const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
};

// Create a new OAuth2 client instance
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Validate user session token
const validateSession = (req, res, next) => {
  let token = req.query.sessionToken;
  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing session' });
  }

  req.username = sessions[token];
  req.sessionToken = token;
  next();
};

// Get authenticated Google Drive client for a specific user
const getDriveClientForUser = (username) => {
  const user = db.users[username];
  if (!user || !user.googleTokens) {
    throw new Error('Google Drive is not connected. Please connect your Google account first.');
  }

  const client = getOAuth2Client();
  client.setCredentials(user.googleTokens);

  // Listen to refresh events and save back to the DB
  client.on('tokens', (tokens) => {
    const currentUser = db.users[username];
    if (currentUser) {
      currentUser.googleTokens = { ...currentUser.googleTokens, ...tokens };
      saveDb();
      console.log(`Google tokens refreshed and saved for user: ${username}`);
    }
  });

  return google.drive({ version: 'v3', auth: client });
};

// ================= USER ACCOUNT APIs =================

// Register a new user
app.post('/api/register', (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;
  if (!username || !password || username.trim().length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username must be >= 3 characters, password >= 4 characters' });
  }
  if (!securityQuestion || !securityAnswer || securityQuestion.trim().length === 0 || securityAnswer.trim().length === 0) {
    return res.status(400).json({ error: 'Security question and answer are required' });
  }

  const normalizedUser = username.trim().toLowerCase();
  if (db.users[normalizedUser]) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const securityAnswerHash = hashPassword(securityAnswer.trim().toLowerCase(), salt);

  db.users[normalizedUser] = {
    username: username.trim(),
    salt: salt,
    passwordHash: passwordHash,
    securityQuestion: securityQuestion.trim(),
    securityAnswerHash: securityAnswerHash,
    googleTokens: null
  };
  saveDb();

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = normalizedUser;

  res.json({ success: true, token, username: username.trim() });
});

// Retrieve security question for username
app.post('/api/forgot-password/question', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username' });
  }
  const normalizedUser = username.trim().toLowerCase();
  const user = db.users[normalizedUser];
  if (!user) {
    return res.status(400).json({ error: 'User does not exist' });
  }
  if (!user.securityQuestion) {
    return res.status(400).json({ error: 'No security question configured for this account. Contact admin.' });
  }
  res.json({ success: true, question: user.securityQuestion });
});

// Reset password with verified security answer
app.post('/api/forgot-password/reset', (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;
  if (!username || !securityAnswer || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Invalid parameters. Password must be >= 4 characters.' });
  }
  const normalizedUser = username.trim().toLowerCase();
  const user = db.users[normalizedUser];
  if (!user) {
    return res.status(400).json({ error: 'User does not exist' });
  }
  if (!user.securityAnswerHash) {
    return res.status(400).json({ error: 'No security question configured for this account.' });
  }
  const answerHash = hashPassword(securityAnswer.trim().toLowerCase(), user.salt);
  if (answerHash !== user.securityAnswerHash) {
    return res.status(400).json({ error: 'Incorrect security answer.' });
  }
  
  // Reset password
  user.passwordHash = hashPassword(newPassword, user.salt);
  saveDb();
  res.json({ success: true });
});

// Login user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const user = db.users[normalizedUser];
  if (!user) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = normalizedUser;

  res.json({ success: true, token, username: user.username });
});

// Logout session
app.post('/api/session-logout', validateSession, (req, res) => {
  delete sessions[req.sessionToken];
  res.json({ success: true });
});

// ================= GOOGLE DRIVE APIs =================

// Check auth status
app.get('/api/auth-status', validateSession, (req, res) => {
  const user = db.users[req.username];
  const authenticated = !!(user && user.googleTokens && user.googleTokens.access_token);
  res.json({ authenticated, username: user ? user.username : null });
});

// Generate Google direct login URL
app.get('/api/google-login-url', (req, res) => {
  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: 'direct_login',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
  res.json({ url });
});

// Generate Google auth URL
app.get('/api/auth-url', (req, res) => {
  const { sessionToken } = req.query;
  if (!sessionToken || !sessions[sessionToken]) {
    return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
  }

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: sessionToken, // Embed sessionToken as OAuth state parameter
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
  res.json({ url });
});

// OAuth callback receiver
app.get('/oauth2callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (state === 'direct_login') {
      // 1. Direct login flow using UserInfo profile
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      const name = userInfo.data.name || email.split('@')[0];

      if (!email) {
        return res.status(400).send('Failed to retrieve email from Google login');
      }

      const normalizedUser = email.trim().toLowerCase();
      if (!db.users[normalizedUser]) {
        // Register Google user profile
        db.users[normalizedUser] = {
          username: name,
          isGoogleUser: true
        };
      }
      db.users[normalizedUser].googleTokens = tokens;
      saveDb();

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      sessions[token] = normalizedUser;

      console.log(`Direct Google Login successful for: ${normalizedUser}`);
      return res.redirect(`/?loginToken=${token}&username=${encodeURIComponent(name)}`);
    } else {
      // 2. Existing connect Google Drive flow
      if (!state || !sessions[state]) {
        return res.status(401).send('Unauthorized state parameter');
      }
      const username = sessions[state];
      const user = db.users[username];
      if (!user) {
        return res.status(500).send('User account not found');
      }

      user.googleTokens = tokens;
      saveDb();

      console.log(`Connected Google Drive for user: ${username}`);
      return res.redirect(`/?authSuccess=true`);
    }
  } catch (error) {
    console.error('Error during Google authentication:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Disconnect user's Google account
app.post('/api/google-disconnect', validateSession, (req, res) => {
  const user = db.users[req.username];
  if (user) {
    user.googleTokens = null;
    saveDb();
    console.log(`Disconnected Google Drive for user: ${req.username}`);
  }
  res.json({ success: true });
});

// List files inside parent directory
app.get('/api/files', validateSession, async (req, res) => {
  const parentId = req.query.parentId || 'root';

  try {
    const drive = getDriveClientForUser(req.username);

    let query;
    if (parentId === 'shared-with-me') {
      // Query files and folders shared with the user
      query = `sharedWithMe = true and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/') and trashed = false`;
    } else {
      // Query standard files inside the parent directory
      query = `'${parentId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/') and trashed = false`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, thumbnailLink, iconLink)',
      orderBy: 'folder,name',
      pageSize: 200
    });

    let files = response.data.files || [];

    // Inject "Shared with me" virtual directory if listing root level
    if (parentId === 'root') {
      files.unshift({
        id: 'shared-with-me',
        name: 'Shared with me',
        mimeType: 'application/vnd.google-apps.folder',
        size: null
      });
    }

    res.json({ files });
  } catch (error) {
    console.error(`Error listing files for user ${req.username}:`, error.message);
    const status = error.code || 500;
    res.status(status).json({ error: error.message });
  }
});

// Stream video file (supports HTTP Range headers)
app.get('/api/stream/:fileId', validateSession, async (req, res) => {
  const { fileId } = req.params;
  const { roomId } = req.query;
  const rangeHeader = req.headers.range;

  try {
    let targetUsername = req.username;

    // Check if streaming via watch party room delegation
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      if (room.loadedBy && room.loadedFileId === fileId) {
        // Verify req.username is an active participant in this room
        let isUserInRoom = false;
        for (const wsClient of room) {
          if (wsClient.normalizedUsername === req.username) {
            isUserInRoom = true;
            break;
          }
        }
        if (isUserInRoom) {
          console.log(`Watch Party Stream delegation: user "${req.username}" streaming host "${room.loadedBy}"'s file "${fileId}"`);
          targetUsername = room.loadedBy;
        }
      }
    }

    const drive = getDriveClientForUser(targetUsername);

    // Get file size and MIME type
    const metadata = await drive.files.get({
      fileId: fileId,
      fields: 'size, mimeType, name'
    });

    const fileSize = parseInt(metadata.data.size, 10);
    const mimeType = metadata.data.mimeType || 'video/mp4';

    console.log(`Streaming file "${metadata.data.name}" (${fileSize} bytes) for user ${req.username} - Range: ${rangeHeader || 'None'}`);

    const requestConfig = { fileId, alt: 'media' };
    const requestOptions = { responseType: 'stream' };

    if (rangeHeader) {
      requestOptions.headers = { Range: rangeHeader };
      const driveResponse = await drive.files.get(requestConfig, requestOptions);

      res.status(206);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Range', driveResponse.headers['content-range'] || `bytes ${rangeHeader.replace('bytes=', '')}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', driveResponse.headers['content-length'] || fileSize);

      driveResponse.data.on('error', (err) => {
        console.error('Stream node piping error:', err.message);
      });
      driveResponse.data.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');

      const driveResponse = await drive.files.get(requestConfig, requestOptions);
      driveResponse.data.pipe(res);
    }
  } catch (error) {
    console.error(`Error proxying video stream for user ${req.username}:`, error.message);
    if (!res.headersSent) {
      res.status(error.code || 500).json({ error: error.message });
    }
  }
});

// ================= YOUTUBE-LIKE DASHBOARD APIs =================

// 1. Get Dashboard Continue Watching & History Lists
app.get('/api/dashboard', validateSession, (req, res) => {
  const user = db.users[req.username];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const progressMap = user.playbackProgress || {};
  const historyList = user.watchHistory || [];

  // Filter partially watched items (between 1% and 95% complete)
  const continueWatching = Object.values(progressMap)
    .filter(item => {
      if (!item.duration || item.duration === 0) return false;
      const percent = item.currentTime / item.duration;
      return percent >= 0.01 && percent <= 0.95;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 15);

  // Return last 20 history items
  const history = historyList
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  res.json({ continueWatching, history });
});

// 2. Save current playback progress & add to history
app.post('/api/progress', validateSession, (req, res) => {
  const { fileId, name, currentTime, duration } = req.body;
  if (!fileId || !name || currentTime === undefined || !duration) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const user = db.users[req.username];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.playbackProgress = user.playbackProgress || {};
  user.watchHistory = user.watchHistory || [];

  // Update progress map
  user.playbackProgress[fileId] = {
    fileId,
    name,
    currentTime: parseFloat(currentTime),
    duration: parseFloat(duration),
    updatedAt: Date.now()
  };

  // Add/move to front of watch history
  const historyIndex = user.watchHistory.findIndex(item => item.fileId === fileId);
  if (historyIndex > -1) {
    user.watchHistory.splice(historyIndex, 1);
  }
  user.watchHistory.unshift({
    fileId,
    name,
    timestamp: Date.now()
  });

  // Keep history limited to last 50 entries
  if (user.watchHistory.length > 50) {
    user.watchHistory = user.watchHistory.slice(0, 50);
  }

  saveDb();
  res.json({ success: true });
});

// 3. Retrieve playback progress position of specific fileId
app.get('/api/progress/:fileId', validateSession, (req, res) => {
  const { fileId } = req.params;
  const user = db.users[req.username];
  
  if (!user || !user.playbackProgress || !user.playbackProgress[fileId]) {
    return res.json({ currentTime: 0 });
  }

  const progress = user.playbackProgress[fileId];
  if (progress.duration > 0) {
    const percent = progress.currentTime / progress.duration;
    // If progress is greater than 95%, reset to 0 so video replays from start
    if (percent > 0.95) {
      return res.json({ currentTime: 0 });
    }
  }

  res.json({ currentTime: progress.currentTime, duration: progress.duration });
});

// 4. Search videos across the entire Drive using query
app.get('/api/search', validateSession, async (req, res) => {
  const searchVal = req.query.query;
  if (!searchVal || searchVal.trim().length === 0) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const drive = getDriveClientForUser(req.username);

    // Escape single quotes for safety in search query
    const escapedQuery = searchVal.replace(/'/g, "\\'");
    const query = `name contains '${escapedQuery}' and mimeType contains 'video/' and trashed = false`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, thumbnailLink, iconLink)',
      orderBy: 'name',
      pageSize: 50
    });

    res.json({ files: response.data.files });
  } catch (error) {
    console.error(`Error searching Google Drive for user ${req.username}:`, error.message);
    const status = error.code || 500;
    res.status(status).json({ error: error.message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Private multi-user video streaming service listening at http://localhost:${PORT}`);
});

// ================= WEBSOCKET WATCH PARTY SYNC =================

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const rooms = {}; // roomId -> Set of ws clients

wss.on('connection', (ws, req) => {
  try {
    const params = new URL(req.url, 'http://' + (req.headers.host || 'localhost')).searchParams;
    const token = params.get('sessionToken');
    const roomId = params.get('roomId');

    // 1. Session authentication
    if (!token || !sessions[token]) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    if (!roomId || roomId.trim().length === 0) {
      ws.close(4002, 'Missing Room ID');
      return;
    }

    const username = sessions[token];
    ws.username = db.users[username]?.username || username;
    ws.normalizedUsername = username;
    ws.roomId = roomId.trim();

    // 2. Add client to room
    if (!rooms[ws.roomId]) {
      rooms[ws.roomId] = new Set();
    }
    rooms[ws.roomId].add(ws);
    console.log(`User "${ws.username}" connected to Watch Party Room: ${ws.roomId}`);

    // Notify room of connection
    broadcastToRoom(ws.roomId, {
      type: 'joined',
      username: ws.username,
      message: `${ws.username} joined the party`
    });

    sendParticipantsList(ws.roomId);

    // 3. Listen to sync control messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'sync') {
          if (data.action === 'load' && rooms[ws.roomId]) {
            rooms[ws.roomId].loadedBy = ws.normalizedUsername;
            rooms[ws.roomId].loadedFileId = data.fileId;
          }
          // Broadcast full sync adjustments (including extra fields like fileId, name, youtubeId) to room peers
          const payload = { ...data, sender: ws.username };
          broadcastToRoom(ws.roomId, payload, ws);
        }
      } catch (err) {
        console.error('Watch Party sync parse error:', err.message);
      }
    });

    // 4. Handle client disconnect
    ws.on('close', () => {
      if (rooms[ws.roomId]) {
        rooms[ws.roomId].delete(ws);
        console.log(`User "${ws.username}" left Watch Party Room: ${ws.roomId}`);

        broadcastToRoom(ws.roomId, {
          type: 'left',
          username: ws.username,
          message: `${ws.username} left the party`
        });

        if (rooms[ws.roomId].size === 0) {
          delete rooms[ws.roomId];
        } else {
          sendParticipantsList(ws.roomId);
        }
      }
    });

  } catch (err) {
    console.error('WebSocket connection setup error:', err.message);
    ws.close(1011, 'Internal Server Error');
  }
});

// Helper: Broadcast payload to room members (optionally excluding the sender)
function broadcastToRoom(roomId, data, excludeWs = null) {
  const clients = rooms[roomId];
  if (!clients) return;
  const payload = JSON.stringify(data);
  clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Helper: Broadcast updated list of participants in room
function sendParticipantsList(roomId) {
  const clients = rooms[roomId];
  if (!clients) return;
  const list = Array.from(clients).map(c => c.username);
  broadcastToRoom(roomId, {
    type: 'participants',
    list: list
  });
}
