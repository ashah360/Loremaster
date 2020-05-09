const request = require('request-promise');

const agent = request.defaults({
  simple: false,
});

module.exports = agent;
