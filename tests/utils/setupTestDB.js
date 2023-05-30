const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const setupTestDB = () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
};

module.exports = { setupTestDB, prisma };
