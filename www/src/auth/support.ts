import type { JoResponse } from "../api/types";

export const MODERN_MIN_FWV = 221;
export const MODERN_MIN_COMBINED_FWV = 2214;

export type ModernPreflightPolicy = "unsupported" | "hash-authentication";

/** Map untrusted pre-auth `fwv` data to the only two modern-client policies. */
export function modernPreflightPolicy( fwv: unknown ): ModernPreflightPolicy {
	return typeof fwv === "number" && Number.isSafeInteger( fwv ) && fwv >= MODERN_MIN_FWV
		? "hash-authentication"
		: "unsupported";
}

/** Reject unsupported firmware before the modern app can ask for or transmit a password. */
export function assertModernPreflightVersion( fwv: unknown ): asserts fwv is number {
	if ( modernPreflightPolicy( fwv ) === "unsupported" ) {
		throw new Error( "Unsupported controller firmware. Upgrade the controller or use the legacy UI." );
	}
}

/** Apply the authenticated storage-epoch/minor/fork gate before any modern controls are mounted. */
export function assertModernFirmwareSupport( jo: Partial<Pick<JoResponse, "fwv" | "fwm" | "fwf">> ): void {
	assertModernPreflightVersion( jo.fwv );
	if ( Object.keys( jo ).length === 1 && Object.prototype.hasOwnProperty.call( jo, "fwv" ) ) {
		throw new Error( "Controller authentication required or failed." );
	}
	const combined = jo.fwv * 10 + Number( jo.fwm );
	if ( jo.fwv !== MODERN_MIN_FWV || !Number.isSafeInteger( jo.fwm ) ||
		combined < MODERN_MIN_COMBINED_FWV || typeof jo.fwf !== "string" || !jo.fwf.startsWith( "kars85." ) ) {
		throw new Error( "Unsupported controller build. This dashboard requires firmware 2.2.1(4) or newer from the kars85 fork." );
	}
}
