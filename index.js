// _____         _             ____                                      _ _ 
//|_   _|__  ___| | __ _      |  _ \ _____      _____ _ ____      ____ _| | |
//  | |/ _ \/ __| |/ _` |_____| |_) / _ \ \ /\ / / _ \ '__\ \ /\ / / _` | | |
//  | |  __/\__ \ | (_| |_____|  __/ (_) \ V  V /  __/ |   \ V  V / (_| | | |
//  |_|\___||___/_|\__,_|     |_|   \___/ \_/\_/ \___|_|    \_/\_/ \__,_|_|_|
//
// A homebridge plugin
//

'use strict';

var Characteristic, Service, FakeGatoHistoryService, FakeGatoHistorySetting;
var inherits = require('util').inherits;

var ValueGetter = require('./src/helper/value-getter.js');
var Powerwall, PowerMeter, PowerMeterLineGraph, GridStatus;

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
    this.name = config.name || 'Tesla Powerwall';

    var ip      = config.ip || '127.0.0.1';
    var port    = config.port || '';
    var address;
    if (port !== '') {
        address = 'http://' + ip + ':' + port;
    } else {
        address = 'http://' + ip;
    }


    this.percentageUrl = address + '/api/system_status/soe';
    this.aggregateUrl  = address + '/api/meters/aggregates';
    this.sitemasterUrl = address + '/api/sitemaster';
    this.gridstatusUrl = address + '/api/system_status/grid_status';

    // starting and stopping only works on tesla powerwalls with 
    // software version < 1.20
    this.stopUrl  = address + '/api/sitemaster/stop';
    this.startUrl = address + '/api/sitemaster/run';

    // In milliseconds
    this.pollingInterval = config.pollingInterval || 1000 * 15;
    this.historyInterval = config.historyInterval || 1000 * 60 * 5;

    this.lowBattery      = config.lowBattery      || 20;

    // history
    FakeGatoHistorySetting = config.historySetting;
    if (FakeGatoHistorySetting) {
        FakeGatoHistorySetting.disableTimer = true;
    }

    // additional services to load
    this.additionalServices = {
        powerwall: {
            homekitVisual: 
                defaultValue(config, ['additionalServices', 'powerwall', 'homekitVisual'], true),
            eveHistory: 
                defaultValue(config, ['additionalServices', 'powerwall', 'eveHistory'], true),
            batteryIsLowSwitch: 
                defaultValue(config, ['additionalServices', 'powerwall', 'batteryIsLowSwitch'], false),
            batteryIsChargingSwitch: 
                defaultValue(config, ['additionalServices', 'powerwall', 'batteryIsChargingSwitch'], false),
        },
        solar: {
            homekitVisual:
                defaultValue(config, ['additionalServices', 'solar', 'homekitVisual'], true),
            evePowerMeter:
                defaultValue(config, ['additionalServices', 'solar', 'evePowerMeter'], true),
            eveHistory:
                defaultValue(config, ['additionalServices', 'solar', 'eveHistory'], true),
            eveLineGraph:
                defaultValue(config, ['additionalServices', 'solar', 'eveLineGraph'], false)
        },
        grid: {
            homekitVisual:
                defaultValue(config, ['additionalServices', 'grid', 'homekitVisual'], true),
            positiveEvePowerMeter:
                defaultValue(config, ['additionalServices', 'grid', 'positiveEvePowerMeter'], true),
            negativeEvePowerMeter:
                defaultValue(config, ['additionalServices', 'grid', 'negativeEvePowerMeter'], true),
            eveHistory:
                defaultValue(config, ['additionalServices', 'grid', 'eveHistory'], true),
            eveLineGraph:
                defaultValue(config, ['additionalServices', 'grid', 'eveLineGraph'], false)
        },
        battery: {
            homekitVisual:
                defaultValue(config, ['additionalServices', 'battery', 'homekitVisual'], true),
            positiveEvePowerMeter:
                defaultValue(config, ['additionalServices', 'battery', 'positiveEvePowerMeter'], true),
            negativeEvePowerMeter:
                defaultValue(config, ['additionalServices', 'battery', 'negativeEvePowerMeter'], true),
            eveHistory:
                defaultValue(config, ['additionalServices', 'battery', 'eveHistory'], true),
            eveLineGraph:
                defaultValue(config, ['additionalServices', 'battery', 'eveLineGraph'], false)
        },
        home: {
            homekitVisual:
                defaultValue(config, ['additionalServices', 'home', 'homekitVisual'], true),
            evePowerMeter:
                defaultValue(config, ['additionalServices', 'home', 'evePowerMeter'], true),
            eveHistory:
                defaultValue(config, ['additionalServices', 'home', 'eveHistory'], true),
            eveLineGraph:
                defaultValue(config, ['additionalServices', 'home', 'eveLineGraph'], false)
        },
        gridstatus: {
            gridIsDownSwitch:
                defaultValue(config, ['additionalServices', 'gridstatus', 'gridIsDownSwitch'], false),
            gridIsUpSwitch:
                defaultValue(config, ['additionalServices', 'gridstatus', 'gridIsUpSwitch'], false),
            gridIsNotYetInSyncSwitch:
                defaultValue(config, ['additionalServices', 'gridstatus', 'gridIsNotYetInSyncSwitch'], false),
        }
    };

    Powerwall = require('./src/accessories/powerwall.js')(Characteristic, 
        Service, FakeGatoHistoryService, FakeGatoHistorySetting);

    PowerMeter = require('./src/accessories/powermeter.js')(Characteristic, 
        Service, FakeGatoHistoryService, FakeGatoHistorySetting);

    PowerMeterLineGraph = require('./src/accessories/powermeter-line-graph.js')(
        Characteristic, Service, FakeGatoHistoryService, FakeGatoHistorySetting);

    GridStatus = require('./src/accessories/gridstatus.js')(Characteristic, 
        Service, FakeGatoHistoryService, FakeGatoHistorySetting);

    loadEve();
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
            startUrl:         this.startUrl
        };
        accessories.push(new Powerwall(this.log, powerwallConfig));


        if (this.additionalServices.solar && 
            (
                this.additionalServices.solar.homekitVisual ||
                this.additionalServices.solar.evePowerMeter ||
                this.additionalServices.solar.eveHistory ||
                this.additionalServices.solar.eveLineGraph
            )
        ) {
            var solarGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['solar', 'instant_power'], 0);
            var solarConfig = {
                displayName:     'Solar',
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      solarGetter,
                uniqueId:        '1_solar',
                additionalServices: {
                    homekitVisual: this.additionalServices.solar.homekitVisual,
                    evePowerMeter: this.additionalServices.solar.evePowerMeter,
                    eveHistory:    this.additionalServices.solar.eveHistory,
                }
            };
            accessories.push(new PowerMeter(this.log, solarConfig));

            if (this.additionalServices.solar.eveLineGraph) {
                var solarLineGraphConfig = {
                    displayName:     'Solar Line Graph',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      solarGetter,
                    uniqueId:        '1_solar_lg'
                };
                accessories.push(new PowerMeterLineGraph(this.log, solarLineGraphConfig));
            }
        }

        if (this.additionalServices.grid && 
            (
                this.additionalServices.grid.homekitVisual ||
                this.additionalServices.grid.positiveEvePowerMeter ||
                this.additionalServices.grid.negativeEvePowerMeter ||
                this.additionalServices.grid.eveHistory ||
                this.additionalServices.grid.eveLineGraph
            )
        ) {
            var gridGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['site', 'instant_power'], 0);
            var gridConfig = {
                displayName:     'Grid',
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      gridGetter,
                uniqueId:        '2_grid',
                additionalServices: {
                    homekitVisual: this.additionalServices.grid.homekitVisual,
                    evePowerMeter: this.additionalServices.grid.positiveEvePowerMeter,
                    eveHistory:    this.additionalServices.grid.eveHistory,
                }
            };
            accessories.push(new PowerMeter(this.log, gridConfig));

            if (this.additionalServices.grid.negativeEvePowerMeter) {
                var negGridGetter = new ValueGetter(
                    this.log, 
                    this.aggregateUrl, 
                    ['site', 'instant_power'], 
                    0, 
                    function(i) {return -i;});
                var negGridConfig = {
                    displayName:     'Grid Feed',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      negGridGetter,
                    uniqueId:        '2_neg_grid',
                    additionalServices: {
                        homekitVisual: false,
                        evePowerMeter: true,
                        eveHistory:    this.additionalServices.grid.eveHistory,
                    }
                };
                accessories.push(new PowerMeter(this.log, negGridConfig));
            }

            if (this.additionalServices.grid.eveLineGraph) {
                var gridLineGraphConfig = {
                    displayName:     'Grid Line Graph',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      gridGetter,
                    uniqueId:        '2_grid_lg'
                };
                accessories.push(new PowerMeterLineGraph(this.log, gridLineGraphConfig));
            }
        }

        if (this.additionalServices.battery && 
            (
                this.additionalServices.battery.homekitVisual ||
                this.additionalServices.battery.positiveEvePowerMeter ||
                this.additionalServices.battery.negativeEvePowerMeter ||
                this.additionalServices.battery.eveHistory ||
                this.additionalServices.battery.eveLineGraph
            )
        ) {
            var batteryGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['battery', 'instant_power'], 0);
            var batteryConfig = {
                displayName:     'Battery',
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      batteryGetter,
                uniqueId:        '3_battery',
                additionalServices: {
                    homekitVisual: this.additionalServices.battery.homekitVisual,
                    evePowerMeter: this.additionalServices.battery.positiveEvePowerMeter,
                    eveHistory:    this.additionalServices.battery.eveHistory,
                }
            };
            accessories.push(new PowerMeter(this.log, batteryConfig));

            if (this.additionalServices.battery.negativeEvePowerMeter) {
                var negBatteryGetter = new ValueGetter(
                    this.log, 
                    this.aggregateUrl, 
                    ['battery', 'instant_power'], 
                    0, 
                    function(i) {return -i;});
                var negBatteryConfig = {
                    displayName:     'Battery Charge',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      negBatteryGetter,
                    uniqueId:        '3_neg_battery',
                    additionalServices: {
                        homekitVisual: false,
                        evePowerMeter: true,
                        eveHistory:    this.additionalServices.battery.eveHistory,
                    }
                };
                accessories.push(new PowerMeter(this.log, negBatteryConfig));
            }

            if (this.additionalServices.battery.eveLineGraph) {
                var batteryLineGraphConfig = {
                    displayName:     'Battery Line Graph',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      batteryGetter,
                    uniqueId:        '3_battery_lg'
                };
                accessories.push(new PowerMeterLineGraph(this.log, batteryLineGraphConfig));
            }
        }

        if (this.additionalServices.home && 
            (
                this.additionalServices.home.homekitVisual ||
                this.additionalServices.home.evePowerMeter ||
                this.additionalServices.home.eveHistory ||
                this.additionalServices.home.eveLineGraph
            )
        ) {
            var homeGetter = new ValueGetter(
                this.log, this.aggregateUrl, ['load', 'instant_power'], 0);
            var homeConfig = {
                displayName:     'Home',
                pollingInterval: this.pollingInterval,
                historyInterval: this.historyInterval,
                wattGetter:      homeGetter,
                uniqueId:        '4_home',
                additionalServices: {
                    homekitVisual: this.additionalServices.home.homekitVisual,
                    evePowerMeter: this.additionalServices.home.evePowerMeter,
                    eveHistory:    this.additionalServices.home.eveHistory,
                }
            };
            accessories.push(new PowerMeter(this.log, homeConfig));

            if (this.additionalServices.home.eveLineGraph) {
                var homeLineGraphConfig = {
                    displayName:     'Home Line Graph',
                    pollingInterval: this.pollingInterval,
                    historyInterval: this.historyInterval,
                    wattGetter:      homeGetter,
                    uniqueId:        '4_home_lg'
                };
                accessories.push(new PowerMeterLineGraph(this.log, homeLineGraphConfig));
            }
        }

        if (this.additionalServices.gridstatus.gridIsUpSwitch ||
            this.additionalServices.gridstatus.gridIsDownSwitch ||
            this.additionalServices.gridstatus.gridIsNotYetInSyncSwitch) {

            var gridStatusGetter = new ValueGetter(
                this.log, this.gridstatusUrl, ['grid_status'], '');
            var gridStatusConfig = {
                displayName:        'Grid Status',
                pollingInterval:    this.pollingInterval,
                historyInterval:    this.historyInterval,
                gridStatusGetter:   gridStatusGetter,
                uniqueId:           '5_grid_status',
                additionalServices: this.additionalServices.gridstatus
            }
            accessories.push(new GridStatus(this.log, gridStatusConfig));
        }

        callback(accessories);
    }
};

var loadEve = function() {
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
};

var defaultValue = function(start, listOfAttr, fallback) {
    var result = start;
    for (var att in listOfAttr) {
        if (result === undefined || result === null) {
            return fallback;
        }

        result = result[listOfAttr[att]];
    }

    if (result === true || result ===false)
        return result;
    else
        return fallback;
};
