# API fixtures — provisional, DERIVED-FROM-SOURCE

These JSON fixtures were reconstructed from the OpenSprinkler-Firmware **emit code**
(`opensprinkler_server.cpp`), not captured from a live device. They model a
**1-board / 8-station / 1-program** controller and pin the *shapes* the typed client
(`www/src/api/`) depends on.

> Keep this curated, value-coupled corpus intact. Capture the live device and DEMO build for every
> target firmware version with `npm run capture`; the capture tool writes a redacted set beneath
> `test/fixtures/api/captured/<fwv>/` for shape comparison without exposing household credentials or
> overwriting these deterministic tests.

Known shape notes baked into these fixtures (verified against firmware source):
- `/jc.lrun` is `[station, program, duration, endtime]` — **station first**.
- `/jc.eip` is a uint32 IPv4 here; IPv6 builds may emit a string (`number | string`).
- `/jl` is a **bare array** of mixed rows; station rows have a number at index 1,
  special rows have a string (`s1|s2|rd|wl|fl|cu`) — discriminate before indexing.
- `/jp` `daterange` ints are int16 (`-32768/32767`), not 32-bit.
- Signed options (`tz`, `mton/mtof`, `mton2/mtof2`) are decoded-signed integers.
