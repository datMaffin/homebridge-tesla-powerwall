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
    if (error) {
        if (!cached) {
            log('Request failed:', error);
        }
        return true;
    }
    if (response && response.statusCode >= 300) {
        if (!cached) {
            try {
                var jsonBody = JSON.parse(body);
                if (jsonBody.message) {
                    log('Unexpected response:', response.statusCode, jsonBody.message);
                    return true;
                }
            } catch (jsonError) {

            }
            log('Unexpected response:', response.statusCode, body);
        }
        return true;
    }

    if (!cached) {
        log.debug('error:', error);
        log.debug('status code:', response && response.statusCode);
        log.debug('body:', body);
    }

    return false;
};
