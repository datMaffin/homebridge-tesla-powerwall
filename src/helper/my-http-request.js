var request  = require('request');

/**
 * Creates an insecure (ignores certificate warnings) GET request for the given url
 *
 * @param {string} url URL of the request.
 * @param {function} callback Callback method for handling the response.
 */
module.exports = function(url, callback) {
    request(
        {
            url: url,
            method: 'GET',
            agentOptions: {rejectUnauthorized: false},
            jar: true
        },
        function(error, response, body) {
            callback(error, response, body);
        });
};
