# homebridge-tesla-powerwall
[![npm](https://img.shields.io/npm/v/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)
[![npm](https://img.shields.io/npm/dt/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)

(Unofficial) Homebridge Plugin for the Tesla Powerwall.

Communication with the Tesla Powerwall is according to https://github.com/vloschiavo/powerwall2 .

This Plugin is considered to be complete.
If you encounter a bug or want to propose a new feature, feel free to open an issue!

If you like this plugin, it is possible to donate a "cup of coffee" via Paypal:

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
            "password": "abc123",
```
* `name` can be freely chosen
* `ip` needs to be set to the IP-address of the Tesla Powerwall.
* `password` a correct password must be set

Optional:
```json
            "port": "",
            "username": "customer",
            "email": "Lt.Dan@bubbagump.com",
            "loginInterval": 39600000,
            "pollingInterval": 15000,
            "historyInterval": 300000,
            "lowBattery": 20,
            "additionalServices": {
                "powerwall": {
                    "homekitVisual": true,
                    "eveHistory": true,
                    "batteryIsLowSwitch": false,
                    "batteryIsChargingSwitch": false,
                    "makeOnOffSwitchReadOnly": true
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
                    "gridIsNotYetInSyncSwitch": false,
                    "gridIsDownSensor": false,
                    "gridIsUpSensor": false
                }
            }
```
* *Here* filled with default values (values that are used when the attribute 
  is not explicitly listed)

* `username`: the default ("customer") is currently the only username that will 
  work when logging in, i.e., there is no need to change any username; 
  using "customer" here will *just work*.
* `email`: seems to currently be ignored, i.e., it does not matter what email 
  is used for the login.

* `loginInterval`, `pollingInterval` or `historyInterval` in milliseconds
* `loginInterval`: the login is executed periodically based on this interval. 
  After a successful login, the authentication token is currently valid for 
  24h. If your internet is unreliable, it may be helpful to set a lower 
  interval to guarantee at least one successful login in the 24h time span.
  The default of 39600000ms corresponds to 11h.
* `lowBattery`: Percentage when the charge is considered critical/low
* `additionalServices`: Services additional to the basic switch with the 
  battery status.
  - *`...Switch`*: Adds a switch that represents the current state. (Useful for
    implementing Homekit automations.)
  - *`...Sensor`*: Adds a sensor that represents the current state. (Useful for 
    implementing Homekit automations.)
  - `powerwall.homekitVisual`: Adds a lamp service representing the battery 
    level.
  - `powerwall.eveHistory`: Adds an Eve weather service; sets the temperature
    to the battery level in percent.
  - `powerwall.makeOnOffSwitchReadOnly`: While the powerwall switch will 
    still be able to be flipped within, for example, the Home.app, when this 
    field is true, it will not have any effect.
    The switch is always going to update its state based on the received state. 
  - *Powermeter* i.e. `solar`, `grid`, `battery`, `home`
    + `*.homekitVisual`: Adds a fan service; sets the speed to the 
      current power times 100; 100% is equal to 10000W.
    + `*.evePowerMeter`: Adds an Eve powermeter service.
    + `*.evehistory`: Adds the total consumption to an Eve powermeter service.
      Only works when `evePowerMeter` is also set to true.
    + `*.eveLineGraph`: Saves power data in an Eve weather diagram to get a 
      nice line chart. 

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
### Minimal Configuration
```json
...
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.178.100",
            "password": "abc123",
            "pollingInterval": 10000,
            "historyInterval": 120000,
            "lowBattery": 10,
            "historySetting": {
                "storage": "fs"
            }

        }
...
```

### When using Eve.app
```json
...
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.178.100",
            "password": "abc123",
            "additionalServices": {
                "powerwall": {
                    "homekitVisual": false
                },
                "solar": {
                    "homekitVisual": false
                },
                "grid": {
                    "homekitVisual": false
                },
                "battery": {
                    "homekitVisual": false
                },
                "home": {
                    "homekitVisual": false
                }
            }
        }
...
```

### Using only Home.app supported services (minimal)
```json
...
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.178.100",
            "password": "abc123",
            "additionalServices": {
                "powerwall": {
                    "homekitVisual": false,
                    "eveHistory": false
                },
                "solar": {
                    "homekitVisual": false,
                    "evePowerMeter": false,
                    "eveHistory": false
                },
                "grid": {
                    "homekitVisual": false,
                    "positiveEvePowerMeter": false,
                    "negativeEvePowerMeter": false,
                    "eveHistory": false
                },
                "battery": {
                    "homekitVisual": false,
                    "positiveEvePowerMeter": false,
                    "negativeEvePowerMeter": false,
                    "eveHistory": false
                },
                "home": {
                    "homekitVisual": false,
                    "evePowerMeter": false,
                    "eveHistory": false
                }
            }
        }
...
```

### Using only Home.app supported services (all the visualization services)
```json
...
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.178.100",
            "password": "abc123",
            "additionalServices": {
                "powerwall": {
                    "eveHistory": false
                },
                "solar": {
                    "evePowerMeter": false,
                    "eveHistory": false
                },
                "grid": {
                    "positiveEvePowerMeter": false,
                    "negativeEvePowerMeter": false,
                    "eveHistory": false
                },
                "battery": {
                    "positiveEvePowerMeter": false,
                    "negativeEvePowerMeter": false,
                    "eveHistory": false
                },
                "home": {
                    "evePowerMeter": false,
                    "eveHistory": false
                }
            }
        }
...
```

# FAQ
### Plugin stopped working after the Powerwall upgraded to version 20.49.0
Upgrade to the latest update of this plugin and make sure the `password` field
is added (see documentation above).

The `username` field should, at the moment, have a value equal to the default, i.e., it must be 
equal to "customer".

### Plugin behaves not as it should and the Powerwall version is lower than 20.49.0
Try to use the last 1.x.y version "1.1.0", i.e., `sudo npm install -g homebridge-tesla-powerwall@1.1.0`.


# Feature request / Bug found?
You are welcome to create an [Issue](https://github.com/datMaffin/homebridge-tesla-powerwall/issues/new).
