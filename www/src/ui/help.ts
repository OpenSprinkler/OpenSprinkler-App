/**
 * Shared UI primitives for the novice-friendly layer (GitHub #4 / upstream #288–#292):
 * one HTML escaper, an accessible help/tooltip affordance, and friendly empty-states.
 *
 * Framework-free on purpose (matches the read-only views); everything returns an HTML string
 * so it stays trivially unit-testable. Accessibility (WCAG-AA, PRD): the help text lives in an
 * `aria-label` (announced by screen readers) and `title` (pointer tooltip), and the affordance is
 * keyboard-focusable (`tabindex="0"`).
 */

/**
 * HTML-escape text for safe interpolation into innerHTML. Coerces with String() first so a
 * non-string value from the tolerant device parsers renders harmlessly instead of throwing
 * (the parsers don't guarantee dname/mac are strings).
 */
export function esc( s: string ): string {
	return String( s ).replace( /[&<>"]/g, ( c ) => ( { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } )[ c ]! );
}

/**
 * A small, accessible "ⓘ" help affordance carrying inline context for novices. The help text is
 * the affordance's accessible name (`aria-label`, announced by screen readers) AND a visible bubble
 * revealed on BOTH pointer hover and keyboard focus (WCAG 2.1.1 / 1.4.13 — keyboard parity, not a
 * hover/`title`-only tooltip). The icon + bubble are aria-hidden so AT reads the label once.
 */
export function helpTip( help: string ): string {
	const h = esc( help );
	return `<span class="help-tip" role="img" tabindex="0" aria-label="${ h }">` +
		`<span class="help-icon" aria-hidden="true">ⓘ</span>` +
		`<span class="help-bubble" aria-hidden="true">${ h }</span></span>`;
}

/** A label followed by an inline help tip — e.g. a table row header that needs explaining. */
export function labelWithHelp( label: string, help: string ): string {
	return `${ esc( label ) } ${ helpTip( help ) }`;
}

/** A decorative droplet mark for empty-states (aria-hidden — the message text carries meaning). */
function emptyMark(): string {
	return `<svg class="i-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
		`stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
		`<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>`;
}

/**
 * Friendly empty-state replacing a bare/blank/"[]" rendering (upstream #289). `message` is the
 * primary line; optional `hint` is a quieter explanatory sentence. A decorative droplet leads the row.
 */
export function emptyState( message: string, hint?: string ): string {
	return `<p class="empty-state">${ emptyMark() }<span class="empty-msg">${ esc( message ) }` +
		( hint ? ` <span class="muted">${ esc( hint ) }</span>` : "" ) + `</span></p>`;
}

/** A short muted note used to introduce/explain a section to non-experts (discoverability #292). */
export function infoNote( text: string ): string {
	return `<p class="info-note muted">${ esc( text ) }</p>`;
}

/**
 * An accessible error panel (`role="alert"`) with a retry affordance, for a failed boot/refresh.
 * The alert/warning glyph is decorative; the title + detail text carry the meaning. The retry
 * button is wired in views/host.ts (a `retry` action → refresh).
 */
export function errorCard( detail: string ): string {
	return `<div class="error-card" role="alert">` +
		`<div class="error-title">` +
		`<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
		`stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
		`<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/></svg>` +
		`<span>Couldn't reach the controller</span></div>` +
		`<p class="error-detail">${ esc( detail ) }</p>` +
		`<button class="action primary" type="button" data-action="retry">Retry</button></div>`;
}
