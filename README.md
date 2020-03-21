# homebridge-tesla-powerwall
[![npm](https://img.shields.io/npm/v/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)
[![npm](https://img.shields.io/npm/dt/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)

(Unofficial) Homebridge Plugin for the Tesla Powerwall.

Communication with the Tesla Powerwall is according to https://github.com/vloschiavo/powerwall2 .

This Plugin is still under development. If you like it, please support the development by sending a "cup of coffee" via Paypal:

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.me/HomebridgePowerwall)

And/Or leave a comment:
https://teslamotorsclub.com/tmc/threads/tesla-powerwall-homekit-support-through-homebridge.116416/

# Installation
1. Install [Homebridge](https://github.com/nfarina/homebridge): `sudo npm install -g --unsafe-perm homebridge`
2. Install this plugin `sudo npm install -g homebridge-tesla-powerwall`
3. Add this plugin as a platform to your `config.json` file

## Configuration
Inside `config.json` of Homebridge:
```json
...
    "platforms": [
        {
```
Mandatory:
```json
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "111.222.111.222",
```
* "name" can be freely chosen
* "ip" needs to be set to the IP-adress of the Tesla Powerwall.

Optional:
```json
            "port": "",
            "pollingInterval": 15000,
            "historyInterval": 300000,
            "lowBattery": 20,
            "additionalServices": {
                "powerwall": {
                    "homekitVisual": true,
                    "eveHistory": true,
                    "batteryIsLowSwitch": false,
                    "batteryIsChargingSwitch": false
                },
                "solar": {
                    "homekitVisual": true,
                    "evePowerMeter": true,
                    "eveHistory": true,
                    "eveLineGraph": false
                },
                "grid": {
                    "homekitVisual": true,
                    "positiveEvePowerMeter": true,
                    "negativeEvePowerMeter": true,
                    "eveHistory": true,
                    "eveLineGraph": false
                },
                "battery": {
                    "homekitVisual": true,
                    "positiveEvePowerMeter": true,
                    "negativeEvePowerMeter": true,
                    "eveHistory": true,
                    "eveLineGraph": false
                },
                "home": {
                    "homekitVisual": true,
                    "evePowerMeter": true,
                    "eveHistory": true,
                    "eveLineGraph": false
                },
                "gridstatus": {
                    "gridIsDownSwitch": false,
                    "gridIsUpSwitch": false,
                    "gridIsNotYetInSyncSwitch": false
                }
            }
```
* *Here* filled with default values (values that are used when the attribute 
  is not explicitly listed)

* "pollingInterval" or "historyInterval" in milliseconds
* "lowBattery": Percentage from which the charge is considered critical/low
* "additionalServices": Services additional to the basic switch with the 
  battery status.
* *eve power meter* displays total consumption only if the "eveHistory" is true
* "eveHistory" only works with the corresponding powermeter enabled
* "eveLineGraph": Saves power data in a weather diagramm to get a nice
  line chart. Persistant storage works only if "evePowerMeter" and "eveHistory" are `true`.

```json
        },
    ...
    other platforms
    ...
    ]
...
```
### History Configuration
From: [Fakegato project](https://github.com/simont77/fakegato-history#history-persistence)

#### No persistence (The Elgato-Eve App will still save received measurements):
* Do not include "historySetting" in the `config.json`.

#### File-System persistence:
```json
            "historySetting": {
```

Mandatory:
```json
                "storage": "fs",
```

Optional:
```json
                "size": 4032,
                "path": "/place/to/store/my/persistence/"
```
* "size" default: 4032
* "path" default: `.homebridge` folder of the user or the given `homebridge -U` location

```json
            }
```

#### Google Drive persistence:
```json
            "historySetting": {
```

Mandatory:
```json
                "storage": "googleDrive",
```

Optional:
```json
                "size": 4032,
                "folder": "fakegato",
                "keyPath": "/place/to/store/my/keys/"
```
* "size" default: 4032
* "folder" default: "fakegato" as the folder on Google Drive.
* "keyPath" default: `.homebridge` folder of the user or the given `homebridge -U` location

```json
            }
```

For the setup of Google Drive, please follow the Google Drive Quickstart for Node.js instructions from https://developers.google.com/drive/v3/web/quickstart/nodejs, except for these changes:
* In Step 1-h the working directory should be the .homebridge directory
* Skip Step 2 and 3
* In step 4, use the quickstartGoogleDrive.js included with this module. You need to run the command from fakegato-history directory. Then just follow steps a to c.

## Example Configuration
```json
...
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.178.100",
            "pollingInterval": 10000,
            "historyInterval": 120000,
            "lowBattery": 10,
            "historySetting": {
                "storage": "fs"
            }

        }
...
```
# FAQ
### Plugin stopped working after Powerwall upgraded to version 1.20.0
(Possible) **Solution**: Update this plugin and check in the `config.json` that 
the `port` option is either removed or set to `""`.

# Feature request / Bug found?
You are welcome to create an [Issue](https://github.com/datMaffin/homebridge-tesla-powerwall/issues/new).
