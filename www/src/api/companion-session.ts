export interface CompanionSession {
	base: string;
	token?: string;
}

export interface SessionStore {
	getItem( key: string ): string | null;
	setItem( key: string, value: string ): void;
	removeItem( key: string ): void;
}

const SESSION_KEY = "opensprinkler.companion";
const LEGACY_KEYS = [ "opensprinkler.companionBase", "opensprinkler.companionToken" ];

export function loadCompanionSession( storage: SessionStore ): CompanionSession | undefined {
	try {
		const raw = storage.getItem( SESSION_KEY );
		if ( !raw ) return undefined;
		const value = JSON.parse( raw ) as unknown;
		if ( typeof value !== "object" || value === null ) return undefined;
		const candidate = value as Record<string, unknown>;
		if ( typeof candidate.base !== "string" || candidate.base === "" ) return undefined;
		if ( candidate.token !== undefined && typeof candidate.token !== "string" ) return undefined;
		return { base: candidate.base, ...( candidate.token ? { token: candidate.token } : {} ) };
	} catch { return undefined; }
}

/** Select a base/token pair without ever carrying a saved token across a base change. */
export function selectCompanionSession(
	defaultBase: string,
	configured: { base?: string; token?: string },
	saved?: CompanionSession,
): CompanionSession {
	// A newly supplied token without an explicitly paired base belongs to this application's
	// default companion origin. Never let a stale saved base redirect a fresh credential.
	const base = configured.base ?? ( configured.token ? defaultBase : saved?.base ?? defaultBase );
	const token = configured.token ?? ( saved?.base === base ? saved.token : undefined );
	return { base, ...( token ? { token } : {} ) };
}

export function saveCompanionSession( storage: SessionStore, value: CompanionSession ): void {
	try {
		storage.setItem( SESSION_KEY, JSON.stringify( value ) );
		for ( const key of LEGACY_KEYS ) storage.removeItem( key );
	} catch { /* session storage may be disabled */ }
}

export function clearCompanionSession( storage: SessionStore ): void {
	try {
		storage.removeItem( SESSION_KEY );
		for ( const key of LEGACY_KEYS ) storage.removeItem( key );
	} catch { /* session storage may be disabled */ }
}
