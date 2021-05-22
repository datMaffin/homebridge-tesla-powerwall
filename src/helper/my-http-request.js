var request  = require('request');

var cache = {}

/**
 * Creates an insecure (ignores certificate warnings) GET request for the given url
 *
 * @param {string} url URL of the request.
 * @param {function} callback Callback method for handling the response.
 * @param {number} cacheInterval How long to cache the result for, or falsey to not cache
 */
module.exports = function(url, callback, cacheInterval) {
    if (cacheInterval) {
        var cached = cache[url];
        if (cached && (Date.now() - cacheInterval) < cached.whenCached) {
            // `setTimeout` is used here to call the callback in a non-blocking 
            // way.
            //
            // While there should be no reason why a blocking callback would 
            // not work here, calling callbacks in a non-blocking way *should*
            // have been prefered in this codebase.
            setTimeout(function() {
                callback(cached.error, cached.response, cached.body, true);
            }, 0);
            return;
        }
    }

    request(
        {
            url: url,
            method: 'GET',
            agentOptions: {rejectUnauthorized: false},
            jar: true
        },
        function(error, response, body) {
            if (cacheInterval) {
                cache[url] = {
                    whenCached: Date.now(),
                    error,
                    response,
                    body,
                };
            }

            callback(error, response, body, false);
        });
};
