var moment   = require('moment');

module.exports = Polling;

/**
 * Constructor for polling
 *
 * @param {ValueGetter} valueGetter The value getter to poll from
 * @param {number} pollTimer Interval of polling in milliseconds
 */
function Polling(valueGetter, pollTimer) {
    if (!pollTimer) {
        // default value without ECMAscript 6 features
        pollTimer = 1000;
    }

    this.nextUpdate  = moment().unix();
    this.cache       = 0;
    this.error       = null;
    this.valueGetter = valueGetter;

    this.waiting = [];

    this.pollCallback = function(){};

    this.update(); 

    // start polling:
    setInterval(this.update.bind(this), pollTimer);
}

Polling.prototype = {

    /**
     * List a callback that gets called at every poll
     *
     * @param {callback} callback Callback that gets called
     */
    pollValue: function(callback) {
        this.pollCallback = callback;
    },

    /**
     * For internal use!
     *
     * Update function that gets called in every interval
     */
    update: function() {
        this.valueGetter.requestValue(function(error, newValue) {
            this.cache = newValue;
            this.pollCallback(error, newValue);
        }.bind(this));
    }
};
