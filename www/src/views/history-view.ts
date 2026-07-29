import type { TelemetryPoint, RunLogPoint } from "../api/companion";
import { esc, emptyState, infoNote } from "../ui/help";

// Two samples per horizontal pixel retain narrow peaks without building an unbounded SVG path.
const MAX_SPARK_POINTS = 480;

/** Keep the endpoints plus each bucket's extrema, in source order. */
function downsample( values: number[], limit = MAX_SPARK_POINTS ): number[] {
	if ( values.length <= limit ) return values;
	if ( limit < 3 ) return [ values[ 0 ]!, values[ values.length - 1 ]! ].slice( 0, limit );
	const interior = values.length - 2;
	const buckets = Math.max( 1, Math.floor( ( limit - 2 ) / 2 ) );
	const sampled: number[] = [ values[ 0 ]! ];
	for ( let bucket = 0; bucket < buckets; bucket++ ) {
		const start = 1 + Math.floor( bucket * interior / buckets );
		const end = 1 + Math.floor( ( bucket + 1 ) * interior / buckets );
		let minIndex = start, maxIndex = start;
		for ( let i = start + 1; i < end; i++ ) {
			if ( values[ i ]! < values[ minIndex ]! ) minIndex = i;
			if ( values[ i ]! > values[ maxIndex ]! ) maxIndex = i;
		}
		if ( minIndex === maxIndex ) sampled.push( values[ minIndex ]! );
		else if ( minIndex < maxIndex ) sampled.push( values[ minIndex ]!, values[ maxIndex ]! );
		else sampled.push( values[ maxIndex ]!, values[ minIndex ]! );
	}
	sampled.push( values[ values.length - 1 ]! );
	return sampled;
}

/** Minimal inline-SVG sparkline from a series of numbers (no charting dependency, FR-21). */
function sparkline( values: number[], w = 240, h = 40 ): string {
	if ( values.length < 1 ) return "";
	let min = values[ 0 ]!, max = values[ 0 ]!;
	for ( let i = 1; i < values.length; i++ ) {
		if ( values[ i ]! < min ) min = values[ i ]!;
		if ( values[ i ]! > max ) max = values[ i ]!;
	}
	const visible = downsample( values ), span = max - min || 1;
	const step = visible.length > 1 ? w / ( visible.length - 1 ) : w;
	const pts = visible.map( ( v, i ) => `${ ( i * step ).toFixed( 1 ) },${ ( h - ( ( v - min ) / span ) * h ).toFixed( 1 ) }` ).join( " " );
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
		.map( ( [ s, n ] ) => `<tr><th scope="row">Station ${ esc( String( s + 1 ) ) }</th><td>${ esc( String( n ) ) }</td></tr>` ).join( "" );

	return `<section aria-label="History"><h2>History</h2>${ staleNote }` +
		`<h3>Water level <span class="muted">(${ telemetry.length } samples)</span></h3>` +
		`<div class="spark-wrap">${ sparkline( telemetry.map( ( t ) => t.waterLevel ) ) }</div>` +
		`<h3>Runs <span class="muted">(${ runs.length })</span></h3>` +
		( freqRows ? `<table class="status"><tbody>${ freqRows }</tbody></table>` : emptyState( "No runs in range" ) ) +
		`</section>`;
}
