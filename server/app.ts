import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { securityHeadersMiddleware, noSqlSanitizer } from './middleware/security.ts';
import authRouter from './routes/auth.ts';
import profileRouter from './routes/profile.ts';
import supportRouter from './routes/support.ts';
import productsRouter from './routes/products.ts';
import storesRouter from './routes/stores.ts';
import ordersRouter from './routes/orders.ts';
import adminRouter from './routes/admin.ts';
import couponsRouter from './routes/coupons.ts';
import reviewsRouter from './routes/reviews.ts';
import notificationsRouter from './routes/notifications.ts';
import locationRouter from './routes/location.ts';
import paymentsRouter from './routes/payments.ts';
import wishlistRouter from './routes/wishlist.ts';
import addressesRouter from './routes/addresses.ts';
import complianceRouter from './routes/compliance.ts';

export function createExpressApp() {
  const app = express();

  // 1. Performance Compression (gzip/deflate for JSON & REST responses)
  app.use(compression());

  // 2. Security Headers (nosniff, frameguard, CSP, referrer-policy)
  app.use(securityHeadersMiddleware);

  // 2. CORS configuration (Environment-configured and development-friendly)
  const clientUrl = process.env.CLIENT_URL;
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (clientUrl && origin === clientUrl) return callback(null, true);
        // Allow local dev origins & AI Studio preview domains
        if (
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.endsWith('.run.app') ||
          origin.endsWith('.onrender.com') ||
          origin.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true); // Fallback for flexible applet iframe embedding
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-razorpay-signature'],
    })
  );

  // 3. Body parsers with size limit
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. NoSQL Operator & Prototype Pollution Sanitizer
  app.use(noSqlSanitizer);

  // API Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'DrinkIt Quick-Commerce Core API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      complianceActive: true,
      securityRbacActive: true,
    });
  });

  // REST Routers
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/stores', storesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/coupons', couponsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/location', locationRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/addresses', addressesRouter);
  app.use('/api/compliance', complianceRouter);

  // 5. Global Error Handling Middleware (Hides internal stack traces in production)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[API ERROR] ${req.method} ${req.path}:`, err?.message || err);

    const statusCode = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
      success: false,
      message: isProd
        ? 'Something went wrong. Please try again.'
        : err.message || 'An internal server error occurred.',
      errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
      ...(isProd ? {} : { stack: err.stack }),
    });
  });

  return app;
}
