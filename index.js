'use strict';

var Accessory, Characteristic, Service, UUIDGen;
var inherits = require('util').inherits;
var request  = require('request');
var moment   = require('moment');
var Promise  = require('promise');

module.exports = function(homebridge) {
    Service        = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory      = homebridge.patformAccessory;
    UUIDGen        = homebridge.hap.uuid;
    homebridge.registerPlatform(
        'homebridge-tesla-powerwall', 'TeslaPowerwall', TeslaPowerwall);
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Platform
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function TeslaPowerwall(log, config) {
    this.log = log;

    if (!this.log.debug) {
        this.log.debug = function(){};
    }

    //-----------------------------------------------------------------------//
    // Load configs
    //-----------------------------------------------------------------------//
    this.name = config.name;

    var ip      = config.ip || '127.0.0.1';
    var port    = config.port || '80';
    var address = 'http://' + ip + ':' + port;

    this.percentageUrl = address + '/api/system_status/soe';
    this.aggregateUrl  = address + '/api/meters/aggregates';
    this.sitemasterUrl = address + '/api/sitemaster';
    this.stopUrl       = address + '/api/sitemaster/stop';
    this.startUrl      = address + '/api/sitemaster/start';

    // In milliseconds
    this.pollingIntervall = config.pollingIntervall || 1000 * 15;
    this.historyIntervall = config.historyIntervall || 1000 * 60 * 5;

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

        // Powerwall:
        var percentageGetter = new ValueGetter(
            this.log, this.percentageUrl, 'percentage', 0);
        var statusGetter = new ValueGetter(
            this.log, this.sitemasterUrl, 'running', false);
        var powerwallConfig = {
            name:             'Powerwall',
            percentageGetter: percentageGetter,
            statusGetter:     statusGetter,
            pollingIntervall: this.pollingIntervall,
            historyIntervall: this.historyIntervall
        };
        accessories.push(new Powerwall(this.log, powerwallConfig));

        // TODO:
        // - Solar Powermeter
        // - Grid Powermeter
        // - Battery Powermeter
        // - Home Powermeter

        callback(accessories);
    }
};


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Accessories
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Powerwall
function Powerwall(log, config) {
    this.log = log;

    this.name             = config.name;
    this.statusGetter     = config.statusGetter;
    this.percentageGetter = config.percentageGetter;

    this.pollingIntervall = this.pollingIntervall;
}

Powerwall.prototype = {

    getServices: function() {
        var services = [];

        this.stateSwitch = new Service.Switch(this.name);
        this.stateSwitch
            .getCharacteristic(Characteristic.On)
            .on('get', this.getStateSwitch.bind(this))
            .on('set', this.setStateSwitch.bind(this));

        services.push(this.stateSwitch);

        this.battery = new Service.BatteryService(this.name + 'Battery');
        this.battery
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this.getBattery.bind(this));
        this.battery
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', this.getChargingBattery.bind(this));
        this.battery
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getLowBattery.bind(this));


        // TODO:
        // - Polling
        // - History

        return services;
    },

    getStateSwitch: function(callback) {
        this.statusGetter.requestValue(callback);
    },

    setStateSwitch: function(state, callback) {
        callback();
        reset(
            this.stateSwitch, 
            Characteristic.On, 
            this.getStateSwitch.bind(this), 
            1000 * 4);
    },

    getBattery: function(callback) {
    },

    getChargingBattery: function(callback) {
    },

    getLowBattery: function(callback) {
    }
};

// PowerMeter
function PowerMeter(log, config) {
    this.log         = log;
    this.valueGetter = config.valueGetter;
}

PowerMeter.prototype = {

    getServices: function() {
    }
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Cache
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// TODO:
// - Documenting
// - Testing
function Cache(valueGetter, pollTimer) {
    if (!pollTimer) {
        // default value without ECMAscript 6 features
        pollTimer = 1000;
    }

    this.nextUpdate  = moment().unix();
    this.cache       = 0;
    this.error       = null;
    this.valueGetter = valueGetter;

    this.waiting = [];

    // TODO: guarantee that update was successful
    this.update(); 

    // start polling:
    setInterval(this.update, pollTimer);
}

Cache.prototype = {

    getValue: function() {
        return this.cache;
    },

    getValueCallback: function(callback) {
        callback(this.error, this.cache);
    },

    pollValue: function(callback) {
        this.waiting.push(callback);
    },

    update: function() {
        var correctCachePromise = new Promise(function(resolve, reject) {
            this.valueGetter.requestValue(function(error, newValue) {
                this.cache = newValue;
                if (!error) {
                    resolve(null);
                } else {
                    reject(error);
                }
            }.bind(this));
        }.bind(this));

        correctCachePromise
            .then(function() {
                for(var callback in this.waiting) {
                    this.error = null;
                    callback(null, this.cache);
                }
            }.bind(this))
            .catch(function(error) {
                for(var callback in this.waiting) {
                    this.error = error;
                    callback(this.error, this.cache);
                }
            });
    },
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Value Resetter
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

/**
 * Resets a characteristic of a service by using a getter callback with a 
 * specific delay
 */
var reset = function(service, characteristic, getterByCallback, delay){
    if (!delay) {
        // default value without ECMAscript 6 features
        delay = 1000;
    }

    setTimeout(function() {
        getterByCallback(function(error, newValue) {
            service
                .getCharacteristic(characteristic)
                .updateValue(newValue);
        });
    }, delay);
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
                if (_checkRequestError(this.log, error, response, body)) {
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

    log.debug('error: ', error);
    log.debug('status code: ', response && response.statusCode);
    log.debug('body: ', body);

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

