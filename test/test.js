/* eslint-env mocha */
var assert = require('assert');
var nock = require('nock');


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Mocks
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//var log = require('./mocks/logger.js')._system;
var log = function(){};
var Homebridge = require('./mocks/homebridge.js')(undefined);
var Service = Homebridge.hap.Service;
var Characteristic = Homebridge.hap.Characteristic;

/*
describe('Loading the Homebridge-Mock', function() {
    it('should load a hap', function() {
        assert(homebridgeMock.hap != undefined);
    });
    it('should load a hap.Service', function() {
        assert(homebridgeMock.hap.Service != undefined);
    });
    it('should load a hap.Service', function() {
        assert(homebridgeMock.hap.Service != undefined);
    });
});
*/

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Load Plugin
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
require('../index.js')(Homebridge);
var PlatformType = Homebridge.PlatformType;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Tests
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
describe('Register Platform', function() {
    it('should register the correct plugin name', function() {
        assert(Homebridge.pluginName, 'homebridge-tesla-powerwall');
    });
    it('should register the correct config name', function() {
        assert(Homebridge.pluginName, 'TeslaPowerwall');
    });
    it('should have a valid platform type', function() {
        assert.ok(PlatformType);
    });
});
describe('Platform Configs', function() {
    describe('Test all default Settings', function() {

        //nock('http://127.0.0.1:80')
        //    .get('/api/meters/aggregates')
        //    .replyWithFile(200, __dirname + '/sample_response/api-meters-aggregates.json', 
        //        {'Content-Type': 'application/json'});
        nock('http://127.0.0.1:80')
            .get('/api/sitemaster')
            .replyWithFile(200, __dirname + '/sample_response/api-sitemaster.json', 
                {'Content-Type': 'application/json'});
        //nock('http://127.0.0.1:80')
        //    .get('/api/system/status/soe')
        //    .replyWithFile(200, __dirname + '/sample_response/api-system-status-soe.json', 
        //        {'Content-Type': 'application/json'});

        var config = {};
        var platform = new PlatformType(log, config);
        platform.accessories(function(accessories) {

            describe('Correct accessories by uniqueID', function() {
                describe('Powerwall', function() {
                    var powerwall;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '0_powerwall') {
                            powerwall = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powerwall);
                    });
                    describe('Services', function() {
                        var services = powerwall.getServices();
                        services.forEach(function(serv) {
                            describe('Switch', function() {
                                if (serv instanceof Service.Switch) {   
                                    it('should have the correct state', function() {
                                        assert.equal(serv.getCharacteristic(Characteristic.On).getValue(), true);
                                    });
                                }
                            });
                        });
                    });
                });
                describe('Solar Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '1_solar') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
                describe('Grid Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '2_grid') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
                describe('Grid-Feed Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '2_neg_grid') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
                describe('Battery Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '3_battery') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
                describe('Battery-Charge Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '3_neg_battery') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
                describe('Home Powermeter', function() {
                    var powermeter;
                    accessories.forEach(function(acc) {
                        if (acc.uniqueId == '4_home') {
                            powermeter = acc;
                        }
                    });

                    it('should be included', function() {
                        assert.ok(powermeter);
                    });
                });
            });

        });
    });
    describe('Additional Services', function() {
        describe('Minimal', function() {
        });
        describe('No Eve', function() {
        });
        describe('No Homekit', function() {
        });
        describe('Mixed', function() {
        });
    });
});

