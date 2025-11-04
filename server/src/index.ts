import 'dotenv/config';
import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { createCorsOptions } from './utils/cors';
import { connectToDatabase } from './utils/mongo';
import { registerAuctionSocketHandlers } from './sockets/auction';
import { apiRouter } from './routes';
import { setIO } from './sockets/io';
import { errorHandler, notFound } from './middleware/error';

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: createCorsOptions(),
  transports: ['websocket', 'polling'], // Support both for better compatibility
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true, // Backward compatibility
});

setIO(io);

// Middleware
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bidarena-server' });
});

// API
app.use('/api', apiRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

// Socket handlers
io.on('connection', (socket) => {
  registerAuctionSocketHandlers(io, socket);
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
  console.error('Fatal startup error', err);
  process.exit(1);
});


