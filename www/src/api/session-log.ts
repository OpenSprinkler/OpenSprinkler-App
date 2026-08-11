/**
 * Events THIS app instance observed directly (weather fetches, service failures).
 * The firmware /jl history is the controller's record; these are the browser's own
 * verified observations, merged into the Log view for the current session only.
 * Ring-buffered and cleared by page load by construction — nothing here claims
 * to be a durable history (that is the companion server's job).
 */
export type SessionLogLevel = "normal" | "detail" | "debug";

export interface SessionLogEvent {
	/** True UTC epoch ms at the moment of observation (browser clock). */
	whenMs: number;
	/** Badge text, e.g. "Weather". */
	label: string;
	level: SessionLogLevel;
	detail: string;
}

const MAX_EVENTS = 100;
const events: SessionLogEvent[] = [];

export function recordSessionEvent( level: SessionLogLevel, label: string, detail: string ): void {
	events.push( { whenMs: Date.now(), level, label, detail } );
	if ( events.length > MAX_EVENTS ) events.shift();
}

/** Newest first, matching the Log view's ordering. */
export function sessionLogEvents(): SessionLogEvent[] {
	return [ ...events ].reverse();
}

export function clearSessionLog(): void {
	events.length = 0;
}
