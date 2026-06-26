import "dotenv/config";
import express, { Application } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createCorsOptions } from "./utils/cors.js";
import { connectDatabase, disconnectDatabase } from "./utils/db.js";
import { getRedis, createRedisClient, disconnectRedis } from "./utils/redis.js";
import { registerAuctionSocketHandlers } from "./sockets/auction.js";
import { apiRouter } from "./routes/index.js";
import { setIO } from "./sockets/io.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { verifyAccessToken } from "./utils/auth.js";
import { restoreActiveTimers } from "./utils/timer.js";
import { logger } from "./utils/logger.js";
import prisma from "./utils/db.js";

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: createCorsOptions(),
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true,
  connectTimeout: 45000,
  perMessageDeflate: { threshold: 1024 },
});

setIO(io);

// Redis adapter for Socket.IO (horizontal scaling)
try {
  if (process.env.REDIS_URL) {
    const pubClient = createRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter configured");
  }
} catch (err) {
  logger.warn({ err }, "Redis adapter setup failed, using in-memory adapter");
}

// Global middleware
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(cookieParser());

// CSRF protection on cookie-reliant routes
import { csrfProtection } from "./middleware/csrf.js";
app.use("/api/v1/auth", csrfProtection());

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many auth attempts, please try again later" },
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/signup", authLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many contact messages. Please try again later." },
});
app.use("/api/v1/contact", contactLimiter);

// Health check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisOk = process.env.REDIS_URL
      ? await getRedis()
          .ping()
          .then(() => true)
          .catch(() => false)
      : "not configured";

    res.json({
      ok: true,
      service: "bidarena-server",
      db: "connected",
      redis: redisOk,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ ok: false, error: "Database unavailable" });
  }
});

// API routes
app.use("/api", apiRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

// Socket.IO auth middleware
io.use(async (socket, next) => {
  try {
    const _token = socket.handshake.auth?.token as string | undefined;
    const token = _token || (socket.handshake.query?.token as string);
    if (!token) return next();

    const payload = verifyAccessToken(token);
    socket.data.user = { id: payload.sub, role: payload.role };

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { teamId: true },
    });
    if (dbUser) {
      (socket.data as any).teamId = dbUser.teamId;
    }
    return next();
  } catch (err: any) {
    logger.warn({ msg: err.message }, "Socket auth failed, allowing as spectator");
    return next();
  }
});

// Socket connection handler
io.on("connection", (socket) => {
  registerAuctionSocketHandlers(io, socket);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

// Graceful shutdown
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal");

  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("All connections closed");
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function start() {
  await connectDatabase();
  logger.info("Database connected");

  // Initialize Redis
  if (process.env.REDIS_URL) {
    try {
      getRedis();
      logger.info("Redis initialized");
    } catch (err) {
      logger.warn({ err }, "Redis not available, running without it");
    }
  }

  await restoreActiveTimers();

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server listening");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
