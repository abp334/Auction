import { Router } from "express";

import authRoutes from "./v1/auth.routes.js";
import teamRoutes from "./v1/team.routes.js";
import playerRoutes from "./v1/player.routes.js";
import auctionRoutes from "./v1/auction.routes.js";
import userRoutes from "./v1/user.routes.js";

export const apiRouter = Router();

apiRouter.use("/v1/auth", authRoutes);
apiRouter.use("/v1/teams", teamRoutes);
apiRouter.use("/v1/players", playerRoutes);
apiRouter.use("/v1/auctions", auctionRoutes);
apiRouter.use("/v1/users", userRoutes);
