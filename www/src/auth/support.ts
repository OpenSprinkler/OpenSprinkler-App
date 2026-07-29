import type { JoResponse } from "../api/types";

export const MODERN_MIN_FWV = 221;
export const MODERN_MIN_COMBINED_FWV = 2214;

/** Reject unsupported firmware before the modern app can ask for or transmit a password. */
export function assertModernPreflightVersion( fwv: unknown ): asserts fwv is number {
	if ( typeof fwv !== "number" || !Number.isSafeInteger( fwv ) || fwv < MODERN_MIN_FWV ) {
		throw new Error( "Unsupported controller firmware. Upgrade the controller or use the legacy UI." );
	}
}

/** Apply the authenticated storage-epoch/minor/fork gate before any modern controls are mounted. */
export function assertModernFirmwareSupport( jo: Pick<JoResponse, "fwv" | "fwm" | "fwf"> ): void {
	const combined = jo.fwv * 10 + jo.fwm;
	if ( jo.fwv !== MODERN_MIN_FWV || !Number.isSafeInteger( jo.fwm ) ||
		combined < MODERN_MIN_COMBINED_FWV || typeof jo.fwf !== "string" || !jo.fwf.startsWith( "kars85." ) ) {
		throw new Error( "Unsupported controller build. This dashboard requires firmware 2.2.1(4) or newer from the kars85 fork." );
	}
}
