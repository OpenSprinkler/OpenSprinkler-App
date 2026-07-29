/**
 * Live-hardware verification harness (env-driven, NOT in the normal suite or CI — run via
 * `npm run verify:live`). Runs the REAL seam → typed client → decoders against a physical controller
 * to prove the read pipeline + capabilities on hardware, and — only with OS_LIVE_WRITE=1 — a single
 * REVERSIBLE rain-delay write (set → verify → cancel; no stations run) to prove the command path.
 * Skips cleanly when OS_LIVE_BASE is unset. No secrets are committed; pass them via env:
 *
 *   OS_LIVE_BASE=http://<ip>/ OS_LIVE_PW=<password> npm run verify:live
 *   OS_LIVE_BASE=http://<ip>/ OS_LIVE_PW=<password> OS_LIVE_WRITE=1 npm run verify:live   # + write proof
 */
import { describe, it, expect } from "vitest";
import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient, deriveCapabilities } from "../www/src/api/client";
import { md5 } from "../www/src/auth/md5";
import { decodeAllStations, decodeAllPrograms, decodeLogRow } from "../www/src/api/decode";
import { adjustmentMethodName, weatherStatus } from "../www/src/api/diagnostics";

const base = process.env.OS_LIVE_BASE ?? "";
const pw = process.env.OS_LIVE_PW ?? "";
const fwv = Number( process.env.OS_LIVE_FWV ?? 221 );
const seam = new BrowserDeviceSeam( { baseUrl: base, pwHash: pw ? md5( pw ) : "", ver: fwv, ipas: 0 } );
const api = new OsApiClient( seam );

describe.skipIf( !base )( "live device — read pipeline", () => {
	it( "authenticates and parses /jo + /jc", async () => {
		const jo = await api.getOptions();
		const jc = await api.getControllerStatus();
		console.log( `\n  fwv=${ jo.fwv } fwm=${ jo.fwm } hwv=${ jo.hwv } dname=${ JSON.stringify( jc.dname ) } fwf=${ JSON.stringify( jo.fwf ) }` );
		console.log( `  enabled=${ jc.en } wl=${ jo.wl }% rd=${ jc.rd } uwt=${ jo.uwt } (${ adjustmentMethodName( jo.uwt ) }) sn1t=${ jo.sn1t }` );
		console.log( `  weather=${ weatherStatus( jc.wterr ).text } loc=${ JSON.stringify( jc.loc ) } wsp=${ jc.wsp }` );
		expect( jo.fwv ).toBeGreaterThan( 100 );           // full /jo (auth worked), not the {fwv} stub
		expect( Object.keys( jo ).length ).toBeGreaterThan( 5 );
		expect( typeof jc.devt ).toBe( "number" );
		expect( [ "number", "string" ] ).toContain( typeof jc.eip );
	} );

	it( "parses + decodes /jn stations", async () => {
		const jc = await api.getControllerStatus();
		const jn = await api.getStations();
		const stations = decodeAllStations( jc, jn );
		console.log( `\n  ${ stations.length } stations: ${ stations.map( ( s ) => s.name ).join( ", " ) }` );
		console.log( `  active: ${ stations.filter( ( s ) => s.on ).map( ( s ) => s.name ).join( ", " ) || "(none)" }` );
		expect( stations.length ).toBe( jn.snames.length );
	} );

	it( "parses + decodes /jp programs", async () => {
		const jp = await api.getPrograms();
		const jn = await api.getStations();
		const programs = decodeAllPrograms( jp, jn.snames );
		console.log( `\n  ${ programs.length } programs: ${ programs.map( ( p ) => `"${ p.name }" (${ p.type }, ${ p.enabled ? "on" : "off" })` ).join( ", " ) || "(none)" }` );
		expect( jp.nprogs ).toBe( programs.length );
	} );

	it( "parses + decodes /jl logs", async () => {
		const jc = await api.getControllerStatus();
		const jl = await api.getLogs( { end: jc.devt } );
		const entries = jl.map( decodeLogRow );
		console.log( `\n  ${ entries.length } log rows (kinds: ${ [ ...new Set( entries.map( ( e ) => e.kind ) ) ].join( ", " ) || "—" })` );
		expect( Array.isArray( jl ) ).toBe( true );
	} );

	it( "derives capabilities", async () => {
		const jc = await api.getControllerStatus();
		const jo = await api.getOptions();
		const caps = deriveCapabilities( jc, jo );
		console.log( `\n  caps: ${ JSON.stringify( caps ) }` );
		expect( caps.fwvCombined ).toBe( jo.fwv * 10 + ( jo.fwm || 0 ) );
	} );
} );

describe.runIf( !!base && process.env.OS_LIVE_WRITE === "1" )( "live device — reversible write proof", () => {
	it( "sets a rain delay, reads it back, then cancels (net no-op)", async () => {
		const before = await api.getControllerStatus();
		console.log( `\n  rd before=${ before.rd }` );
		await api.setRainDelayHours( 1 );
		const during = await api.getControllerStatus();
		console.log( `  rd after set=${ during.rd } (rdst=${ during.rdst })` );
		expect( during.rd ).toBe( 1 );
		await api.cancelRainDelay();
		const after = await api.getControllerStatus();
		console.log( `  rd after cancel=${ after.rd }` );
		expect( after.rd ).toBe( 0 ); // fully reversed
	} );
} );
