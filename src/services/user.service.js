const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

async function hashPassword(password) {
  const hashedPassword = await bcrypt.hash(password, 8);
  return hashedPassword;
}

async function isEmailTaken(email) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  return !!user; // Return true if a user with the email exists, false otherwise
}

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const hashedPassword = await hashPassword(userBody.password);

  return prisma.user.create({
    data: {
      name: userBody.name,
      email: userBody.email,
      password: hashedPassword,
      role: userBody.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isEmailVerified: true,
    },
  });
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await prisma.user.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isEmailVerified: true,
    },
  });
  return user;
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  return user;
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const updatedBody = { ...updateBody };

  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  if (updateBody.password) {
    updatedBody.password = await hashPassword(updateBody.password);
  }

  const updateUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: updatedBody,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isEmailVerified: true,
    },
  });
  return updateUser;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await prisma.token.deleteMany({
    where: {
      userId,
    },
  });
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
};
