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

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: createCorsOptions(),
  transports: ["websocket", "polling"], // Support both for better compatibility
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e6, // 1MB limit
  allowEIO3: true, // Backward compatibility
  connectTimeout: 45000, // 45 seconds
  upgradeTimeout: 10000, // 10 seconds
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

// Socket handlers
io.on("connection", (socket) => {
  registerAuctionSocketHandlers(io, socket);
});

// Socket auth middleware - optionally attach user info when token provided.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    const payload = verifyAccessToken(token);
    // Attach minimal user info to socket.data
    socket.data.user = { id: payload.sub, role: payload.role };
    // Load teamId for captains (cached on socket)
    const dbUser = await User.findById(payload.sub).select("teamId").lean();
    if (dbUser) {
      (socket.data as any).teamId = dbUser.teamId;
    }
    return next();
  } catch (err) {
    return next(new Error("Authentication error"));
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

async function start() {
  await connectToDatabase();
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
