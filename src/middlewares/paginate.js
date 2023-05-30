const httpStatus = require('http-status');
const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

// const paginate = (model) => async (req, res, next) => {
//     try {
//         const { page, limit, orderField, sortOrder, filterField, filterValue } = req.query;

//         const query = {
//             skip: (page - 1) * limit,
//             take: parseInt(limit),
//             orderBy: {
//                 [orderField]: sortOrder.toUpperCase() === 'DESC' ? 'desc' : 'asc',
//             },
//             select: {
//                 id: true,
//                 name: true,
//                 email: true,
//                 role: true,
//                 isEmailVerified: true,
//             },
//         };

//         if (filterField && filterValue) {
//             query.where = {
//                 [filterField]: {
//                     contains: filterValue,
//                 },
//             };
//         }

//         const data = await prisma[model].findMany(query);

//         if (filterField && filterValue) {
//             modelCount = data.length;
//         } else {
//             modelCount = await prisma[model].count();
//         }
//         const totalPages = Math.ceil(modelCount / limit);

//         req.pagination = {
//             page,
//             limit,
//             totalPages,
//             totalResults: modelCount,
//             data,
//         };

//         next();
//     } catch (error) {
//         return next(new ApiError(httpStatus.BAD_REQUEST, error));
//     }
// };

const paginate = (model) => async (req, res, next) => {
  try {
    let { page } = req.query;
    let { limit } = req.query;
    const { sortBy } = req.query;
    const { filterBy } = req.query;

    limit = limit && parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;
    page = page && parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const skip = (page - 1) * limit;

    const query = {
      skip,
      take: parseInt(limit),
      orderBy: {},
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
      },
    };

    if (sortBy) {
      const sortingCriteria = sortBy.split(',').map((sortOption) => {
        const [field, order] = sortOption.split(':');
        return { [field]: order === 'desc' ? 'desc' : 'asc' };
      });
      query.orderBy = sortingCriteria;
    } else {
      query.orderBy = { createdAt: 'asc' };
    }

    if (filterBy) {
      const filters = JSON.parse(filterBy);
      const filterConditions = Object.entries(filters).reduce((conditions, [field, value]) => {
        const modifiedConditions = { ...conditions };
        modifiedConditions[field] = { contains: value };
        return modifiedConditions;
      }, {});
      query.where = filterConditions;
    }

    const [results, modelCount] = await Promise.all([prisma[model].findMany(query), prisma[model].count()]);

    const totalPages = Math.ceil(modelCount / limit);

    req.pagination = {
      page,
      limit,
      totalPages,
      totalResults: filterBy ? results.length : modelCount,
      results,
    };

    next();
  } catch (error) {
    return next(new ApiError(httpStatus.BAD_REQUEST, error));
  }
};

module.exports = paginate;
