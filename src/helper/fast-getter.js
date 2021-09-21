/**
 * Returns a wrapper function that can be added directly to a characteristic that
 * will ensure that the plugin responds quickly to get requests.
 * @param {function} actualGetter 
 * @param {} log 
 * @returns 
 */
module.exports = function createFastGetter(actualGetter, log) {
    let lastValue = null;

    return function(callback) {
        const characteristic = this;

        let timeoutResponded = false;

        /* Respond with a cached value if the actual getter doesn't respond quickly */
        const timeout = setTimeout(function() {
            timeoutResponded = true;
            if (lastValue) {
                log.debug(`${characteristic.displayName}: timeout returning last result: ${lastValue.error} ${lastValue.result}`);
                callback(lastValue.error, lastValue.result);
            } else {
                log.debug(`${characteristic.displayName}: timeout returning no result`);
                callback(new Error('Device slow to respond'), null);
            }
        }, 500);

        actualGetter(function(error, result) {
            lastValue = { error, result };

            if (!timeoutResponded) {
                clearTimeout(timeout);
                log.debug(`${characteristic.displayName}: returning actual result ${error} ${result}`);
                callback(error, result);
            } else if (error) {
                log.debug(`${characteristic.displayName}: updating characteristic with error for late result: ${error}`);
                characteristic.updateValue(error);
            } else {
                log.debug(`${characteristic.displayName}: updating characteristic with late result: ${result}`);
                characteristic.updateValue(result);
            }
        })
    }
};
