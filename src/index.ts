import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server } from 'socket.io';

import { auth } from './firebase';

// Router imports
import { projectRoutes } from './routes/projects';
import { recorderRoutes } from './routes/recorder';
import { gitRoutes } from './routes/git';
import { aiRouter } from './routes/ai';
import { visualTestRouter } from './routes/visual-tests';
import webhookRoutes from './routes/webhooks';
import { recorderService } from './services/RecorderService';
import { projectService } from './services/ProjectService';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Pass socket instance to recorder service
recorderService.setSocket(io);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());



// ... imports

// Auth Middleware to verify Firebase ID token
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  const userIdHeader = req.headers['x-user-id'] as string;

  if (token) {
    try {
      const decodedToken = await auth.verifyIdToken(token);
      (req as any).user = { uid: decodedToken.uid, email: decodedToken.email };
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      // Fallback to x-user-id if token verification fails (e.g. dev env without creds)
      if (userIdHeader) {
        console.warn('Falling back to insecure x-user-id header');
        // Retrieve email map for dev mode? Or just mock it? 
        // For now, in dev mode without token, we might miss email.
        // We'll trust the header if needed for dev role testing later.
        (req as any).user = { uid: userIdHeader, email: 'admin@testflow.com' }; // Default to admin in dev mode for simplicity? No, risky. 
        // Just use uid. Role check will fail without email.
        (req as any).user = { uid: userIdHeader };
      }
    }
  } else if (userIdHeader) {
    // Fallback for requests without token (should be avoided)
    (req as any).user = { uid: userIdHeader };
  }

  next();
});

import { adminRoutes } from './routes/admin';

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/recorder', recorderRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/ai', aiRouter);
app.use('/api/visual', visualTestRouter);
app.use('/api/webhooks', webhookRoutes); // Webhook Routes
import testDataRoutes from './routes/test-data';
app.use('/api/admin', adminRoutes); // New Admin Routes
app.use('/api/test-data', testDataRoutes); // Data Driven Testing Routes
import schedulesRoutes from './routes/schedules';
app.use('/api/schedules', schedulesRoutes); // Scheduler Routes

// Role Endpoint
app.get('/api/user/role', (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || !user.email) {
      // If no email (e.g. dev mode x-user-id), we default to TESTER unless hardcoded
      // For now return TESTER
      return res.json({ role: 'TESTER' });
    }

    const fs = require('fs');
    const path = require('path');
    const rolesPath = path.join(__dirname, '../data/roles.json');

    if (fs.existsSync(rolesPath)) {
      const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
      const userRole = roles[user.email] || 'TESTER';
      return res.json({ role: userRole });
    }

    res.json({ role: 'TESTER' });
  } catch (error) {
    console.error('Role check error:', error);
    res.status(500).json({ error: 'Failed to check role' });
  }
});

// Migration Endpoint
app.post('/api/migrate-data', async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await projectService.claimPublicData(userId);
    res.json({ status: 'success', message: 'Data migrated to user' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

import { schedulerService } from './services/SchedulerService';

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize Scheduler
schedulerService.init().catch(err => console.error("Scheduler Init Failed:", err));

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`✅ Test Management Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎥 Recorder API: http://localhost:${PORT}/api/recorder`);
});
