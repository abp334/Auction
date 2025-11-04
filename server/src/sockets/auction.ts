import type { Server, Socket } from 'socket.io';

export function registerAuctionSocketHandlers(io: Server, socket: Socket): void {
  socket.on('auction:join', (roomCode: string) => {
    socket.join(roomCode);
    io.to(roomCode).emit('auction:presence', { userId: socket.id, joined: true });
  });

  socket.on('auction:leave', (roomCode: string) => {
    socket.leave(roomCode);
    io.to(roomCode).emit('auction:presence', { userId: socket.id, joined: false });
  });

  socket.on('auction:bid', (payload: { roomCode: string; amount: number; teamId: string; playerId?: string }) => {
    // Validation and auth will be enforced at HTTP layer for persistence; sockets relay updates
    io.to(payload.roomCode).emit('auction:bid_update', {
      by: socket.id,
      amount: payload.amount,
      teamId: payload.teamId,
      playerId: payload.playerId,
      at: Date.now(),
    });
  });
}


