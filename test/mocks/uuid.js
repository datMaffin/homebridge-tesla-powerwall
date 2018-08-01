/*eslint-disable*/
/*
 * From: https://github.com/planetk/homebridge-netatmo/blob/master/test/lib/uuid-mock.js
 */
var generate = function(s) {
  return s+s;
};

module.exports = {
  generate: generate
};
