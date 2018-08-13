var inherits = require('util').inherits;
var moment   = require('moment');

var Polling = require('../helper/polling.js');
var eventPolling = require('../helper/simple-event-polling.js');
var reset = require('../helper/value-resetter.js');

var _httpGetRequest = require('../helper/my-http-request.js');
var _checkRequestError = require('../helper/check-for-request-error.js');


var Characteristic, Service, FakeGatoHistoryService, Accessory, FakeGatoHistorySetting;

module.exports = function(characteristic, service, fakegatohistoryservice, accessory, fakegatohistorysetting) {
    Characteristic = characteristic;
    Service = service;
    FakeGatoHistoryService = fakegatohistoryservice;
    Accessory = accessory;
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

    inherits(Powerwall, Accessory);
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
        
        this.stateSwitch = new Service.Switch(this.name);
        this.stateSwitch
            .getCharacteristic(Characteristic.On)
            .on('get', this.getStateSwitch.bind(this))
            .on('set', this.setStateSwitch.bind(this));
        eventPolling(this.stateSwitch, Characteristic.On, this.pollingInterval);
        services.push(this.stateSwitch);

        this.battery = 
            new Service.BatteryService(this.name + ' ' + 'Battery');
        this.battery
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this.getBatteryLevel.bind(this));
        eventPolling(this.battery, Characteristic.BatteryLevel, this.pollingInterval);
        this.battery
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', this.getChargingState.bind(this));
        eventPolling(this.battery, Characteristic.ChargingState, this.pollingInterval);
        this.battery
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getLowBattery.bind(this));
        eventPolling(this.battery, Characteristic.StatusLowBattery, this.pollingInterval);
        services.push(this.battery);

        if (this.additionalServices.homekitVisual) {
            this.batteryVisualizer = 
                new Service.Lightbulb(this.name + ' ' + 'Charge');
            this.batteryVisualizer
                .getCharacteristic(Characteristic.On)
                .on('get', this.getOnBatteryVisualizer.bind(this))
                .on('set', this.setOnBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.On, this.pollingInterval);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Hue)
                .on('get', this.getHueBatteryVisualizer.bind(this))
                .on('set', this.setHueBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.Hue, this.pollingInterval);
            this.batteryVisualizer
                .getCharacteristic(Characteristic.Brightness)
                .on('get', this.getBatteryLevel.bind(this))
                .on('set', this.setBrightnessBatteryVisualizer.bind(this));
            eventPolling(this.batteryVisualizer, Characteristic.Brightness, this.pollingInterval);
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
                .on('get', this.getBatteryLevel.bind(this));
            eventPolling(this.batteryCharge, Characteristic.CurrentTemperature, this.pollingInterval);
            this.batteryCharge
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on('get', this.getBatteryLevel.bind(this));
            eventPolling(this.batteryCharge, Characteristic.CurrentRelativeHumidity, this.pollingInterval);
            services.push(this.batteryCharge);

            this.batteryChargeHistory = 
                new FakeGatoHistoryService('weather', this, FakeGatoHistorySetting);
            services.push(this.batteryChargeHistory);

            var percentageHistory = new Polling(this.percentageGetter, this.historyInterval);
            percentageHistory.pollValue(function(error, value) {
                this.log('history');
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
            callback(error, value !== 0);
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

    setBrightnessBatteryVisualizer: function(state, callback) {
        callback();
        reset(
            this.batteryVisualizer, 
            Characteristic.Brightness, 
            this.getBrightnessBatteryVisualizer.bind(this));
    }
};
