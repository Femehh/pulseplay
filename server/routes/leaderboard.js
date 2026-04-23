const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getRankTier } = require('../utils/elo');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/leaderboard?gameType=X&limit=50&offset=0&search=username
router.get('/', async (req, res) => {
  try {
    const { gameType, limit = 50, offset = 0, search } = req.query;
    const take = Math.min(Number(limit), 100);
    const skip = Number(offset);

    if (gameType) {
      // Game-specific leaderboard
      const where = {
        gameType,
        ...(search ? { user: { username: { contains: search, mode: 'insensitive' } } } : {}),
      };

      const [rankings, total] = await Promise.all([
        prisma.ranking.findMany({
          where,
          orderBy: { elo: 'desc' },
          take,
          skip,
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        }),
        prisma.ranking.count({ where }),
      ]);

      return res.json({
        entries: rankings.map((r, i) => ({
          rank: skip + i + 1,
          userId: r.userId,
          username: r.user.username,
          avatarUrl: r.user.avatarUrl,
          elo: r.elo,
          tier: getRankTier(r.elo),
        })),
        total,
        offset: skip,
        limit: take,
      });
    }

    // Global leaderboard
    const where = search
      ? { user: { username: { contains: search, mode: 'insensitive' }, isGuest: false } }
      : { user: { isGuest: false } };

    const [stats, total] = await Promise.all([
      prisma.userStats.findMany({
        where,
        orderBy: { elo: 'desc' },
        take,
        skip,
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true, isGuest: true },
          },
        },
      }),
      prisma.userStats.count({ where }),
    ]);

    res.json({
      entries: stats.map((s, i) => ({
        rank: skip + i + 1,
        userId: s.userId,
        username: s.user.username,
        avatarUrl: s.user.avatarUrl,
        elo: s.elo,
        wins: s.wins,
        losses: s.losses,
        totalMatches: s.totalMatches,
        winRate: s.totalMatches > 0 ? Math.round((s.wins / s.totalMatches) * 100) : 0,
        currentWinStreak: s.currentWinStreak || 0,
        bestWinStreak: s.bestWinStreak || 0,
        tier: getRankTier(s.elo),
      })),
      total,
      offset: skip,
      limit: take,
    });
  } catch (err) {
    console.error('[LEADERBOARD]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
