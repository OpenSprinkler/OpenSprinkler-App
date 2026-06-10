import type { TelemetryPoint, RunLogPoint } from "../api/companion";
import { esc, emptyState, infoNote } from "../ui/help";

/** Minimal inline-SVG sparkline from a series of numbers (no charting dependency, FR-21). */
function sparkline( values: number[], w = 240, h = 40 ): string {
	if ( values.length < 1 ) return "";
	const min = Math.min( ...values ), max = Math.max( ...values ), span = max - min || 1;
	const step = values.length > 1 ? w / ( values.length - 1 ) : w;
	const pts = values.map( ( v, i ) => `${ ( i * step ).toFixed( 1 ) },${ ( h - ( ( v - min ) / span ) * h ).toFixed( 1 ) }` ).join( " " );
	return `<svg class="spark" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }" role="img" aria-label="trend">` +
		`<polyline fill="none" stroke="currentColor" stroke-width="2" points="${ pts }"></polyline></svg>`;
}

export function renderHistory( telemetry: TelemetryPoint[], runs: RunLogPoint[], opts: { stale: boolean } ): string {
	if ( telemetry.length === 0 && runs.length === 0 ) {
		return `<section aria-label="History"><h2>History</h2>` +
			( opts.stale ? infoNote( "Collector data may be stale — the companion isn't updating." ) : "" ) +
			emptyState( "No history yet", "The companion collects telemetry every few minutes; check back soon." ) +
			`</section>`;
	}
	const staleNote = opts.stale ? infoNote( "Data may be stale — the collector isn't updating." ) : "";

	// run frequency per station
	const freq = new Map<number, number>();
	for ( const r of runs ) freq.set( r.station, ( freq.get( r.station ) ?? 0 ) + 1 );
	const freqRows = [ ...freq.entries() ].sort( ( a, b ) => a[ 0 ] - b[ 0 ] )
		.map( ( [ s, n ] ) => `<tr><th scope="row">Station ${ s + 1 }</th><td>${ n }</td></tr>` ).join( "" );

	return `<section aria-label="History"><h2>History</h2>${ staleNote }` +
		`<h3>Water level <span class="muted">(${ telemetry.length } samples)</span></h3>` +
		`<div class="spark-wrap">${ sparkline( telemetry.map( ( t ) => t.waterLevel ) ) }</div>` +
		`<h3>Runs <span class="muted">(${ runs.length })</span></h3>` +
		( freqRows ? `<table class="status"><tbody>${ freqRows }</tbody></table>` : emptyState( "No runs in range" ) ) +
		`</section>`;
}
