/**
 * Forecast graphics — a dependency-free inline-SVG daily chart (high/low temperature ranges +
 * rain bars) and the OWM-code weather glyphs. LAN bundle constraint (system.css doctrine): no
 * chart library, no raster assets, currentColor/CSS-token SVG only.
 *
 * Two single-series panels share one day axis — never a dual-axis chart. Every mark is
 * direct-labeled; the verbose day cards under the chart are the accessible table equivalent.
 * Bar colors live in system.css (.fc-temp / .fc-precip, validated for both themes).
 */
import { esc } from "./help";

/** Chart geometry (viewBox units). */
const COL_W = 64, PAD_X = 10, TEMP_TOP = 26, TEMP_H = 110, PANEL_GAP = 40, PRECIP_H = 56;
const PRECIP_TOP = TEMP_TOP + TEMP_H + PANEL_GAP;
const DAY_LABEL_Y = PRECIP_TOP + PRECIP_H + 18;
const HEIGHT = DAY_LABEL_Y + 10;

export interface ForecastChartDay {
	label: string;
	temp_min: number;
	temp_max: number;
	precip: number;
	description: string;
}

/** A rect with only its top corners rounded (baseline-anchored bars keep a flat data-start). */
function topRoundedBar( x: number, y: number, w: number, h: number, r: number, cls: string ): string {
	const radius = Math.min( r, h / 2, w / 2 );
	return `<path class="${ cls }" d="M${ x },${ y + h } v${ -( h - radius ) } q0,-${ radius } ${ radius },-${ radius } ` +
		`h${ w - 2 * radius } q${ radius },0 ${ radius },${ radius } v${ h - radius } z"/>`;
}

function round1( n: number ): number { return Math.round( n * 10 ) / 10; }
function round2( n: number ): number { return Math.round( n * 100 ) / 100; }

/**
 * Render the daily forecast chart as an SVG string: one temperature-range panel (°F) and one
 * rain panel (in), direct-labeled, native hover tooltips via <title>.
 */
export function renderForecastChart( days: ForecastChartDay[] ): string {
	if ( days.length === 0 ) return "";
	const width = PAD_X * 2 + days.length * COL_W;

	let tempLo = Math.min( ...days.map( ( d ) => d.temp_min ) );
	let tempHi = Math.max( ...days.map( ( d ) => d.temp_max ) );
	if ( tempHi - tempLo < 10 ) { const mid = ( tempHi + tempLo ) / 2; tempLo = mid - 5; tempHi = mid + 5; }
	const tempY = ( t: number ): number => TEMP_TOP + ( tempHi - t ) / ( tempHi - tempLo ) * TEMP_H;
	// A 0.25 in floor keeps a drizzle from filling the panel.
	const precipMax = Math.max( 0.25, ...days.map( ( d ) => d.precip ) );

	const columns = days.map( ( day, i ) => {
		const cx = PAD_X + i * COL_W + COL_W / 2;
		const yHi = tempY( day.temp_max ), yLo = tempY( day.temp_min );
		const barH = Math.max( 8, yLo - yHi );
		const rainH = day.precip > 0 ? Math.max( 3, day.precip / precipMax * PRECIP_H ) : 0;
		const rain = round2( day.precip );
		const tempBar = `<rect class="fc-temp" x="${ cx - 7 }" y="${ yHi }" width="14" height="${ barH }" rx="4"/>` +
			`<text class="fc-val" x="${ cx }" y="${ yHi - 6 }" text-anchor="middle">${ round1( day.temp_max ) }°</text>` +
			`<text class="fc-val fc-lo" x="${ cx }" y="${ yHi + barH + 14 }" text-anchor="middle">${ round1( day.temp_min ) }°</text>`;
		const rainBar = rainH > 0
			? topRoundedBar( cx - 9, PRECIP_TOP + PRECIP_H - rainH, 18, rainH, 3, "fc-precip" ) +
				`<text class="fc-val" x="${ cx }" y="${ PRECIP_TOP + PRECIP_H - rainH - 5 }" text-anchor="middle">${ rain }</text>`
			: `<text class="fc-val fc-lo" x="${ cx }" y="${ PRECIP_TOP + PRECIP_H - 5 }" text-anchor="middle">0</text>`;
		const title = `${ day.label }: high ${ round1( day.temp_max ) }°F, low ${ round1( day.temp_min ) }°F, ` +
			`rain ${ rain } in — ${ day.description }`;
		return `<g><title>${ esc( title ) }</title>${ tempBar }${ rainBar }` +
			`<text class="fc-day" x="${ cx }" y="${ DAY_LABEL_Y }" text-anchor="middle">${ esc( day.label ) }</text></g>`;
	} ).join( "" );

	const baseline = `<line class="fc-axis" x1="${ PAD_X }" y1="${ PRECIP_TOP + PRECIP_H }" ` +
		`x2="${ width - PAD_X }" y2="${ PRECIP_TOP + PRECIP_H }"/>`;
	const label = days.map( ( d ) =>
		`${ d.label } high ${ round1( d.temp_max ) }, low ${ round1( d.temp_min ) } degrees, rain ${ round2( d.precip ) } inches` ).join( "; " );
	return `<svg class="forecast-chart" viewBox="0 0 ${ width } ${ HEIGHT }" role="img" ` +
		`aria-label="Daily forecast: ${ esc( label ) }">` +
		`<text class="fc-title" x="${ PAD_X }" y="12">High / Low (°F)</text>` +
		`<text class="fc-title" x="${ PAD_X }" y="${ PRECIP_TOP - 8 }">Rain (in)</text>` +
		`${ baseline }${ columns }</svg>`;
}

/** OWM-style icon code → decorative inline glyph (single-stroke, currentColor, aria-hidden). */
export function weatherIconSvg( icon: string ): string {
	const code = String( icon || "" ).replace( /[^a-zA-Z0-9_-]/g, "" ).slice( 0, 2 );
	const sun = `<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>`;
	const cloud = `<path d="M17.5 18a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 18z"/>`;
	const sunCloud = `<circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v2M1.5 8h2M3.5 3.5l1.4 1.4M12.5 3.5l-1.4 1.4"/>` +
		`<path d="M18 20a4 4 0 0 0 0-8 5.3 5.3 0 0 0-10.2 1.3A3.1 3.1 0 0 0 8.3 20z"/>`;
	const rain = `<path d="M17.5 15a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 15z"/>` +
		`<path d="M8 18v2.5M12 18.5v2.5M16 18v2.5"/>`;
	const storm = `<path d="M17.5 15a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 15z"/><path d="M12.5 15l-2.5 4h3l-2 4"/>`;
	const snow = `<path d="M17.5 15a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 15z"/>` +
		`<path d="M8 18.5h.01M12 20h.01M16 18.5h.01"/>`;
	const mist = `<path d="M4 9h16M6 13h13M4 17h14"/>`;
	const paths: Record<string, string> = {
		"01": sun, "02": sunCloud, "03": cloud, "04": cloud,
		"09": rain, "10": rain, "11": storm, "13": snow, "50": mist,
	};
	return `<svg class="i-weather" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
		`stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ paths[ code ] ?? cloud }</svg>`;
}
