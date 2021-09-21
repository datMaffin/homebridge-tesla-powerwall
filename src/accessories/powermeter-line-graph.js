var moment   = require('moment');

var Polling = require('../helper/polling.js');
var eventPolling = require('../helper/simple-event-polling.js');
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

        this.energyLG = new Service.WeatherService(this.name + ' Energy Line Graph');
        this.energyLG
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -10000,
                maxValue: 10000
            })
            .on('get', _createFastGetter(this.getWatt.bind(this), this.log));
        eventPolling(this.energyLG, Characteristic.CurrentTemperature, this.pollingInterval);
        services.push(this.energyLG);

        this.energyHistory = new FakeGatoHistoryService('weather', this, FakeGatoHistorySetting);
        services.push(this.energyHistory);

        var history = new Polling(this.wattGetter, this.historyInterval);
        history.pollValue(function(error, value) {
            // division by 1000 is necessary because of an overflow at about 500
            this.log.debug('Line Diagramm Energy History value: ' + (value / 1000));
            this.energyHistory.addEntry({time:moment().unix(), temp: (value / 1000)});
        }.bind(this));

        return services;
    },

    getWatt: function(callback) {
        this.wattGetter.requestValue(function(error, value) {
            callback(error, value);
        }, this.pollingInterval / 2);
    },
};


