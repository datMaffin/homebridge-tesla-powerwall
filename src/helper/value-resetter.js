/**
 * Resets a characteristic of a service by using a getter callback with a 
 * specific delay
 *
 * @param {Service} service The service
 * @param {Characteristic} characterisitc The characteristic of the service to reset
 * @param {Callback} getterByCallback Callback with value to reset characteristic to
 * @param {number} delay The delay when the reset takes place
 */
module.exports = function(service, characteristic, getterByCallback, delay){
    if (!delay) {
        // default value without ECMAscript 6 features
        delay = 1000;
    }

    setTimeout(
        function() {
            getterByCallback(function(error, newValue) {
                service
                    .getCharacteristic(characteristic)
                    .updateValue(newValue);
            });
        }, delay);
};
