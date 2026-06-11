/** Interval poller: first-poll-on-boot, no overlap, error-survival (FR-3/8/9). */
export class Poller {
	lastError: string | null = null;
	private running = false;
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor( private readonly cycle: () => Promise<void>, private readonly intervalSec: number ) {}

	/** Run one cycle now; skips if one is already in flight (FR-8). Records lastError (FR-9). */
	async runNow(): Promise<void> {
		if ( this.running ) return;
		this.running = true;
		try { await this.cycle(); this.lastError = null; }
		catch ( e ) { this.lastError = String( e ); console.error( "[poller] cycle failed:", e ); }
		finally { this.running = false; }
	}

	/** Start: run immediately, then every interval (FR-3). */
	start(): void {
		void this.runNow();
		this.timer = setInterval( () => void this.runNow(), this.intervalSec * 1000 );
	}

	stop(): void { if ( this.timer ) clearInterval( this.timer ); this.timer = null; }
}
