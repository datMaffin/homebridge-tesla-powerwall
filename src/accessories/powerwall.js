var moment   = require('moment');

var Polling = require('../helper/polling.js');
var eventPolling = require('../helper/simple-event-polling.js');
var reset = require('../helper/event-value-resetter.js');

var _httpGetRequest = require('../helper/my-http-request.js');
var _checkRequestError = require('../helper/check-for-request-error.js');
var _createFastGetter = require('../helper/fast-getter.js');


var Characteristic, Service, FakeGatoHistoryService, FakeGatoHistorySetting;

module.exports = function(characteristic, service, fakegatohistoryservice, accessory, fakegatohistorysetting) {
    Characteristic = characteristic;
    Service = service;
    FakeGatoHistoryService = fakegatohistoryservice;
    FakeGatoHistorySetting = fakegatohistorysetting;

    return Powerwall;
};

// Powerwall
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
            .setCharacteristic(Characteristic.Model, 'Powerwall2')
            .setCharacteristic(Characteristic.FirmwareRevision, '-')
            .setCharacteristic(Characteristic.SerialNumber, this.uniqueId);
        services.push(info);
        
        this.stateSwitch = new Service.Switch(this.name, "1");
        this.stateSwitch
            .getCharacteristic(Characteristic.On)
            .on('get', _createFastGetter(this.getStateSwitch.bind(this), this.log))
            .on('set', this.setStateSwitch.bind(this));
        eventPolling(this.stateSwitch, Characteristic.On, this.pollingInterval);
        services.push(this.stateSwitch);

        this.battery = 
            new Service.BatteryService(this.name + ' ' + 'Battery');
        this.battery
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', _createFastGetter(this.getBatteryLevel.bind(this), this.log));
        eventPolling(this.battery, Characteristic.BatteryLevel, this.pollingInterval);
        this.battery
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', _createFastGetter(this.getChargingState.bind(this), this.log));
        eventPolling(this.battery, Characteristic.ChargingState, this.pollingInterval);
        this.battery
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', _createFastGetter(this.getLowBattery.bind(this), this.log));
        eventPolling(this.battery, Characteristic.StatusLowBattery, this.pollingInterval);
        services.push(this.battery);

        if (this.additionalServices.homekitVisual) {
            this.batteryVisualizer = 
                new Service.Lightbulb(this.name + ' ' + 'Charge');
            this.batteryVisualizer
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getOnBatteryVisualizer.bind(this), this.log))
                .on('set', this.setOnBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.On, this.pollingInterval);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Hue)
                .on('get', _createFastGetter(this.getHueBatteryVisualizer.bind(this), this.log))
                .on('set', this.setHueBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.Hue, this.pollingInterval);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Brightness)
                .on('get', _createFastGetter(this.getBatteryLevel.bind(this), this.log))
                .on('set', this.setBrightnessBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.Brightness, this.pollingInterval);
            this.batteryVisualizer // Set saturation to fix compatibility with Homebridge Alexa
                .getCharacteristic(Characteristic.Saturation)
                .on('get', _createFastGetter(this.getConstantSaturationBatteryVisualizer.bind(this), this.log))
                .on('set', this.setSaturationBatteryVisualizer.bind(this));
            services.push(this.batteryVisualizer);
        }

        if (this.additionalServices.eveHistory) {

            // Eve Weather abused for battery charge history
            this.batteryCharge = new Service.WeatherService(
                this.name + ' ' + 'Battery' + ' History');
            this.batteryCharge
                .getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({
                    minValue: 0,
                    maxValue: 100
                })
                .on('get', _createFastGetter(this.getBatteryLevel.bind(this), this.log));
            eventPolling(this.batteryCharge, Characteristic.CurrentTemperature, this.pollingInterval);
            services.push(this.batteryCharge);


            this.batteryChargeHistory = new FakeGatoHistoryService('weather', this, FakeGatoHistorySetting);
            services.push(this.batteryChargeHistory);

            var percentageHistory = new Polling(this.percentageGetter, this.historyInterval);
            percentageHistory.pollValue(function(error, value) {
                this.log('history');
                this.batteryChargeHistory.addEntry(
                    {time: moment().unix(), temp: value});
            }.bind(this));
        }

        if (this.additionalServices.batteryIsLowSwitch) {
            this.batteryIsLowSwitch = new Service.Switch(this.name + ' State: "Battery Is Low"', '2');
            this.batteryIsLowSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getLowBattery.bind(this), this.log))
                .on('set', this.setBatteryIsLowSwitch.bind(this));
            eventPolling(this.batteryIsLowSwitch, Characteristic.On, this.pollingInterval);
            services.push(this.batteryIsLowSwitch);
        }

        if (this.additionalServices.batteryIsChargingSwitch) {
            this.batteryIsChargingSwitch = new Service.Switch(this.name + ' State: "Battery Is Charging"', '3');
            this.batteryIsChargingSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getChargingState.bind(this), this.log))
                .on('set', this.setBatteryIsChargingSwitch.bind(this));
            eventPolling(this.batteryIsChargingSwitch, Characteristic.On, this.pollingInterval);
            services.push(this.batteryIsChargingSwitch);
        }

        return services;
    },

    getStateSwitch: function(callback) {
        this.onStatusGetter.requestValue(callback, this.pollingInterval / 2);
    },

    setStateSwitch: function(state, callback) {

        if (this.additionalServices.makeOnOffSwitchReadOnly === false) {

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
        }

        reset(this.stateSwitch, Characteristic.On, 1000 * 4);
    },

    setBatteryIsLowSwitch: function(state, callback) {
        reset(this.batteryIsLowSwitch, Characteristic.On);
    },

    setBatteryIsChargingSwitch: function(state, callback) {
        reset(this.batteryIsChargingSwitch, Characteristic.On);
    },

    getBatteryLevel: function(callback) {
        this.percentageGetter.requestValue(callback, this.pollingInterval / 2);
    },

    getChargingState: function(callback) {
        this.chargingGetter.requestValue(function(error, value) {
            callback(error, value < 0);
        }.bind(this), this.pollingInterval / 2);
    },

    getLowBattery: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, value <= this.lowBattery);
        }.bind(this), this.pollingInterval / 2);
    },

    getOnBatteryVisualizer: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, value !== 0);
        }.bind(this), this.pollingInterval / 2);
    },

    setOnBatteryVisualizer: function(state, callback) {
        callback();
        reset( this.batteryVisualizer, Characteristic.On);
    },

    getHueBatteryVisualizer: function(callback) {
        this.percentageGetter.requestValue(function(error, value) {
            callback(error, (value/100) * 120 );
        }.bind(this), this.pollingInterval / 2);
    },

    getConstantSaturationBatteryVisualizer: function(callback) {
        callback(false, 100);
    },

    setHueBatteryVisualizer: function(state, callback) {
        callback();
        reset(this.batteryVisualizer, Characteristic.Hue);
    },

    setBrightnessBatteryVisualizer: function(state, callback) {
        callback();
        reset(this.batteryVisualizer, Characteristic.Brightness);
    },

    setSaturationBatteryVisualizer: function(state, callback) {
        callback();
        reset(this.batteryVisualizer, Characteristic.Saturation);
    }
};
