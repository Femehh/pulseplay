const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const users = [
    { username: 'ProGamer99', email: 'pro@pulseplay.gg', elo: 1850 },
    { username: 'NeonStrike', email: 'neon@pulseplay.gg', elo: 1720 },
    { username: 'SwiftClick', email: 'swift@pulseplay.gg', elo: 1600 },
    { username: 'PulseKing', email: 'king@pulseplay.gg', elo: 1550 },
    { username: 'ReflexAce', email: 'reflex@pulseplay.gg', elo: 1480 },
  ];

  const password = await bcrypt.hash('password123', 10);

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        passwordHash: password,
        stats: {
          create: {
            elo: u.elo,
            peakElo: u.elo,
            totalMatches: Math.floor(Math.random() * 200) + 50,
            wins: Math.floor(Math.random() * 150) + 30,
            losses: Math.floor(Math.random() * 60) + 10,
            avgReactionTime: Math.random() * 100 + 180,
          },
        },
      },
    });

    // Create rankings for each game type
    const gameTypes = ['REACTION_TIME', 'COLOR_MATCH', 'SOUND_RECOGNITION', 'AIM_TRAINER', 'MEMORY_TILES'];
    for (const gameType of gameTypes) {
      await prisma.ranking.upsert({
        where: { userId_gameType: { userId: user.id, gameType } },
        update: {},
        create: {
          userId: user.id,
          gameType,
          elo: u.elo + Math.floor(Math.random() * 100 - 50),
        },
      });
    }

    console.log(`Created user: ${u.username}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
