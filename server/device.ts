import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import type { JcResponse } from "../www/src/api/types";
import { md5 } from "../www/src/auth/md5";

export interface DeviceClientConfig {
	controllerBase: string;
	controllerPw?: string;
	controllerFwv?: number;
	controllerTimeoutMs?: number;
}

export class ControllerAuthError extends Error {
	constructor( message = "controller authentication failed" ) { super( message ); this.name = "ControllerAuthError"; }
}

/**
	* Probe, authenticate using the firmware-version protocol, and validate one authenticated read.
	* Every request is bounded so a controller outage cannot wedge startup or the poller indefinitely.
	*/
export async function createDeviceClient(
	cfg: DeviceClientConfig, signal?: AbortSignal,
): Promise<{ client: OsApiClient; fwv: number; status: JcResponse }> {
	const base = cfg.controllerBase.endsWith( "/" ) ? cfg.controllerBase : cfg.controllerBase + "/";
	const timeoutMs = cfg.controllerTimeoutMs ?? 10000;
	const probeSeam = new BrowserDeviceSeam( {
		baseUrl: base, pwHash: "", ver: cfg.controllerFwv, requestTimeoutMs: timeoutMs,
	} );
	const raw = await probeSeam.requestJson( "jo", signal );
	const options = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
	const probedFwv = typeof options.fwv === "number" && Number.isSafeInteger( options.fwv ) && options.fwv > 0
		? options.fwv : undefined;
	if ( cfg.controllerFwv !== undefined && probedFwv !== undefined && cfg.controllerFwv !== probedFwv ) {
		throw new Error( `configured controller firmware does not match the pre-auth probe (${ cfg.controllerFwv } != ${ probedFwv })` );
	}
	// A valid value reported by the controller is authoritative for the authentication protocol.
	// The explicit override exists only for legacy responses that omit fwv entirely.
	const fwv = probedFwv ?? cfg.controllerFwv ?? 0;
	if ( !Number.isInteger( fwv ) || fwv <= 0 ) throw new Error( "controller /jo response did not include a valid firmware version" );

	const ipas = options.ipas === 1;
	let pwHash = "";
	if ( !ipas && cfg.controllerPw ) {
		// /jo is unauthenticated. Never let an on-path response downgrade a modern controller's
		// password to the pre-2.1.3 cleartext protocol unless the operator explicitly pinned that
		// exact legacy firmware version in trusted local configuration.
		if ( fwv < 213 && cfg.controllerFwv !== fwv ) {
			throw new ControllerAuthError(
				`refusing unpinned legacy cleartext authentication; set CONTROLLER_FWV=${ fwv } only after verifying the controller firmware`,
			);
		}
		const auth = await probeSeam.authenticate( cfg.controllerPw, fwv, md5, signal );
		if ( !auth.ok ) throw new ControllerAuthError();
		pwHash = auth.pwHash;
	}

	const seam = new BrowserDeviceSeam( {
		baseUrl: base, pwHash, ver: fwv, ipas: ipas ? 1 : 0, requestTimeoutMs: timeoutMs,
	} );
	const client = new OsApiClient( seam );
	let status: JcResponse;
	try { status = await client.getControllerStatus( signal ); }
	catch ( error ) {
		if ( !ipas && !cfg.controllerPw ) throw new ControllerAuthError( "controller password is required" );
		throw error;
	}
	return { client, fwv, status };
}
