const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getRankTier } = require('../utils/elo');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/leaderboard?gameType=REACTION_TIME&limit=50&offset=0
router.get('/', async (req, res) => {
  try {
    const { gameType, limit = 50, offset = 0 } = req.query;

    if (gameType) {
      // Game-specific leaderboard
      const rankings = await prisma.ranking.findMany({
        where: { gameType },
        orderBy: { elo: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      });

      return res.json(
        rankings.map((r, i) => ({
          rank: Number(offset) + i + 1,
          userId: r.userId,
          username: r.user.username,
          avatarUrl: r.user.avatarUrl,
          elo: r.elo,
          tier: getRankTier(r.elo),
        }))
      );
    }

    // Global leaderboard (overall ELO from stats)
    const stats = await prisma.userStats.findMany({
      orderBy: { elo: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, isGuest: true },
        },
      },
    });

    res.json(
      stats
        .filter((s) => !s.user.isGuest)
        .map((s, i) => ({
          rank: Number(offset) + i + 1,
          userId: s.userId,
          username: s.user.username,
          avatarUrl: s.user.avatarUrl,
          elo: s.elo,
          wins: s.wins,
          losses: s.losses,
          totalMatches: s.totalMatches,
          winRate: s.totalMatches > 0 ? Math.round((s.wins / s.totalMatches) * 100) : 0,
          tier: getRankTier(s.elo),
        }))
    );
  } catch (err) {
    console.error('[LEADERBOARD]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
