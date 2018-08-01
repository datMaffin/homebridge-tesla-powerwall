/*eslint-disable*/
/*
 * From: https://github.com/planetk/homebridge-netatmo/blob/master/test/lib/homebridge-mock.js
 */
'use strict';
var ServiceMock = require('./service').Service;         // => changed
var CharacteristicMock = require('./characteristic').Characteristic;    // => changed
require('./types');                                     // => changed
var AccessoryMock = require('./accessory').Accessory;   // => changed
var uuidMock = require('./uuid');                       // => changed

module.exports = function(context) {
  return new HombridgeMock(context);
};

function HombridgeMock(context) {
  this.context = context;
  this.hap = {
    Service: ServiceMock,
    Characteristic: CharacteristicMock,
    Accessory: AccessoryMock,
    uuid: uuidMock
  };
}

HombridgeMock.prototype.registerPlatform = function (name, title, Platform) {
  this.pluginName = name;
  this.configName = title;
  this.PlatformType = Platform;
};

