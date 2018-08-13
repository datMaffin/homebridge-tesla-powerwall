/**
 * Continuous updating of the given service and characteristic by updating the
 * value by emitting the 'get' event
 *
 * @param {Service} service Service to get and update the value
 * @param {Characteristic} characteristic Service to get and update the value
 * @param {number} pollTimer Interval of polling in milliseconds
 */
module.exports = function(service, characteristic, pollTimer) {
    if (!pollTimer) {
        // default value without ECMAscript 6 features
        pollTimer = 1000;
    }

    setInterval(function() {
        service.getCharacteristic(characteristic).emit('get', function(error, newValue) {
            service.getCharacteristic(characteristic).updateValue(newValue);
        });
    }, pollTimer);
};
