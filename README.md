# homebridge-tesla-powerwall
Homebridge Plugin for the Tesla Powerwall.

# Installation as Homebrdige plugin
TODO

## Configuration
Inside:
```json
...
    "platforms": [
        {
```
### Have-to:
```json
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
```
* name is freely choosable

### Could:
```json
            "ip": "127.0.0.1",
            "port": "80",
            "pollingInterval": 15000,
            "historyInterval": 300000,
            "lowBattery": 20,
            "language": "en",
            "historySetting": {},
```
Here filled with default Values.


```json
        },
    ...
    other platforms
    ...
    ]
...
```
