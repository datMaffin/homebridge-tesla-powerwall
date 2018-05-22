# homebridge-tesla-powerwall
Homebridge Plugin for the Tesla Powerwall

# Installation as Homebridge plugin
TODO

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
```
* "name" is freely choosable

Optional:
```json
            "ip": "127.0.0.1",
            "port": "80",
            "pollingInterval": 15000,
            "historyInterval": 300000,
            "lowBattery": 20,
            "language": "en"
```
* Here filled with default values
* There is no following comma after the last option
* "pollingInterval" or "historyInterval" in milliseconds
* "lowBattery" percent from which the charge is considered critical/low
* "language" supported: "en" (English) and "de" (German). Changes a few names.

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
                storage:'googleDrive',
```

Optional:
```json
                "size": 4032,
                "folder": "fakegato"
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

##### Additional notes for Google Drive
* Pay attention so that your plugin does not issue multiple addEntry calls for the same accessory at the same time (this may results in improper behaviour of Google Drive to the its asynchronous nature)

## Example Configuration
```json
...
    "platforms": [
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.170.100",
            "pollingInterval": 10000,
            "historyInterval": 120000,
            "lowBattery": 10,
            "language": "en"
        },
    ...
    other platforms
    ...
    ]
...
```
