const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { getRankTier } = require('../utils/elo');

const router = express.Router();
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/users/:username
router.get('/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: { stats: true, rankings: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const s = user.stats;
    res.json({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      stats: s ? {
        elo: s.elo,
        peakElo: s.peakElo,
        wins: s.wins,
        losses: s.losses,
        totalMatches: s.totalMatches,
        winRate: s.totalMatches > 0 ? Math.round((s.wins / s.totalMatches) * 100) : 0,
        avgReactionTime: s.avgReactionTime,
        currentWinStreak: s.currentWinStreak || 0,
        bestWinStreak: s.bestWinStreak || 0,
        // Per-game win counts
        reactionWins: s.reactionWins || 0,
        colorMatchWins: s.colorMatchWins || 0,
        soundRecogWins: s.soundRecogWins || 0,
        aimTrainerWins: s.aimTrainerWins || 0,
        memoryTilesWins: s.memoryTilesWins || 0,
        checkersWins: s.checkersWins || 0,
        tier: getRankTier(s.elo),
      } : null,
      rankings: user.rankings.map((r) => ({
        gameType: r.gameType,
        elo: r.elo,
        tier: getRankTier(r.elo),
      })),
    });
  } catch (err) {
    console.error('[USERS]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/users/:username/matches
router.get('/:username/matches', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ player1Id: user.id }, { player2Id: user.id }],
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        winner: { select: { username: true } },
      },
    });

    res.json(matches.map((m) => ({
      id: m.id,
      gameType: m.gameType,
      opponent: m.player1Id === user.id ? m.player2?.username : m.player1.username,
      won: m.winnerId === user.id,
      myScore: m.player1Id === user.id ? m.player1Score : m.player2Score,
      opponentScore: m.player1Id === user.id ? m.player2Score : m.player1Score,
      eloChange: m.player1Id === user.id ? m.player1EloChange : m.player2EloChange,
      playedAt: m.endedAt,
      duration: m.duration,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;
