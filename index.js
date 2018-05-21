// _____         _             ____                                      _ _ 
//|_   _|__  ___| | __ _      |  _ \ _____      _____ _ ____      ____ _| | |
//  | |/ _ \/ __| |/ _` |_____| |_) / _ \ \ /\ / / _ \ '__\ \ /\ / / _` | | |
//  | |  __/\__ \ | (_| |_____|  __/ (_) \ V  V /  __/ |   \ V  V / (_| | | |
//  |_|\___||___/_|\__,_|     |_|   \___/ \_/\_/ \___|_|    \_/\_/ \__,_|_|_|
//
// A homebridge plugin
//
//
// TODO:
// - Replace Request with cached request
//

'use strict';

var Accessory, Characteristic, Service, UUIDGen;
var inherits = require('util').inherits;
var request  = require('request');
var moment   = require('moment');

// used for internationalization
var str;

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
    this.pollingInterval = config.pollingInterval || 1000 * 15;
    this.historyInterval = config.historyInterval || 1000 * 60 * 5;

    this.lowBattery      = config.lowBattery      || 20;

    str = new Strings(config.language || 'en');

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
            this.log, this.percentageUrl, ['percentage'], 0);
        var onStatusGetter = new ValueGetter(
            this.log, this.sitemasterUrl, ['running'], false);
        var chargingGetter = new ValueGetter(
            this.log, this.aggregateUrl, ['battery', 'instant_power'], 0);
        var powerwallConfig = {
            name:             'Powerwall',
            percentageGetter: percentageGetter,
            onStatusGetter:   onStatusGetter,
            chargingGetter:   chargingGetter,
            pollingInterval:  this.pollingInterval,
            historyInterval:  this.historyInterval,
            lowBattery:       this.lowBattery
        };
        accessories.push(new Powerwall(this.log, powerwallConfig));

        var solarGetter = new ValueGetter(
            this.log, this.aggregateUrl, ['solar', 'instant_power'], 0);
        var solarConfig = {
            name:            str.s('Solar'),
            pollingInterval: this.pollingInterval,
            historyInterval: this.historyInterval,
            wattGetter:      solarGetter,
        };
        accessories.push(new PowerMeter(this.log, solarConfig));

        var gridGetter = new ValueGetter(
            this.log, this.aggregateUrl, ['site', 'instant_power'], 0);
        var gridConfig = {
            name:            str.s('Grid'),
            pollingInterval: this.pollingInterval,
            historyInterval: this.historyInterval,
            wattGetter:      gridGetter,
        };
        accessories.push(new PowerMeter(this.log, gridConfig));

        var batteryGetter = new ValueGetter(
            this.log, this.aggregateUrl, ['battery', 'instant_power'], 0);
        var batteryConfig = {
            name:            str.s('Battery'),
            pollingInterval: this.pollingInterval,
            historyInterval: this.historyInterval,
            wattGetter:      batteryGetter,
        };
        accessories.push(new PowerMeter(this.log, batteryConfig));

        var homeGetter = new ValueGetter(
            this.log, this.aggregateUrl, ['load', 'instant_power'], 0);
        var homeConfig = {
            name:            str.s('Home'),
            pollingInterval: this.pollingInterval,
            historyInterval: this.historyInterval,
            wattGetter:      homeGetter,
        };
        accessories.push(new PowerMeter(this.log, homeConfig));

        callback(accessories);
    }
};


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Accessories
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//


// TODO:
// - History
// - Centralize Data conversion for polling and getting
// - Move everything to cache? (have to guarantee that update was
//   successfully executed
//
function Powerwall(log, config) {
    this.log = log;

    this.name             = config.name;
    this.pollingInterval  = config.pollingInterval;
    this.historyInterval  = config.historyInterval;
    this.lowBattery       = config.lowBattery;

    this.onStatusGetter   = config.onStatusGetter;
    this.percentageGetter = config.percentageGetter;
    this.chargingGetter   = config.chargingGetter;
}

Powerwall.prototype = {

    getServices: function() {
        // Create services
        var services = [];
        
        this.stateSwitch = new Service.Switch(this.name);
        this.stateSwitch
            .getCharacteristic(Characteristic.On)
            .on('get', this.getStateSwitch.bind(this))
            .on('set', this.setStateSwitch.bind(this));

        services.push(this.stateSwitch);

        this.battery = 
            new Service.BatteryService(this.name + ' ' + str.s('Battery'));
        this.battery
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this.getBatteryLevel.bind(this));
        this.battery
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', this.getChargingState.bind(this));
        this.battery
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getLowBattery.bind(this));
        services.push(this.battery);

        this.batteryVisualizer = 
            new Service.Lightbulb(this.name + ' ' + str.s('Charge'));
        this.batteryVisualizer
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOnBatteryVisualizer.bind(this))
            .on('set', this.setOnBatteryVisualizer.bind(this));
        this.batteryVisualizer
            .getCharacteristic(Characteristic.Hue)
            .on('get', this.getHueBatteryVisualizer.bind(this))
            .on('set', this.setHueBatteryVisualizer.bind(this));
        this.batteryVisualizer
            .getCharacteristic(Characteristic.Brightness)
            .on('get', this.getBrightnessBatteryVisualizer.bind(this))
            .on('set', this.setBrightnessBatteryVisualizer.bind(this));
        services.push(this.batteryVisualizer);


        //
        // Polling
        var onStatusLowPolling = new Polling(this.onStatusGetter, this.pollingInterval);
        onStatusLowPolling.pollValue(function(error, value) {
            this.log.debug('Callback on status cache');

            this.stateSwitch
                .getCharacteristic(Characteristic.On)
                .updateValue(value);
        }.bind(this));

        var percentagePolling = new Polling(this.percentageGetter, this.pollingInterval);
        percentagePolling.pollValue(function(error, value) {
            this.log.debug('Callback percentage cache');

            this.battery
                .getCharacteristic(Characteristic.BatteryLevel)
                .updateValue(value);
            this.battery
                .getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(value <= this.lowBattery);

            this.batteryVisualizer
                .getCharacteristic(Characteristic.On)
                .updateValue(value != 0);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Hue)
                .updateValue((value/100) * 120);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Brightness)
                .updateValue(value);
        }.bind(this));

        var chargingPolling = new Polling(this.chargingGetter, this.pollingInterval);
        chargingPolling.pollValue(function(error, value) {
            this.log.debug('Callback charging cache');

            this.battery
                .getCharacteristic(Characteristic.ChargingState)
                .updateValue(value < 0);
        }.bind(this));


        return services;
    },

    getStateSwitch: function(callback) {
        this.onStatusGetter.requestValue(callback);
    },

    setStateSwitch: function(state, callback) {
        callback();
        reset(
            this.stateSwitch, 
            Characteristic.On, 
            this.getStateSwitch.bind(this), 
            1000 * 4);
    },

    getBatteryLevel: function(callback) {
        this.percentageGetter.requestValue(callback);
    },

    getChargingState: function(callback) {
        this.chargingGetter.requestValue(function(error, value) {
            callback(error, value < 0);
        }.bind(this));
    },

    getLowBattery: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, value <= this.lowBattery);
        }.bind(this));
    },

    getOnBatteryVisualizer: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, value != 0);
        }.bind(this));
    },

    setOnBatteryVisualizer: function(state, callback) {
        callback();
        reset(
            this.batteryVisualizer, 
            Characteristic.On, 
            this.getOnBatteryVisualizer.bind(this));
    },
    getHueBatteryVisualizer: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, (value/100) * 120 );
        }.bind(this));
    },

    setHueBatteryVisualizer: function(state, callback) {
        callback();
        reset(
            this.batteryVisualizer, 
            Characteristic.Hue, 
            this.getHueBatteryVisualizer.bind(this));
    },
    getBrightnessBatteryVisualizer: function(callback) {
        this.percentageGetter.requestValue(callback);
    },

    setBrightnessBatteryVisualizer: function(state, callback) {
        callback();
        reset(
            this.batteryVisualizer, 
            Characteristic.Brightness, 
            this.getBrightnessBatteryVisualizer.bind(this));
    }
};

// PowerMeter
function PowerMeter(log, config) {
    this.log = log;

    this.name             = config.name;
    this.pollingInterval  = config.pollingInterval;
    this.historyInterval  = config.historyInterval;
    this.wattGetter       = config.wattGetter;
}

PowerMeter.prototype = {

    getServices: function() {
        var services = [];
        this.wattVisualizer = new Service.Fan(this.name + ' ' + str.s('Flow'));
        this.wattVisualizer
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOnWattVisualizer.bind(this))
            .on('set', this.setOnWattVisualizer.bind(this));
        this.wattVisualizer
            .getCharacteristic(Characteristic.RotationSpeed)
            .setProps({maxValue: 100, minValue: -100, minStep: 1})
            .on('get', this.getRotSpWattVisualizer.bind(this))
            .on('set', this.setRotSpWattVisualizer.bind(this));
        services.push(this.wattVisualizer);
        // Eve Powermeter
        //

        return services;
    },

    getOnWattVisualizer: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            callback(error, Math.round(value/100) != 0);
        });
    },

    setOnWattVisualizer: function(state, callback) {
        callback();
        reset(
            this.wattVisualizer, 
            Characteristic.On, 
            this.getOnWattVisualizer.bind(this));
    },

    getRotSpWattVisualizer: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            callback(error, value / 100); // 100 % = 10_000W
        });
    },

    setRotSpWattVisualizer: function(state, callback) {
        callback();
        reset(
            this.wattVisualizer, 
            Characteristic.RotationSpeed, 
            this.getRotSpWattVisualizer.bind(this));
    },
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Polling
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// TODO:
// - Documenting
// - Testing
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

    pollValue: function(callback) {
        this.pollCallback = callback;
    },

    update: function() {
        this.valueGetter.requestValue(function(error, newValue) {
            this.cache = newValue;
            this.pollCallback(error, newValue);
        }.bind(this));
    }
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
function ValueGetter(log, address, attributes, defaultValue) {
    this.log          = log;
    this.address      = address;
    this.attributes   = attributes; // array of strings
    this.defaultValue = defaultValue;
}

ValueGetter.prototype = {

    requestValue: function(callback) {
        _httpGetRequest(
            this.address,
            function(error, response, body) {
                var result;
                if (_checkRequestError(this.log, error, response, body)) {
                    callback(error, this.defaultValue);
                } else {
                    result = _parseJSON(body);
                    for (var att in this.attributes) {
                        result = result[this.attributes[att]];
                    }
                    if (result == undefined) {
                        callback(null, this.defaultValue);
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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Localization
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
function Strings(lang) {
    if (lang == 'de') {
        this.lang = 'de';
    } else {
        this.lang = 'en';
    }

    this.dict = {
        'Battery': {
            'en': 'Battery',
            'de': 'Batterie'
        },
        'Charge': {
            'en': 'Charge',
            'de': 'Ladezustand'
        },
        'Flow': {
            'en': 'Flow',
            'de': 'Fluss'
        }
    };
}

Strings.prototype.s = function(str) {

    return (this.dict[str] && this.dict[str][this.lang]) || str;
};

