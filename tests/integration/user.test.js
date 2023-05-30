const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../src/app');
const { setupTestDB, prisma } = require('../utils/setupTestDB');
const { userOne, userTwo, admin, insertUser } = require('../fixtures/user.fixture');

setupTestDB();

describe('User routes', () => {
  describe('POST /v1/users', () => {
    let newUser;

    beforeEach(() => {
      newUser = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user',
      };
    });

    test('should return 201 and successfully create new user if data is ok', async () => {
      const _admin = await insertUser(admin);
      const res = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.CREATED);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: expect.anything(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isEmailVerified: false,
      });

      const dbUser = await prisma.user.findUnique({
        where: {
          id: res.body.id,
        },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser.password).not.toBe(newUser.password);
      expect(dbUser).toMatchObject({ name: newUser.name, email: newUser.email, role: newUser.role, isEmailVerified: false });
    });

    test('should be able to create an admin as well', async () => {
      const _admin = await insertUser(admin);
      newUser.role = 'admin';

      const res = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.CREATED);

      expect(res.body.role).toBe('admin');

      const dbUser = await prisma.user.findUnique({
        where: {
          id: res.body.id,
        },
      });
      expect(dbUser.role).toBe('admin');
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app).post('/v1/users').send(newUser).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if logged in user is not admin', async () => {
      const _userOne = await insertUser(userOne);

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(newUser)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 error if email is invalid', async () => {
      const _admin = await insertUser(admin);
      newUser.email = 'invalidEmail';

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);

      newUser.email = _userOne.email;

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      const _admin = await insertUser(admin);
      newUser.password = 'passwo1';

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      const _admin = await insertUser(admin);
      newUser.password = 'password';

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);

      newUser.password = '1111111';

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if role is neither user nor admin', async () => {
      const _admin = await insertUser(admin);
      newUser.role = 'invalid';

      await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(newUser)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/users', () => {
    test('should return 200 and apply the default query options', async () => {
      const _userOne = await insertUser(userOne);
      await insertUser(userTwo);
      const _admin = await insertUser(admin);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({})
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0]).toEqual({
        id: _userOne.id,
        name: _userOne.name,
        email: _userOne.email,
        role: _userOne.role,
        isEmailVerified: _userOne.isEmailVerified,
      });
    });

    test('should return 401 if access token is missing', async () => {
      await insertUser(admin);
      await insertUser(userOne);
      await insertUser(userTwo);

      await request(app).get('/v1/users').send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if a non-admin is trying to access all users', async () => {
      await insertUser(admin);
      const _userOne = await insertUser(userOne);
      await insertUser(userTwo);

      await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should correctly apply filter on name field', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);
      await insertUser(userTwo);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ filterBy: JSON.stringify({ name: _userOne.name }) })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 1,
      });
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(_userOne.id);
    });

    test('should correctly apply filter on role field', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ filterBy: JSON.stringify({ role: 'user' }) })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 2,
      });
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].id).toBe(_userOne.id);
      expect(res.body.results[1].id).toBe(_userTwo.id);
    });

    test('should correctly sort the returned array if descending sort param is specified', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ sortBy: 'role:desc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0].id).toBe(_userOne.id);
      expect(res.body.results[1].id).toBe(_userTwo.id);
      expect(res.body.results[2].id).toBe(_admin.id);
    });

    test('should correctly sort the returned array if ascending sort param is specified', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ sortBy: 'role:asc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0].id).toBe(_admin.id);
      expect(res.body.results[1].id).toBe(_userOne.id);
      expect(res.body.results[2].id).toBe(_userTwo.id);
    });

    test('should correctly sort the returned array if multiple sorting criteria are specified', async () => {
      const _admin = await insertUser(admin);
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ sortBy: 'role:desc,name:asc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);

      const expectedOrder = [_userOne, _userTwo, _admin].sort((a, b) => {
        if (a.role < b.role) {
          return 1;
        }
        if (a.role > b.role) {
          return -1;
        }
        return a.name < b.name ? -1 : 1;
      });

      expectedOrder.forEach((user, index) => {
        expect(res.body.results[index].id).toBe(user.id);
      });
    });

    test('should limit returned array if limit param is specified', async () => {
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);
      const _admin = await insertUser(admin);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ limit: 2 })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 2,
        totalPages: 2,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].id).toBe(_userOne.id);
      expect(res.body.results[1].id).toBe(_userTwo.id);
    });

    test('should return the correct page if page and limit params are specified', async () => {
      await insertUser(userOne);
      await insertUser(userTwo);
      const _admin = await insertUser(admin);

      const res = await request(app)
        .get('/v1/users')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .query({ page: 2, limit: 2 })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 2,
        limit: 2,
        totalPages: 2,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(_admin.id);
    });
  });

  describe('GET /v1/users/:userId', () => {
    test('should return 200 and the user object if data is ok', async () => {
      const _userOne = await insertUser(userOne);

      const res = await request(app)
        .get(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: _userOne.id,
        email: _userOne.email,
        name: _userOne.name,
        role: _userOne.role,
        isEmailVerified: _userOne.isEmailVerified,
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await insertUser(userOne);

      await request(app).get(`/v1/users/${userOne.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is trying to get another user', async () => {
      const _userOne = await insertUser(userOne);
      await insertUser(userTwo);

      await request(app)
        .get(`/v1/users/${userTwo.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and the user object if admin is trying to get another user', async () => {
      const _userOne = await insertUser(userOne);
      const _admin = await insertUser(admin);

      await request(app)
        .get(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.OK);
    });

    test('should return 400 error if userId is not a valid mongo id', async () => {
      const _admin = await insertUser(admin);

      await request(app)
        .get('/v1/users/invalidId')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if user is not found', async () => {
      const _admin = await insertUser(admin);

      await request(app)
        .get(`/v1/users/-1`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /v1/users/:userId', () => {
    test('should return 204 if data is ok', async () => {
      const _userOne = await insertUser(userOne);

      await request(app)
        .delete(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbUser = await prisma.user.findUnique({
        where: {
          id: _userOne.id,
        },
      });
      expect(dbUser).toBeNull();
    });

    test('should return 401 error if access token is missing', async () => {
      const _userOne = await insertUser(userOne);

      await request(app).delete(`/v1/users/${_userOne.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is trying to delete another user', async () => {
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);
      await request(app)
        .delete(`/v1/users/${_userTwo.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 204 if admin is trying to delete another user', async () => {
      const _userOne = await insertUser(userOne);
      const _admin = await insertUser(admin);
      await request(app)
        .delete(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });

    test('should return 400 error if userId is not a valid mongo id', async () => {
      const _admin = await insertUser(admin);

      await request(app)
        .delete('/v1/users/invalidId')
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if user already is not found', async () => {
      const _admin = await insertUser(admin);

      await request(app)
        .delete(`/v1/users/-1`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /v1/users/:userId', () => {
    test('should return 200 and successfully update user if data is ok', async () => {
      const _userOne = await insertUser(userOne);
      const updateBody = {
        name: faker.name.findName(),
        password: 'newPassword1',
      };

      const res = await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: _userOne.id,
        email: _userOne.email,
        name: updateBody.name,
        role: 'user',
        isEmailVerified: false,
      });

      const dbUser = await prisma.user.findUnique({
        where: {
          id: _userOne.id,
        },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser.password).not.toBe(updateBody.password);
      expect(dbUser).toMatchObject({ name: updateBody.name, role: 'user' });
    });

    test('should return 401 error if access token is missing', async () => {
      const _userOne = await insertUser(userOne);
      const updateBody = { name: faker.name.findName() };

      await request(app).patch(`/v1/users/${_userOne.id}`).send(updateBody).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if user is updating another user', async () => {
      const _userOne = await insertUser(userOne);
      const _userTwo = await insertUser(userTwo);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/users/${_userTwo.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and successfully update user if admin is updating another user', async () => {
      const _userOne = await insertUser(userOne);
      const _admin = await insertUser(admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);
    });

    test('should return 404 if admin is updating another user that is not found', async () => {
      const _admin = await insertUser(admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/users/-1`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if userId is not a valid mongo id', async () => {
      const _admin = await insertUser(admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/users/invalidId`)
        .set('Authorization', `Bearer ${_admin.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is invalid', async () => {
      const _userOne = await insertUser(userOne);
      const updateBody = { email: 'invalidEmail' };

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is already taken', async () => {
      const _userOne = await insertUser(userOne);
      await insertUser(userTwo);
      const updateBody = { email: userTwo.email };

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if password length is less than 8 characters', async () => {
      const _userOne = await insertUser(userOne);
      const updateBody = { password: 'passwo1' };

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if password does not contain both letters and numbers', async () => {
      const _userOne = await insertUser(userOne);
      const updateBody = { password: 'password' };

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);

      updateBody.password = '11111111';

      await request(app)
        .patch(`/v1/users/${_userOne.id}`)
        .set('Authorization', `Bearer ${_userOne.accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
