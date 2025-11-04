import { Router } from 'express';

import authRoutes from './v1/auth.routes';
import teamRoutes from './v1/team.routes';
import playerRoutes from './v1/player.routes';
import auctionRoutes from './v1/auction.routes';

export const apiRouter = Router();

apiRouter.use('/v1/auth', authRoutes);
apiRouter.use('/v1/teams', teamRoutes);
apiRouter.use('/v1/players', playerRoutes);
apiRouter.use('/v1/auctions', auctionRoutes);


