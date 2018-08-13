/**
 * Resets a characteristic of a service by using a getter callback with a 
 * specific delay
 *
 * @param {Service} service The service
 * @param {Characteristic} characterisitc The characteristic of the service to reset
 * @param {number} delay The delay when the reset takes place
 */
module.exports = function(service, characteristic, delay){
    if (!delay) {
        // default value without ECMAscript 6 features
        delay = 1000;
    }

    setTimeout(function() {
        service.getCharacteristic(characteristic).emit('get', function(error, newValue) {
            service
                .getCharacteristic(characteristic)
                .updateValue(newValue);
        });
    }, delay);
};
