/* eslint-env mocha */
var assert = require('assert');
var nock = require('nock');


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Mocks
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
var log = function(){};
var Homebridge = require('./mocks/homebridge.js')(undefined);
var Service = Homebridge.hap.Service;
var Characteristic = Homebridge.hap.Characteristic;

// when console printout is needed uncomment:
//var log = console.log;
//log.debug = console.log;


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Load Plugin
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
require('../index.js')(Homebridge);
var PlatformType = Homebridge.PlatformType;


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Tests
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Testing includes:
// - Correct values from the server
// - Correct connections
// - Correct Services included
//
// Testing does NOT include:
// - updating/polling
// - Eve stuff (need to implement it via events (not just via polling))
//

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
    describe('Test default Settings (everything is enabled)', function() {

        // Setup Mock HTTP server for the state of the mock-powerwall.
        nock('http://127.0.0.1')
            .persist()
            .get('/api/meters/aggregates')
            .replyWithFile(200, __dirname + '/sample_response1/api-meters-aggregates.json', 
                {'Content-Type': 'application/json'});
        nock('http://127.0.0.1')
            .persist()
            .get('/api/sitemaster')
            .replyWithFile(200, __dirname + '/sample_response1/api-sitemaster.json', 
                {'Content-Type': 'application/json'});
        nock('http://127.0.0.1')
            .persist()
            .get('/api/system_status/soe')
            .replyWithFile(200, __dirname + '/sample_response1/api-system-status-soe.json', 
                {'Content-Type': 'application/json'});

        var config = {};
        var platform = new PlatformType(log, config);
        platform.accessories(function(accessories) {

            describe('Correct accessories by uniqueID', function() {
                describe('Powerwall (id: "0_powerwall")', function() {
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
                        
                        describe('Switch', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Switch) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = true;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should be able to switch it off', function() {
                                var stop = nock('http://127.0.0.1')
                                    .get('/api/sitemaster/stop')
                                    .reply(202, '');

                                serv.getCharacteristic(Characteristic.On).emit('set', false, function(){});

                                setTimeout(function() {
                                    stop.done(); // assertion error when not performed.
                                }, 1000);
                            });
                            it('should be able to switch it on', function() {
                                var run = nock('http://127.0.0.1')
                                    .get('/api/sitemaster/run')
                                    .reply(202, '');

                                serv.getCharacteristic(Characteristic.On).emit('set', true, function(){});

                                setTimeout(function() {
                                    run.done(); // assertion error when not performed.
                                }, 1000);
                            });
                        });
                        describe('Battery', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.BatteryService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct state', function(done) {
                                serv.getCharacteristic(Characteristic.BatteryLevel).emit('get', function(error, value) {
                                    var expected = 69.1675560298826;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
                        describe('Battery Visualizer (Homekit)', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Lightbulb) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct "on" state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = true;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should have the correct "brightness" state', function(done) {
                                serv.getCharacteristic(Characteristic.Brightness).emit('get', function(error, value) {
                                    var expected = 69.1675560298826;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
                        describe('Eve (Weather) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'weather') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
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

                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Homekit visual', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Fan) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct "On" state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = true;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should have the correct "Rotation Speed state', function(done) {
                                serv.getCharacteristic(Characteristic.RotationSpeed).emit('get', function(error, value) {
                                    var expected = 39.061700439453125;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
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
                    
                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Homekit visual', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Fan) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct "On" state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = false;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should have the correct "Rotation Speed state', function(done) {
                                serv.getCharacteristic(Characteristic.RotationSpeed).emit('get', function(error, value) {
                                    var expected = -0.21449996948242187;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
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
                    
                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
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
                    
                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Homekit visual', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Fan) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct "On" state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = true;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should have the correct "Rotation Speed state', function(done) {
                                serv.getCharacteristic(Characteristic.RotationSpeed).emit('get', function(error, value) {
                                    var expected = -23.5;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
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
                    
                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
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
                    
                    describe('Services', function() {
                        var services = powermeter.getServices();

                        describe('Eve Powermeter', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.PowerMeterService) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Eve (Energy) History', function() {
                            var serv;
                            services.forEach(function(s) {
                                // instanceof did not work...
                                if (s && s.addEntry && s.accessoryType === 'energy') {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                        });
                        describe('Homekit visual', function() {
                            var serv;
                            services.forEach(function(s) {
                                if (s instanceof Service.Fan) {
                                    serv = s;
                                }
                            });

                            it('should be included', function() {
                                assert.ok(serv);
                            });
                            it('should have the correct "On" state', function(done) {
                                serv.getCharacteristic(Characteristic.On).emit('get', function(error, value) {
                                    var expected = true;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                            it('should have the correct "Rotation Speed state', function(done) {
                                serv.getCharacteristic(Characteristic.RotationSpeed).emit('get', function(error, value) {
                                    var expected = 15.462712597712404;
                                    if (error)
                                        done(error);

                                    if (value === expected) {
                                        done();
                                    } else {
                                        done('Wrong value: ' + value + ' expected: ' + expected);
                                    }
                                });
                            });
                        });
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
