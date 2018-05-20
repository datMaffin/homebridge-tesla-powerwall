'use strict';

var Accessory, Characteristic, Service, UUIDGen;
var inherits = require('util').inherits;
var request = require('request');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.patformAccessory;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform(
        'homebridge-tesla-powerwall', 'TeslaPowerwall', TeslaPowerwall);
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Platform
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function TeslaPowerwall(log, config) {
    this.log = log;

    //-----------------------------------------------------------------------//
    // Load configs
    //-----------------------------------------------------------------------//
    var ip = config.ip || '127.0.0.1';
    var address = 'http://' + ip + ':80';
    this.percentageUrl = address + '/api/system_status/soe';
    this.aggregateUrl  = address + '/api/meters/aggregates';
    this.sitemasterUrl = address + '/api/sitemaster';
    this.stopUrl       = address + '/api/sitemaster/stop';
    this.startUrl      = address + '/api/sitemaster/start';

    // In milliseconds
    this.updateIntervall  = config.updateIntervall || 1000 * 15;
    this.historyIntervall = config.histeroyIntervall || 1000 * 60 * 5;

    //-----------------------------------------------------------------------//
    // Setup Eve Characteristics and Services
    //-----------------------------------------------------------------------//
    // https://github.com/simont77/fakegato-history
    
    // Load custom (Eve) Characteristics
    Characteristic.CurrentPowerConsumption = function() {
        Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: 'Watts',
            maxValue: 100000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    Characteristic.CurrentPowerConsumption.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
    inherits(Characteristic.CurrentPowerConsumption, Characteristic);

    Characteristic.TotalConsumption = function() {
        Characteristic.call(this, 'Energy', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: 'kWh',
            maxValue: 100000000000,
            minValue: 0,
            minStep: 0.001,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    Characteristic.TotalConsumption.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
    inherits(Characteristic.TotalConsumption, Characteristic);

    Characteristic.ResetTotal = function() {
        Characteristic.call(this, 'Reset', 'E863F112-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT32,
            perms: [
                Characteristic.Perms.READ, 
                Characteristic.Perms.NOTIFY, 
                Characteristic.Perms.WRITE]
        });
        this.value = this.getDefaultValue();
    };
    Characteristic.ResetTotal.UUID = 'E863F112-079E-48FF-8F27-9C2605A29F52';
    inherits(Characteristic.ResetTotal, Characteristic);

    // Load custom (Eve) Services
    Service.PowerMeterService = function(displayName, uuid, subtype) {
        if (!uuid) {
            uuid =  '00000001-0000-1777-8000-775D67EC4377';
        }
        Service.call(this, displayName, uuid, subtype);
        this.addCharacteristic(Characteristic.CurrentPowerConsumption);
        this.addCharacteristic(Characteristic.TotalConsumption);
        this.addCharacteristic(Characteristic.ResetTotal);
    };
    inherits(Service.PowerMeterService, Service);
}

TeslaPowerwall.prototype = {

    identify: function(callback) {
        this.log('Identify requested!');
        callback();
    },

    accessories: function(callback) {
        var accessories = [];

        callback(accessories);
    }
};


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Accessories
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Powerwall
function Powerwall(log, config) {
    this.log = log;
}

Powerwall.prototype = {

    getServices: function() {
    }
};

// PowerMeter
function PowerMeter(log, config) {
    this.log = log;
}

PowerMeter.prototype = {

    getServices: function() {
    }
};


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Value Getter
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// TODO:
// - Documenting
// - Testing
function ValueGetter(log, address, attribute, defaultValue) {
    this.log = log;
    this.address   = address;
    this.attribute = attribute;
    this.defaultValue   = defaultValue;
}

ValueGetter.prototype = {

    requestValue: function(callback) {
        _httpGetRequest(
            this.address,
            function(error, response, body) {
                var result;
                if (_checkRequestError(error, response, body)) {
                    callback(error, this.defaultValue);
                } else if ((typeof this.address) == 'string') {
                    var resultJSON = _parseJSON(body);
                    result = _notTrueToDefault(
                        resultJSON &&
                        resultJSON[this.attribute],
                        this.defaultValue);
                    callback(null, result);
                } else {
                    // this.attribute should be a array of strings
                    result = _parseJSON(body);
                    for (var att in this.attributes) {
                        result = result[att];
                    }
                    callback(null, result);
                }
            }.bind(this));
    }
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Utility Functions
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

/**
 * Creates a GET request for the given url
 *
 * @param {string} url URL of the request.
 * @param {function} callback Callback method for handling the response.
 */
var _httpGetRequest = function(url, callback) {
    request({
        url: url,
        method: 'GET'
    },
    function(error, response, body) {
        callback(error, response, body);
    });
};

/**
 * Checks if an error is given and prints it and returns true.
 * Otherwise it just returns false.
 *
 * @param {string} error Error object returned by request.
 * @param {response} response Response object returned by request.
 * @param {string} body Body returned by request.
 */
var _checkRequestError = function(log, error, response, body) {
    if (error) {
        log('error: ', error);
        log('status code: ', response && response.statusCode);
        log('body: ', body);
        return true;
    }
    return false;
};

/**
 * Parse JSON string into an object
 *
 * @param {string} str String in JSON form.
 */
var _parseJSON = function(str) {
    var obj = null;
    try {
        obj =  JSON.parse(str);
    } catch(e) {
        obj = null;
    }
    return obj;
};

/**
 * Returns value of stmt if it evaluates to something that is true,
 * otherwise 0
 *
 * @param {statement} stmt Statemt that gets evaluated.
 */
var _notTrueToDefault = function(stmt, defaultValue) {
    if (stmt) {
        return stmt;
    }
    return defaultValue;
};

