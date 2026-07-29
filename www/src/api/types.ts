/**
 * OpenSprinkler firmware JSON-API types — Phase 1 / Step 1 (contract capture).
 *
 * Derived from the firmware emit code (source of truth: OpenSprinkler-Firmware
 * opensprinkler_server.cpp). The legacy API is NOT a declared schema — responses
 * are assembled via emit_p into a ~2 KB buffer and vary with device state — so
 * optional (`?`) fields are build/platform/state-dependent and may be absent.
 *
 * See docs/PHASE-1-MODERNIZATION-PRD.md (§3 contract capture, §5 fwv matrix).
 */

/** /jc — controller status (server_json_controller_main, opensprinkler_server.cpp:1226+). */
export interface JcResponse {
	devt: number;            // device time (unix, controller tz)
	nbrd: number;            // total configured boards (1 = the base board)
	en: 0 | 1;               // controller enabled
	sn1: 0 | 1; sn2: 0 | 1;  // sensor active
	rd: 0 | 1; rdst: number; // rain delay + stop time (unix)
	sunrise: number; sunset: number; // minutes from midnight
	eip: number | string;    // external IPv4 as uint32 (IPv6 builds may emit string)
	lwc: number; lswc: number; lupt: number; lrbtc: number;
	lrun: [station: number, program: number, duration: number, endtime: number]; // station-first
	pq: 0 | 1; pt: number; nq: number; ocs: number;
	mac: string; loc: string; jsp: string; wsp: string;
	ifkey: string; dname: string;
	wto: Record<string, unknown>;
	mqtt: Record<string, unknown>;
	wtdata: Record<string, unknown>; // {} when none
	wterr: number; wtrestr: 0 | 1;
	wls: number[];
	sbits: number[];
	ps: Array<[program: number, remaining: number, start: number, attribGroup: number]>;
	gpio: number[];
	// build/state-dependent:
	RSSI?: number; apdv?: number;                 // ESP8266
	otc?: Record<string, unknown>; otcs?: number;  // USE_OTF cloud
	email?: Record<string, unknown>;               // SUPPORT_EMAIL
	curr?: number;                                 // ARDUINO current draw (mA)
	flcrt?: number; flwrt?: number; flcto?: number; // flow sensor
}

/** /jo — integer options (NUM_IOPTS + metadata). `fwv` is pre-auth readable. */
export interface JoResponse {
	fwv: number; fwm: number; hwv: number; hwt: number; mexp: number; dexp?: number;
	fwf?: string; // fork build tag (kars85 firmware fork), e.g. "kars85.3"; absent on official firmware
	tz: number; ntp: 0 | 1; dhcp: 0 | 1;
	hp0: number; hp1: number;
	ntp1: number; ntp2: number; ntp3: number; ntp4: number;
	dns1: number; dns2: number; dns3: number; dns4: number;
	ext?: number; sdt: number;
	mas: number; mton: number; mtof: number;     // mton/mtof signed
	mas2: number; mton2: number; mtof2: number;  // signed
	ms: number[];                                // [m1_sid,m1_on,m1_off,m2_sid,m2_on,m2_off]
	wl: number; uwt: number; den: 0 | 1;
	ipas: 0 | 1; devid: number; lg: 0 | 1; dim: number; sar: number;
	ife: number; ife2: number;
	fpr0?: number; fpr1?: number;                // flow pulse rate calibration: ((fpr1<<8)+fpr0)/100 = volume per pulse
	sn1t: number; sn1o: 0 | 1; sn1on: number; sn1of: number;
	sn2t?: number; sn2o?: 0 | 1; sn2on?: number; sn2of?: number; // PIN_SENSOR2/ESP8266
	// hardware/platform-gated:
	ip1?: number; ip2?: number; ip3?: number; ip4?: number;
	gw1?: number; gw2?: number; gw3?: number; gw4?: number;
	subn1?: number; subn2?: number; subn3?: number; subn4?: number;
	fwire?: 0 | 1;
	con?: number; lit?: number;
	bst?: number; laton?: number; latof?: number; tpdv?: number;
	imin?: number; imax?: number;
	// forward-compat: unknown future options. Includes `string` so string-valued options
	// (e.g. the `fwf` fork build tag) coexist with the numeric integer-options.
	[option: string]: number | number[] | string | undefined;
}

/** Pre-auth fallback emitted when the password check fails (opensprinkler_server.cpp:415,2445). */
export interface JoPreAuthFallback { fwv: number; }

/** /jn — station names + attributes. Per-board arrays len = nboards; snames/stn_grp len = nstations. */
export interface JnResponse {
	masop: number[]; masop2: number[];
	ignore_rain: number[]; ignore_sn1: number[]; ignore_sn2: number[];
	stn_dis: number[]; stn_spe: number[];
	stn_grp: number[];
	snames: string[];
	maxlen: number;
}

/** /jp program tuple: [flags, days0, days1, starttimes[4], durations[nstations], name, daterange[3]]. */
export type OSProgram = [
	flags: number,
	days0: number,
	days1: number,
	starttimes: number[],
	durations: number[],
	name: string,
	daterange: [number, number, number],
];

/** /jp — programs. */
export interface JpResponse {
	nprogs: number; nboards: number; mnp: number; mnst: number; pnsize: number;
	pd: OSProgram[];
}

/** /jl — bare array of mixed-shape rows; discriminate on typeof row[1]. */
export type JlStationRow = [program: number, station: number, duration: number, endtime: number, flowRateGPM?: number];
export type JlSpecialRow = [value: number, type: string, duration: number, endtime: number];
export type JlRow = JlStationRow | JlSpecialRow;
export type JlResponse = JlRow[];

/** /js — per-station on/off status. */
export interface JsResponse { sn: number[]; nstations: number; }

/** Derived capability flags (fwv matrix, PRD §5). */
export interface Capabilities {
	fwvCombined: number;          // fwv*10 + fwm
	weatherRestricted: boolean;   // /jc.wtrestr present
	secondMaster: boolean;        // /jo.mas2 > 0
	secondSensor: boolean;        // /jo.sn2t present
	flowSensor: boolean;          // /jo.sn1t == 2
	otfCloud: boolean;            // /jc.otc present
}
