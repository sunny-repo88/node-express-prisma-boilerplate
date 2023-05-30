const Joi = require('joi');

const pagination = {
  query: Joi.object().keys({
    limit: Joi.number(),
    page: Joi.number(),
    sortBy: Joi.string(),
    filterBy: Joi.any(),
  }),
};

module.exports = {
  pagination,
};
