import express, { Request, Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.ts';
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

export function createExpressApp() {
  const app = express();

  // Basic security and parsing middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'DrinkIt Quick-Commerce Core API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      complianceActive: true,
    });
  });

  // REST Routers
  app.use('/api/auth', authRouter);
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

  return app;
}
