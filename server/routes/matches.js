const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/matches/active
router.get('/active', (req, res) => {
  // Returns active match count per game type (from in-memory state)
  // In production, this would come from Redis
  res.json({ message: 'Use WebSocket for real-time match state' });
});

// GET /api/matches/:id
router.get('/:id', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        player1: { select: { username: true, avatarUrl: true } },
        player2: { select: { username: true, avatarUrl: true } },
        winner: { select: { username: true } },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

module.exports = router;
