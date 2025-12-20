import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { recorderService } from './services/RecorderService';
import { schedulerService } from './services/SchedulerService';

// Import Routes (checking named vs default exports)
import { scriptRoutes } from './routes/scripts'; // Was testRoutes, now scriptRoutes
import { recorderRoutes } from './routes/recorder';
import { projectRoutes } from './routes/projects';
import { visualTestRouter } from './routes/visual-tests';
import testDataRoutes from './routes/test-data'; // Default export
import schedulesRoutes from './routes/schedules'; // Default export
import { adminRoutes } from './routes/admin';
import { userRoutes } from './routes/user';
import { gitRoutes } from './routes/git';
import { apiLabRouter } from './routes/api-lab';
import { runnerRoutes } from './routes/runner';
import { settingsRoutes } from './routes/settings';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware (Applied to API routes)
import { authMiddleware } from './middleware/auth';

// Public Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected Routes
app.use('/api', authMiddleware); // Protect all /api routes

// Routes Mapping
app.use('/api/tests', scriptRoutes); // Mapped to scripts
app.use('/api/recorder', recorderRoutes);
app.use('/api/projects', projectRoutes);
// Reports are handled within recorderRoutes or projectRoutes for now
// app.use('/api/reports', reportRoutes); 
app.use('/api/visual', visualTestRouter);
app.use('/api/test-data', testDataRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/git', gitRoutes);
// Initialize Scheduler
app.use('/api/runner', runnerRoutes);
app.use('/api/lab', apiLabRouter);
app.use('/api/settings', settingsRoutes);

// Initialize Scheduler
schedulerService.init().catch(err => console.error("Scheduler Init Failed:", err));

httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ Test Management Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
