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

    return Gridstatus;
};

// Gridstatus
//
function Gridstatus(log, config) {
    this.log = log;

    this.displayName      = config.displayName; // for fakegato
    this.name             = config.displayName; // for homebridge
    this.pollingInterval  = config.pollingInterval;
    this.uniqueId         = config.uniqueId;

    this.gridStatusGetter   = config.gridStatusGetter;

    this.additionalServices = config.additionalServices;
}


Gridstatus.prototype = {

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
        
        if (this.additionalServices.gridIsUpSwitch) {
            this.gridIsUpSwitch = new Service.Switch(this.name + ' "Up"', '1');
            this.gridIsUpSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getGridIsUpSwitch.bind(this), this.log))
                .on('set', this.setGridIsUpSwitch.bind(this));
            eventPolling(this.gridIsUpSwitch, Characteristic.On, this.pollingInterval);
            services.push(this.gridIsUpSwitch);
        }
        
        if (this.additionalServices.gridIsDownSwitch) {
            this.gridIsDownSwitch = new Service.Switch(this.name + ' "Down"', '2');
            this.gridIsDownSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getGridIsDownSwitch.bind(this), this.log))
                .on('set', this.setGridIsDownSwitch.bind(this));
            eventPolling(this.gridIsDownSwitch, Characteristic.On, this.pollingInterval);
            services.push(this.gridIsDownSwitch);
        }

        if (this.additionalServices.gridIsNotYetInSyncSwitch) {
            this.gridIsNotYetInSyncSwitch = new Service.Switch(this.name + ' "Not Yet In Sync"', '3');
            this.gridIsNotYetInSyncSwitch
                .getCharacteristic(Characteristic.On)
                .on('get', _createFastGetter(this.getGridIsNotYetInSyncSwitch.bind(this), this.log))
                .on('set', this.setGridIsNotYetInSyncSwitch.bind(this));
            eventPolling(this.gridIsNotYetInSyncSwitch, Characteristic.On, this.pollingInterval);
            services.push(this.gridIsNotYetInSyncSwitch);
        }

        if (this.additionalServices.gridIsUpSensor) {
            this.gridIsUpSensor = new Service.ContactSensor(this.name + ' "Up" Sensor', '4');
            this.gridIsUpSensor
                .getCharacteristic(Characteristic.ContactSensorState)
                .on('get', _createFastGetter(this.getGridIsUpSwitch.bind(this), this.log))
            eventPolling(this.gridIsUpSensor, Characteristic.ContactSensorState, this.pollingInterval);
            services.push(this.gridIsUpSensor);
        }

        if (this.additionalServices.gridIsDownSensor) {
            this.gridIsDownSensor = new Service.ContactSensor(this.name + ' "Down" Sensor', '5');
            this.gridIsDownSensor
                .getCharacteristic(Characteristic.ContactSensorState)
                .on('get', _createFastGetter(this.getGridIsDownSwitch.bind(this), this.log))
            eventPolling(this.gridIsDownSensor, Characteristic.ContactSensorState, this.pollingInterval);
            services.push(this.gridIsDownSensor);
        }

        return services;
    },

    getGridIsUpSwitch: function(callback) {
        this.gridStatusGetter.requestValue(function(error, value) {
            callback(error, value === 'SystemGridConnected');
        }.bind(this), this.pollingInterval / 2);
    },

    setGridIsUpSwitch: function(state, callback) {
        callback();
        reset(this.gridIsUpSwitch, Characteristic.On);
    },

    getGridIsDownSwitch: function(callback) {
        this.gridStatusGetter.requestValue(function(error, value) {
            callback(error, value === 'SystemIslandedActive');
        }.bind(this), this.pollingInterval / 2);
    },

    setGridIsDownSwitch: function(state, callback) {
        callback();
        reset(this.gridIsDownSwitch, Characteristic.On);
    },

    getGridIsNotYetInSyncSwitch: function(callback) {
        this.gridStatusGetter.requestValue(function(error, value) {
            callback(error, value === 'SystemTransitionToGrid');
        }.bind(this), this.pollingInterval / 2);
    },

    setGridIsNotYetInSyncSwitch: function(state, callback) {
        callback();
        reset(this.gridIsNotYetInSyncSwitch, Characteristic.On);
    },
};
