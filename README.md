# Daly BMS Monitor

A single-page Web Bluetooth dashboard for Daly Smart BMS units — a lightweight
alternative to the official Android app.

**Live:** https://oryjkov.github.io/smart-bms-ble/

It shows state of charge, pack voltage, current, power, remaining capacity,
temperatures, cycle count, MOSFET/balancer state and per-cell voltages, and
keeps a raw frame log for debugging. It is read-only: it never writes settings
or switches MOSFETs.

## Supported devices

Daly Smart BMS with the newer Bluetooth module (H/K/M/S series), advertised as
`DL-xxxxxxxxxxxx`. These speak Modbus over BLE (GATT service `fff0`, notify
`fff1`, write `fff2`, frames starting with `0xD2`). Tested with a 4S LiFePO4
pack.

Older modules using the `0xA5` frame protocol are not supported.

## Usage

1. Close the Daly phone app — the BMS accepts only one connection at a time.
2. Open the page in Chrome or Chromium and click **Connect**.
3. After the first connection, the page remembers the device and connects to it
   automatically on load.

On Linux, enable these in `chrome://flags` and restart the browser:

- `#enable-experimental-web-platform-features` (Web Bluetooth)
- `#enable-web-bluetooth-new-permissions-backend` (remember the device for
  auto-connect)

## Development

No build step. Web Bluetooth requires HTTPS or `localhost`:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# open http://localhost:8000
```

Protocol code lives in `daly.js`. Tests decode frames captured from a real
device:

```sh
node daly.test.mjs
```

## Protocol references

- [aiobmsble](https://github.com/patman15/aiobmsble) — `daly_bms.py`
- [syssi/esphome-daly-bms](https://github.com/syssi/esphome-daly-bms)
- [fl4p/batmon-ha](https://github.com/fl4p/batmon-ha)

## License

MIT
