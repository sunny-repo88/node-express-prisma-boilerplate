const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const moment = require('moment');
const config = require('../../src/config/config');
const { tokenTypes } = require('../../src/config/tokens');
const tokenService = require('../../src/services/token.service');

const prisma = new PrismaClient();

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const userOne = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password: hashedPassword,
  role: 'user',
  isEmailVerified: false,
};

const userTwo = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password: hashedPassword,
  role: 'user',
  isEmailVerified: false,
};

const admin = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password: hashedPassword,
  role: 'admin',
  isEmailVerified: false,
};

const insertUser = async (users) => {
  const createdUser = await prisma.user.create({
    data: users,
  });
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = tokenService.generateToken(createdUser.id, accessTokenExpires, tokenTypes.ACCESS);
  createdUser.accessToken = accessToken;
  return createdUser;
};

module.exports = {
  userOne,
  userTwo,
  admin,
  insertUser,
  password,
};
