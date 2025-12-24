import "dotenv/config";
import express, { Application } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import { createCorsOptions } from "./utils/cors.js";
import { connectToDatabase } from "./utils/mongo.js";
import { registerAuctionSocketHandlers } from "./sockets/auction.js";
import { apiRouter } from "./routes/index.js";
import { setIO } from "./sockets/io.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { verifyAccessToken } from "./utils/auth.js";
import { User } from "./models/User.js";
import { restoreActiveTimers } from "./utils/timer.js";
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
  // Enable compression for better performance
  perMessageDeflate: {
    threshold: 1024, // Only compress messages larger than 1KB
  },
});

setIO(io);

// Middleware
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "bidarena-server" });
});

// API
app.use("/api", apiRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

// --- CRITICAL FIX: Auth Middleware MUST be before connection handler ---
io.use(async (socket, next) => {
  try {
    const _token = socket.handshake.auth?.token as string | undefined;
    // Also check handshake query for token (common fallback)
    const token = _token || (socket.handshake.query?.token as string);

    if (!token) return next(); // allow unauthenticated sockets (spectators)

    const payload = verifyAccessToken(token);
    // Attach minimal user info to socket.data
    socket.data.user = { id: payload.sub, role: payload.role };

    // Load teamId for captains (cached on socket)
    const dbUser = await User.findById(payload.sub).select("teamId").lean();
    if (dbUser) {
      (socket.data as any).teamId = dbUser.teamId;
    }
    return next();
  } catch (err: any) {
    // If token invalid, allow connection but without user data (spectator)
    console.warn("Socket auth failed, proceeding as spectator:", err.message);
    return next();
  }
});

// Socket handlers
io.on("connection", (socket) => {
  // console.log(`Socket connected: ${socket.id} | Role: ${(socket.data as any).user?.role || 'guest'}`);
  registerAuctionSocketHandlers(io, socket);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

async function start() {
  await connectToDatabase();

  // --- ADD THIS LINE ---
  // Restores timers for any auctions that were running when server restarted
  await restoreActiveTimers();

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});
