/** Interval poller: first-poll-on-boot, no overlap, error-survival (FR-3/8/9). */
export class Poller {
	lastError: string | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private current: Promise<void> | null = null;
	private currentAbort: AbortController | null = null;
	private acceptingCycles = true;

	constructor( private readonly cycle: ( signal: AbortSignal ) => Promise<void>, private readonly intervalSec: number ) {}

	/** Run one cycle now; skips if one is already in flight (FR-8). Records lastError (FR-9). */
	async runNow(): Promise<void> {
		if ( !this.acceptingCycles || this.current ) return;
		const abort = new AbortController();
		this.currentAbort = abort;
		// Defer the callback one microtask so `current` is installed before user code can re-enter runNow().
		const current = Promise.resolve().then( () => this.runCycle( abort.signal ) );
		this.current = current;
		try { await current; }
		finally {
			if ( this.current === current ) {
				this.current = null;
				this.currentAbort = null;
			}
		}
	}

	private async runCycle( signal: AbortSignal ): Promise<void> {
		if ( signal.aborted ) return;
		try { await this.cycle( signal ); this.lastError = null; }
		catch ( e ) {
			if ( signal.aborted ) return;
			this.lastError = publicCycleError( e );
			// Never inspect/log the error object: ApiError.raw and JSON SyntaxError messages can contain
			// fragments of credential-bearing controller responses.
			console.error( `[poller] ${ this.lastError }` );
		}
	}

	/** Start: normally run immediately (FR-3), then every interval. */
	start( runImmediately = true ): void {
		if ( !this.acceptingCycles || this.timer ) return;
		if ( runImmediately ) void this.runNow();
		this.timer = setInterval( () => void this.runNow(), this.intervalSec * 1000 );
	}

	async stop( timeoutMs?: number ): Promise<void> {
		// Terminally reject new cycles before clearing the interval. A timer callback that was already
		// queued can otherwise start after shutdown observed `current === null` and closed storage.
		this.acceptingCycles = false;
		if ( this.timer ) clearInterval( this.timer );
		this.timer = null;
		this.currentAbort?.abort();
		const current = this.current;
		if ( !current ) return;
		if ( timeoutMs === undefined ) { await current; return; }
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race( [ current, new Promise<never>( ( _resolve, reject ) => {
				timer = setTimeout( () => reject( new Error( `poller drain timed out after ${ timeoutMs }ms` ) ), timeoutMs );
			} ) ] );
		} finally { if ( timer !== undefined ) clearTimeout( timer ); }
	}
}

/** Stable, bounded categories safe for logs and the public health response. */
function publicCycleError( error: unknown ): string {
	const name = error instanceof Error ? error.name : "";
	if ( name === "ControllerAuthError" ) return "controller authentication failed";
	if ( name === "ApiError" || name === "ControllerResponseError" || name === "SyntaxError" ) {
		return "controller response invalid";
	}
	if ( name === "TypeError" ) return "controller request failed";
	if ( name === "SqliteError" ) return "database operation failed";
	if ( name === "CollectionCycleError" ) return "controller collection failed";
	return "poll cycle failed";
}
