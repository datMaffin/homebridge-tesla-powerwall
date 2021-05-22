/**
 * Checks if an error is given and prints it and returns true.
 * Otherwise it just returns false.
 *
 * @param {string} error Error object returned by request.
 * @param {response} response Response object returned by request.
 * @param {string} body Body returned by request.
 * @param {boolean} cached Whether the response has been delivered from cache.
 */
module.exports = function(log, error, response, body, cached) {
    if (error || (response && response.statusCode >= 300)) {
        if (!cached) {
            log('error: ', error);
            log('status code: ', response && response.statusCode);
            log('body: ', body);
        }
        return true;
    }

    if (!cached) {
        log.debug('error: ', error);
        log.debug('status code: ', response && response.statusCode);
        log.debug('body: ', body);
    }

    return false;
};
