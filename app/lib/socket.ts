import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) throw new Error('Socket not initialized. Call initSocket() first.');
  return socket;
}

export function initSocket(token?: string, guestId?: string, username?: string): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    // Reconnect existing socket with updated auth
    socket.auth = { token, guestId, username };
    socket.connect();
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
    auth: { token, guestId, username },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    reconnectionAttempts: Infinity, // never give up while tab is open
    timeout: 10000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
