var _httpGetRequest = require('./my-http-request.js');
var _checkRequestError = require('./check-for-request-error.js');
var _parseJSON = require('./my-parse-json.js');

module.exports = ValueGetter;

/**
 * Constructor for a value getter
 *
 * @param {function} log Function to log like: log(string) or log.debug(string)
 * @param {string} address The http adress 
 * @param {array of strings} attributes Where in the json
 * @param {number} defaultValue The default value when the source in not accessible
 * @param {function} manipulate The function to change incoming value into sth else
 */
function ValueGetter(log, address, attributes, defaultValue, manipulate) {
    this.log          = log;
    this.address      = address;
    this.attributes   = attributes; // array of strings
    this.defaultValue = defaultValue;

    if (!manipulate) {
        this.manipulate = function(id) {return id;};
    } else {
        this.manipulate = manipulate;
    }
}

ValueGetter.prototype = {

    /**
     * Request the value of the value getter
     *
     * @param {callback} callback The callback the value is given to
     * @param {number} cacheInterval How long to cache the result for, or falsey to not cache
     */
    requestValue: function(callback, cacheInterval) {
        this.log.debug('Requesting Value: ' + this.address);
        _httpGetRequest(
            this.address,
            function(error, response, body, cached) {
                var result;
                if (_checkRequestError(this.log, error, response, body, cached)) {
                    callback(error, this.manipulate(this.defaultValue));
                } else {
                    result = _parseJSON(body);
                    for (var att in this.attributes) {
                        if (result === undefined || result === null) {
                            this.log.debug('Error while parsing Attributes!');
                            this.log.debug('Attributes: ' + this.attributes);
                            callback(null, this.manipulate(this.defaultValue));
                            return;
                        }

                        result = result[this.attributes[att]];
                    }
                    callback(null, this.manipulate(result));
                }
            }.bind(this),
            cacheInterval);
    }
};
