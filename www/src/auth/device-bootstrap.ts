/**
 * Security boundary for a standalone controller-base handoff. A URL can choose where the app
 * connects, but it must not silently choose where a replayable controller credential is sent.
 */

export interface AuthorizedDeviceTargetOptions<T> {
	baseUrl: string;
	/** True only when this boot selected a freshly supplied URL target, not firmware or saved state. */
	confirmFreshTarget: boolean;
	firmwareVersion?: number;
	ignoresPassword?: number;
	confirm( message: string ): boolean;
	probe(): Promise<{ fwv: number; ipas?: number }>;
	validatePreflight( firmwareVersion: number ): void;
	login( firmwareVersion: number ): Promise<string>;
	/** Establish the authenticated client, load its options, and apply the authenticated build gate. */
	authenticate( details: { firmwareVersion: number; ignoresPassword?: number; pwHash?: string } ): Promise<T>;
	/** Persist only after authenticate() and its support validation have both succeeded. */
	persist?(): void;
}

export interface AuthorizedDeviceTarget<T> {
	firmwareVersion: number;
	ignoresPassword?: number;
	pwHash?: string;
	authenticated: T;
}

export function freshDeviceTargetConfirmation( baseUrl: string ): string {
	return `Connect to this OpenSprinkler controller?\n\n${ baseUrl }\n\n` +
		"Only continue if you trust this address. Your password-derived controller credential will be sent to this target.";
}

/** Confirm first, then probe/authenticate, and persist a fresh target only after full validation. */
export async function connectAuthorizedDeviceTarget<T>(
	options: AuthorizedDeviceTargetOptions<T>,
): Promise<AuthorizedDeviceTarget<T>> {
	if ( options.confirmFreshTarget && !options.confirm( freshDeviceTargetConfirmation( options.baseUrl ) ) ) {
		throw new Error( "Controller connection cancelled." );
	}

	let firmwareVersion = options.firmwareVersion;
	let ignoresPassword = options.ignoresPassword;
	if ( firmwareVersion === undefined || ignoresPassword === undefined ) {
		const probe = await options.probe();
		firmwareVersion ??= probe.fwv;
		ignoresPassword ??= probe.ipas;
	}
	options.validatePreflight( firmwareVersion );

	let pwHash: string | undefined;
	if ( ignoresPassword !== 1 ) pwHash = await options.login( firmwareVersion );
	const authenticated = await options.authenticate( { firmwareVersion, ignoresPassword, pwHash } );
	options.persist?.();
	return { firmwareVersion, ignoresPassword, pwHash, authenticated };
}
