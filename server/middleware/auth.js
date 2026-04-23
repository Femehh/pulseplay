const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Socket.io authentication middleware.
 * Accepts JWT tokens OR creates a guest session.
 */
module.exports = function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      socket.handshake.auth.player = {
        id: decoded.id,
        username: decoded.username,
        elo: decoded.elo || 1000,
        isGuest: false,
      };
      return next();
    } catch (err) {
      // Invalid token — fall through to guest
    }
  }

  // Guest mode
  const guestId = socket.handshake.auth?.guestId || `guest_${uuidv4().slice(0, 8)}`;
  const guestName = socket.handshake.auth?.username || `Guest_${guestId.slice(-4)}`;

  socket.handshake.auth.player = {
    id: guestId,
    username: guestName,
    elo: 1000,
    isGuest: true,
  };

  next();
};
