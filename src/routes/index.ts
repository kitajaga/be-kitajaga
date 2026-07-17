import { Router, Request, Response } from 'express';
import path from 'path';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import bookingRoutes from './booking.routes';
import caregiverRoutes from './caregiver.routes';
import paymentRoutes from './payment.routes';
import guidebookRoutes from './guidebook.routes';
import userRoutes from './user.routes';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';

const router = Router();

function renderLandingPage(baseUrl: string): string {
  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Kitajaga API — Backend Services</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background-color: #0b0f19;
            color: #f3f4f6;
            font-family: 'Outfit', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2rem 1rem;
            background-image: 
              radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.08) 0%, transparent 40%);
          }
          .container {
            max-width: 680px;
            width: 100%;
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 2.5rem;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.1);
          }
          .badge-status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
          }
          .pulse-dot {
            width: 8px;
            height: 8px;
            background-color: #34d399;
            border-radius: 50%;
            box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
            }
            70% {
              transform: scale(1);
              box-shadow: 0 0 0 10px rgba(52, 211, 153, 0);
            }
            100% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
            }
          }
          h1 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1.5rem;
            letter-spacing: -0.02em;
          }
          .gif-wrapper {
            margin: 1rem 0 2rem 0;
            display: flex;
            justify-content: center;
          }
          .gif-wrapper img {
            width: 260px;
            max-width: 100%;
            height: auto;
            border-radius: 20px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
            transition: transform 0.3s ease;
          }
          .gif-wrapper img:hover {
            transform: scale(1.03);
          }
          .base-url-box {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px 18px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.95rem;
            color: #9ca3af;
            margin-bottom: 2rem;
            word-break: break-all;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .base-url-box span {
            color: #34d399;
            font-weight: 600;
          }
          .groups-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #6b7280;
            margin-bottom: 1rem;
            font-weight: 700;
          }
          .groups-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px;
            margin-bottom: 2.5rem;
          }
          .group-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 0.9rem;
            font-weight: 600;
            color: #e5e7eb;
            transition: all 0.2s ease;
          }
          .group-card:hover {
            background: rgba(16, 185, 129, 0.1);
            border-color: rgba(16, 185, 129, 0.3);
            color: #34d399;
            transform: translateY(-2px);
          }
          .btn-docs {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 1.05rem;
            padding: 14px 36px;
            border-radius: 9999px;
            text-decoration: none;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
            transition: all 0.3s ease;
          }
          .btn-docs:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(16, 185, 129, 0.45);
            background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
          }
          footer {
            margin-top: 2rem;
            font-size: 0.8rem;
            color: #4b5563;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge-status">
            <span class="pulse-dot"></span>
            ✅ Server is running
          </div>

          <h1>Kitajaga API</h1>

          <div class="gif-wrapper">
            <img 
              src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdncybHR1cGY0Y29hem0wenJ6cmQ4NG9paXp0ZW16dnEwZnpka3cxeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QtZSl6mcqfmvCBI2cb/giphy.gif" 
              alt="Kitajaga Animation" 
            />
          </div>

          <div class="base-url-box">
            Base URL: <span>${baseUrl}</span>
          </div>

          <div class="groups-title">API Groups</div>
          <div class="groups-grid">
            <div class="group-card">🔐 Auth</div>
            <div class="group-card">👤 Patient</div>
            <div class="group-card">📅 Booking</div>
            <div class="group-card">💳 Payment</div>
            <div class="group-card">📖 Guidebook</div>
            <div class="group-card">📍 Progress</div>
            <div class="group-card">📋 Report</div>
            <div class="group-card">⭐ Rating</div>
          </div>

          <a href="/api/docs" class="btn-docs">
            📚 API Docs
          </a>
        </div>

        <footer>
          &copy; 2026 Kitajaga — Emergency Healthcare Assistance Platform
        </footer>
      </body>
    </html>
  `;
}

// Root landing page for GET /api
router.get('/', (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}/api`;
  res.send(renderLandingPage(baseUrl));
});

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// API Documentation (OpenAPI JSON & Scalar API Reference UI)
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../docs/openapi.json'));
});

router.get('/docs', (_req: Request, res: Response) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>Kitajaga API Documentation</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            background-color: #111;
          }
        </style>
      </head>
      <body>
        <script id="api-reference" data-url="/api/openapi.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/bookings', bookingRoutes);
router.use('/caregivers', caregiverRoutes);
router.use('/payments', paymentRoutes);
router.use('/guidebooks', guidebookRoutes);

export default router;
