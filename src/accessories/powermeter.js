var moment   = require('moment');

var Polling = require('../helper/polling.js');
var eventPolling = require('../helper/simple-event-polling.js');
var reset = require('../helper/event-value-resetter.js');
var _createFastGetter = require('../helper/fast-getter.js');

var Characteristic, Service, FakeGatoHistoryService, FakeGatoHistorySetting;

module.exports = function(characteristic, service, fakegatohistoryservice, fakegatohistorysetting) {
    Characteristic = characteristic;
    Service = service;
    FakeGatoHistoryService = fakegatohistoryservice;
    FakeGatoHistorySetting = fakegatohistorysetting;

    return PowerMeter;
};

// PowerMeter
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
            .setCharacteristic(Characteristic.Model, 'Power Meter')
            .setCharacteristic(Characteristic.FirmwareRevision, '-')
            .setCharacteristic(Characteristic.SerialNumber, this.uniqueId);
        services.push(info);

        if (this.additionalServices.homekitVisual) {
            this.wattVisualizer = new Service.Fan(this.name + ' ' + 'Flow');
            this.wattVisualizer
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getOnWattVisualizer.bind(this), this.log))
                .on('set', this.setOnWattVisualizer.bind(this));
            eventPolling(this.wattVisualizer, Characteristic.On, this.pollingInterval);
            this.wattVisualizer
                .getCharacteristic(Characteristic.RotationSpeed)
                .setProps({maxValue: 100000, minValue: -100000, minStep: 1, unit: 'Watts'})
                .on('get', _createFastGetter(this.getRotSpWattVisualizer.bind(this), this.log))
                .on('set', this.setRotSpWattVisualizer.bind(this));
            eventPolling(this.wattVisualizer, Characteristic.RotationSpeed, this.pollingInterval);
            services.push(this.wattVisualizer);
        }

        // Eve Powermeter
        
        if (this.additionalServices.evePowerMeter) {
            this.powerConsumption = new Service.PowerMeterService(
                this.name + ' ' + 
                'Power Meter');
            this.powerConsumption
                .getCharacteristic(Characteristic.CurrentPowerConsumption)
                .on('get', _createFastGetter(this.getWatt.bind(this), this.log));
            eventPolling(this.powerConsumption, Characteristic.CurrentPowerConsumption, this.pollingInterval);
            services.push(this.powerConsumption);
        }

        // History
        if (this.additionalServices.evePowerMeter &&
            this.additionalServices.eveHistory) {

            this.powerConsumption
                .getCharacteristic(Characteristic.ResetTotal)
                .on('set', this.setResetTotalConsumption.bind(this))
                .on('get', _createFastGetter(this.getResetTotalConsumption.bind(this), this.log));

            this.powerMeterHistory = 
                new FakeGatoHistoryService('energy', this, FakeGatoHistorySetting);
            services.push(this.powerMeterHistory);

            var wattHistory = new Polling(this.wattGetter, this.historyInterval);
            wattHistory.pollValue(function(error, value) {
                // set negative values to 0
                if (value < 0) {
                    value = 0;
                }
                this.log.debug('Watt History value: ' + value);
                this.powerMeterHistory.addEntry(
                    {time: moment().unix(), power: value});

                var totalEnergy = 
                    (this.powerMeterHistory.getExtraPersistedData() &&
                     this.powerMeterHistory.getExtraPersistedData().totalEnergy) || 0;
                totalEnergy += value * this.historyInterval / 3600 / 1000;

                var lastReset = 
                    (this.powerMeterHistory.getExtraPersistedData() &&
                     this.powerMeterHistory.getExtraPersistedData().lastReset) || 0;

                this.powerMeterHistory.setExtraPersistedData(
                    {totalEnergy: totalEnergy, lastReset: lastReset});

                this.powerConsumption
                    .getCharacteristic(Characteristic.TotalConsumption)
                    .updateValue(totalEnergy);

            }.bind(this));
        }

        return services;
    },

    getWatt: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            // Do not allow negative numbers; 
            // negative values are illegal for the characteristic "Consumption"
            callback(error, Math.max(value, 0));
        }, this.pollingInterval / 2);
    },

    getOnWattVisualizer: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            callback(error, Math.abs(value) >= 20);
        }, this.pollingInterval / 2);
    },

    setOnWattVisualizer: function(state, callback) {
        callback();
        reset(this.wattVisualizer, Characteristic.On);
    },

    getRotSpWattVisualizer: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            callback(error, value);
        }, this.pollingInterval / 2);
    },

    setRotSpWattVisualizer: function(state, callback) {
        callback();
        reset(this.wattVisualizer, Characteristic.RotationSpeed);
    },

    setResetTotalConsumption: function(state, callback) {
        this.powerMeterHistory.setExtraPersistedData({ totalEnergy: 0, lastReset: state || 0});
        this.powerConsumption
            .getCharacteristic(Characteristic.TotalConsumption)
            .updateValue(0);
        callback(null);
    },

    getResetTotalConsumption: function(callback) {
        callback(
            (this.powerMeterHistory.getExtraPersistedData() &&
            this.powerMeterHistory.getExtraPersistedData().lastReset) || 0);
    },
};


