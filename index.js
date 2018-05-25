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
// - Let User specify how many services
// - Let User specify how to save power meter history
//

'use strict';

var Characteristic, Service, FakeGatoHistoryService, FakeGatoHistorySetting;
var inherits = require('util').inherits;
var request  = require('request');
var moment   = require('moment');

// used for internationalization
var str;

module.exports = function(homebridge) {
    Service                = homebridge.hap.Service;
    Characteristic         = homebridge.hap.Characteristic;
    FakeGatoHistoryService = require('fakegato-history')(homebridge);
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
    this.startUrl      = address + '/api/sitemaster/run';

    // In milliseconds
    this.pollingInterval = config.pollingInterval || 1000 * 15;
    this.historyInterval = config.historyInterval || 1000 * 60 * 5;

    this.lowBattery      = config.lowBattery      || 20;

    // language
    str = new Strings(config.language || 'en');

    // history
    FakeGatoHistorySetting = config.historySetting;
    if (FakeGatoHistorySetting) {
        FakeGatoHistorySetting.disableTimer = true;
    }

    // services to load
    if (!config.additionalServices) {
        this.additionalServices = {
            powerwall: {
                homekitVisual: true,
                eveHistory: true
            },
            solar: {
                homekitVisual: true,
                evePowerMeter: true,
                eveHistory: true
            },
            grid: {
                homekitVisual: true,
                positiveEvePowerMeter: true,
                negativeEvePowerMeter: true,
                eveHistory: true
            },
            battery: {
                homekitVisual: true,
                positiveEvePowerMeter: true,
                negativeEvePowerMeter: true,
                eveHistory: true
            },
            home: {
                homekitVisual: true,
                evePowerMeter: true,
                eveHistory: true
            }
        };
    } else {
        this.additionalServices = config.additionalServices;
        if (!this.additionalServices.powerwall) {
            // there has to be always access to *.powerwall.*
            this.additionalServices.powerwall = {};
        }
    }


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

    Characteristic.AirPressure = function () {
        Characteristic.call(this, 'Air Pressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: 'mBar',
            maxValue: 1100,
            minValue: 700,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(Characteristic.AirPressure, Characteristic);

    // Load custom (Eve) Services
    Service.PowerMeterService = function(name, uuid, subtype) {
        if (!uuid) {
            uuid =  '00000001-0000-1777-8000-775D67EC4377';
        }
        Service.call(this, name, uuid, subtype);
        this.addCharacteristic(Characteristic.CurrentPowerConsumption);
        this.addCharacteristic(Characteristic.TotalConsumption);
        this.addCharacteristic(Characteristic.ResetTotal);
    };
    inherits(Service.PowerMeterService, Service);

    Service.WeatherService = function (displayName, subtype) {
        Service.call(this, displayName, 'E863F001-079E-48FF-8F27-9C2605A29F52', subtype);
        this.addCharacteristic(Characteristic.CurrentTemperature);
        this.addCharacteristic(Characteristic.CurrentRelativeHumidity);
        this.addCharacteristic(Characteristic.AirPressure);
        this.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -40,
                maxValue: 60
            });
    };
    inherits(Service.WeatherService, Service);
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
            displayName:      'Powerwall',
            percentageGetter: percentageGetter,
            onStatusGetter:   onStatusGetter,
            chargingGetter:   chargingGetter,
            pollingInterval:  this.pollingInterval,
            historyInterval:  this.historyInterval,
            lowBattery:       this.lowBattery,
            uniqueId:        '0_powerwall',
            additionalServices: this.additionalServices.powerwall,
            stopUrl:          this.stopUrl,
            startUrl:          this.startUrl
        };
        accessories.push(new Powerwall(this.log, powerwallConfig));

        if (this.additionalServices.solar) {

            var solarGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['solar', 'instant_power'], 0);
            var solarConfig = {
                displayName:     str.s('Solar'),
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      solarGetter,
                uniqueId:        '1_solar',
                additionalServices: {
                    homekitVisual: this.additionalServices.solar.homekitVisual,
                    evePowerMeter: this.additionalServices.solar.evePowerMeter,
                    eveHistory:    this.additionalServices.solar.eveHistory
                }
            };
            accessories.push(new PowerMeter(this.log, solarConfig));
        }

        if (this.additionalServices.grid) {
            var gridGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['site', 'instant_power'], 0);
            var gridConfig = {
                displayName:     str.s('Grid'),
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      gridGetter,
                uniqueId:        '2_grid',
                additionalServices: {
                    homekitVisual: this.additionalServices.grid.homekitVisual,
                    evePowerMeter: this.additionalServices.grid.positiveEvePowerMeter,
                    eveHistory:    this.additionalServices.grid.eveHistory
                }
            };
            accessories.push(new PowerMeter(this.log, gridConfig));

            if (this.additionalServices.grid.negativeEvePowerMeter) {
                var negGridGetter = new ValueGetter(
                    this.log, 
                    this.aggregateUrl, 
                    ['site', 'instant_power'], 
                    0, 
                    function(i) {return -i});
                var negGridConfig = {
                    displayName:     str.s('Grid Feed'),
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      negGridGetter,
                    uniqueId:        '2_neg_grid',
                    additionalServices: {
                        homekitVisual: false,
                        evePowerMeter: true,
                        eveHistory:    this.additionalServices.grid.eveHistory
                    }
                };
                accessories.push(new PowerMeter(this.log, negGridConfig));
            }
        }

        if (this.additionalServices.battery) {
            var batteryGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['battery', 'instant_power'], 0);
            var batteryConfig = {
                displayName:     str.s('Battery'),
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      batteryGetter,
                uniqueId:        '3_battery',
                additionalServices: {
                    homekitVisual: this.additionalServices.battery.homekitVisual,
                    evePowerMeter: this.additionalServices.battery.positiveEvePowerMeter,
                    eveHistory:    this.additionalServices.battery.eveHistory
                }
            };
            accessories.push(new PowerMeter(this.log, batteryConfig));

            if (this.additionalServices.battery.negativeEvePowerMeter) {
                var negBatteryGetter = new ValueGetter(
                    this.log, 
                    this.aggregateUrl, 
                    ['battery', 'instant_power'], 
                    0, 
                    function(i) {return -i});
                var negBatteryConfig = {
                    displayName:     str.s('Battery Charge'),
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      negBatteryGetter,
                    uniqueId:        '3_neg_battery',
                    additionalServices: {
                        homekitVisual: false,
                        evePowerMeter: true,
                        eveHistory:    this.additionalServices.battery.eveHistory
                    }
                };
                accessories.push(new PowerMeter(this.log, negBatteryConfig));
            }
        }

        if (this.additionalServices.home) {
            var homeGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['load', 'instant_power'], 0);
            var homeConfig = {
                displayName:     str.s('Home'),
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      homeGetter,
                uniqueId:        '4_home',
                additionalServices: {
                    homekitVisual: this.additionalServices.home.homekitVisual,
                    evePowerMeter: this.additionalServices.home.evePowerMeter,
                    eveHistory:    this.additionalServices.home.eveHistory
                }
            };
            accessories.push(new PowerMeter(this.log, homeConfig));
        }

        callback(accessories);
    }
};


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Accessories
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//


// TODO:
// - History
// - Centralize Data conversion for polling and getting
//
function Powerwall(log, config) {
    this.log = log;

    this.displayName      = config.displayName; // for fakegato
    this.name             = config.displayName; // for homebridge
    this.pollingInterval  = config.pollingInterval;
    this.historyInterval  = config.historyInterval;
    this.lowBattery       = config.lowBattery;
    this.uniqueId         = config.uniqueId;

    this.onStatusGetter   = config.onStatusGetter;
    this.percentageGetter = config.percentageGetter;
    this.chargingGetter   = config.chargingGetter;

    this.additionalServices = config.additionalServices;

    this.stopUrl = config.stopUrl;
    this.startUrl = config.startUrl;
}

Powerwall.prototype = {

    getServices: function() {
        // Create services
        var services = [];

        var info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tesla')
            .setCharacteristic(Characteristic.Model, str.s('Powerwall2'))
            .setCharacteristic(Characteristic.FirmwareRevision, '-')
            .setCharacteristic(Characteristic.SerialNumber, this.uniqueId);
        services.push(info);
        
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

        if (this.additionalServices.homekitVisual) {
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
        }

        if (this.additionalServices.eveHistory) {

            // Eve Weather abused for battery charge history
            this.batteryCharge = new Service.WeatherService(
                this.name + ' ' + str.s('Battery') + ' History');
            this.batteryCharge.getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({
                    minValue: 0,
                    maxValue: 100
                });
            services.push(this.batteryCharge);

            this.batteryChargeHistory = 
                new FakeGatoHistoryService('weather', this, FakeGatoHistorySetting);
            services.push(this.batteryChargeHistory);
        }

        //
        // Polling
        var onStatusLowPolling = new Polling(this.onStatusGetter, this.pollingInterval);
        onStatusLowPolling.pollValue(function(error, value) {
            this.stateSwitch
                .getCharacteristic(Characteristic.On)
                .updateValue(value);
        }.bind(this));

        var percentagePolling = new Polling(this.percentageGetter, this.pollingInterval);
        percentagePolling.pollValue(function(error, value) {
            this.battery
                .getCharacteristic(Characteristic.BatteryLevel)
                .updateValue(value);
            this.battery
                .getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(value <= this.lowBattery);

            if (this.additionalServices.homekitVisual) {
                this.batteryVisualizer
                    .getCharacteristic(Characteristic.On)
                    .updateValue(value != 0);
                this.batteryVisualizer
                    .getCharacteristic(Characteristic.Hue)
                    .updateValue((value/100) * 120);
                this.batteryVisualizer
                    .getCharacteristic(Characteristic.Brightness)
                    .updateValue(value);
            }

            if (this.additionalServices.eveHistory) {
                this.batteryCharge
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(value);
                this.batteryCharge
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(value);
            }
        }.bind(this));

        var chargingPolling = new Polling(this.chargingGetter, this.pollingInterval);
        chargingPolling.pollValue(function(error, value) {
            this.battery
                .getCharacteristic(Characteristic.ChargingState)
                .updateValue(value < 0);
        }.bind(this));

        // history
        if (this.additionalServices.eveHistory) {
            var percentageHistory = new Polling(this.percentageGetter, this.historyInterval);
            percentageHistory.pollValue(function(error, value) {
                this.log("history");
                this.batteryChargeHistory.addEntry(
                    {time: moment().unix(), humidity: value});
            }.bind(this));
        }

        return services;
    },

    getStateSwitch: function(callback) {
        this.onStatusGetter.requestValue(callback);
    },

    setStateSwitch: function(state, callback) {
        var url;

        if (state) {
            url = this.startUrl;
        } else {
            url = this.stopUrl;
        }

        _httpGetRequest(url, function(error, response, body) {
            _checkRequestError(this.log, error, response, body);
            callback(error);
        }.bind(this));

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
//
// TODO:
// - Let User specify AccessoryInformation
//
function PowerMeter(log, config) {
    this.log = log;

    this.displayName      = config.displayName; // for fakegato
    this.name             = config.displayName; // for homebridge
    this.uniqueId         = config.uniqueId;
    this.pollingInterval  = config.pollingInterval;
    this.historyInterval  = config.historyInterval;
    this.wattGetter       = config.wattGetter;

    this.additionalServices = config.additionalServices;
}

PowerMeter.prototype = {

    getServices: function() {
        var services = [];
        var info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tesla')
            .setCharacteristic(Characteristic.Model, str.s('Power Meter'))
            .setCharacteristic(Characteristic.FirmwareRevision, '-')
            .setCharacteristic(Characteristic.SerialNumber, this.uniqueId);
        services.push(info);

        if (this.additionalServices.homekitVisual) {
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
        }

        // Eve Powermeter
        
        if (this.additionalServices.evePowerMeter) {
            this.powerConsumption = new Service.PowerMeterService(
                this.name + ' ' + 
                str.s('Power Meter'));
            services.push(this.powerConsumption);
        }

        if (this.additionalServices.evePowerMeter &&
            this.additionalServices.eveHistory) {
            this.powerMeterHistory = 
                new FakeGatoHistoryService('energy', this, FakeGatoHistorySetting);
            services.push(this.powerMeterHistory);
        }

        // Polling
        var wattPolling = new Polling(this.wattGetter, this.pollingInterval);
        wattPolling.pollValue(function(error, value) {
            if (this.additionalServices.homekitVisual) {
                this.wattVisualizer
                    .getCharacteristic(Characteristic.On)
                    .updateValue(Math.round(value / 100) != 0);
                this.wattVisualizer
                    .getCharacteristic(Characteristic.RotationSpeed)
                    .updateValue(value / 100);
            }

            if (this.additionalServices.evePowerMeter) {
                this.powerConsumption
                    .getCharacteristic(Characteristic.CurrentPowerConsumption)
                    .updateValue(value);
            }
        }.bind(this));

        // History
        if (this.additionalServices.evePowerMeter &&
            this.additionalServices.eveHistory) {
            var wattHistory = new Polling(this.wattGetter, this.historyInterval);
            wattHistory.pollValue(function(error, value) {
                // set negative values to 0
                if (value < 0) {
                    value = 0;
                }
                this.log.debug('Watt History value: ' + value);
                this.powerMeterHistory.addEntry(
                    {time: moment().unix(), power: value});
            }.bind(this));
        }

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
function ValueGetter(log, address, attributes, defaultValue, manipulate) {
    this.log          = log;
    this.address      = address;
    this.attributes   = attributes; // array of strings
    this.defaultValue = defaultValue;

    if (!manipulate) {
        this.manipulate = function(id) {return id};
    } else {
        this.manipulate = manipulate;
    }
}

ValueGetter.prototype = {

    requestValue: function(callback) {
        _httpGetRequest(
            this.address,
            function(error, response, body) {
                var result;
                if (_checkRequestError(this.log, error, response, body)) {
                    callback(error, this.manipulate(this.defaultValue));
                } else {
                    result = _parseJSON(body);
                    for (var att in this.attributes) {
                        if (result == undefined || result == null) {
                            this.log.debug('Error while parsing Attributes!');
                            this.log.debug('Attributes: ' + this.attributes);
                            callback(null, this.manipulate(this.defaultValue));
                            return;
                        }

                        result = result[this.attributes[att]];
                    }
                    callback(null, this.manipulate(result));
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
        /*
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
        */
    };
}

Strings.prototype.s = function(str) {

    return (this.dict[str] && this.dict[str][this.lang]) || str;
};
