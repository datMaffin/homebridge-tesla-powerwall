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
* `name` can be freely chosen
* `ip` needs to be set to the IP-adress of the Tesla Powerwall.

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

* `pollingInterval` or `historyInterval` in milliseconds
* `lowBattery`: Percentage from which the charge is considered critical/low
* `additionalServices`: Services additional to the basic switch with the 
  battery status.
  - *`...Switch`*: Adds a switch that represents the current state. (Useful for
    implementing Homekit automations.)
  - `powerwall.homekitVisual`: Adds a lamp service representing the battery 
    level.
  - `powerwall.eveHistory`: Abuses an Eve weather service; sets the temperature
  - *Powermeter* i.e. `solar`, `grid`, `battery`, `home`
    + `*.homekitVisual`: Adds a fan service; sets the speed to the 
      current power times 100; 100% is equal to 10 000W.
    + `*.evePowerMeter`: Adds an Eve powermeter service.
    + `*.evehistory`: Adds the total consumption to an Eve powermeter service.
      Only works when `evePowerMeter` is also set to true.
    + `*.eveLineGraph`: Saves power data in an Eve weather diagramm to get a 
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
### Plugin stopped working after Powerwall upgraded to version 1.20.0
(Possible) **Solution**: Update this plugin and check in the `config.json` that 
the `port` option is either removed or set to `""`.

### Why was the authentication with username and password removed?
The authentication never worked. I did not find good documentation for 
authentication. In addition username and password are not necessery for reading
the status from the powerwall. The only feature that would require 
authentication (since Powerwall version 1.20.0) is the stopping and running 
(starting) of the powerwall.

If you use a Powerwall with Software version less than 1.20.0 you can stop and 
start die Powerwall by toggling the switch indicating the Powerwall on/off 
state.

# Feature request / Bug found?
You are welcome to create an [Issue](https://github.com/datMaffin/homebridge-tesla-powerwall/issues/new).
