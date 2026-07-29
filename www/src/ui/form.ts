/**
 * Tiny framework-free form primitives for the Settings/editor views: render labeled inputs as
 * HTML strings, and read a rendered form's values back by `name`. Keeping render + read here lets
 * each settings view stay a pure string renderer while the host does one `readForm()` call.
 */
import { esc, helpTip } from "./help";

function labelHtml( name: string, label: string, help?: string ): string {
	return `<label for="f-${ esc( name ) }">${ esc( label ) }${ help ? " " + helpTip( help ) : "" }</label>`;
}

export function textField(
	name: string,
	label: string,
	value = "",
	opts: {
		help?: string; placeholder?: string; type?: "text" | "time" | "date";
		required?: boolean; pattern?: string; maxLength?: number;
	} = {},
): string {
	return `<div class="field">${ labelHtml( name, label, opts.help ) }` +
		`<input type="${ opts.type ?? "text" }" id="f-${ esc( name ) }" name="${ esc( name ) }" value="${ esc( value ) }"` +
		( opts.placeholder ? ` placeholder="${ esc( opts.placeholder ) }"` : "" ) +
		( opts.pattern ? ` pattern="${ esc( opts.pattern ) }"` : "" ) +
		( opts.maxLength === undefined ? "" : ` maxlength="${ opts.maxLength }"` ) +
		( opts.required ? " required" : "" ) + `></div>`;
}

export function numberField( name: string, label: string, value: number | string = "", opts: {
	min?: number; max?: number; step?: number; help?: string; disabled?: boolean;
} = {} ): string {
	const attr = ( k: string, v?: number ): string => ( v === undefined ? "" : ` ${ k }="${ v }"` );
	return `<div class="field">${ labelHtml( name, label, opts.help ) }` +
		`<input type="number" id="f-${ esc( name ) }" name="${ esc( name ) }" value="${ esc( String( value ) ) }"` +
		attr( "min", opts.min ) + attr( "max", opts.max ) + attr( "step", opts.step ) +
		( opts.disabled ? ` disabled data-form-disabled="true"` : "" ) + `></div>`;
}

export function checkboxField( name: string, label: string, checked: boolean, help?: string ): string {
	return `<div class="field field-check">` +
		`<input type="checkbox" id="f-${ esc( name ) }" name="${ esc( name ) }"${ checked ? " checked" : "" }>` +
		`<label for="f-${ esc( name ) }">${ esc( label ) }${ help ? " " + helpTip( help ) : "" }</label></div>`;
}

export interface SelectOption { value: string | number; label: string; }

export function selectField( name: string, label: string, options: SelectOption[], value: string | number, help?: string ): string {
	const opts = options.map( ( o ) =>
		`<option value="${ esc( String( o.value ) ) }"${ String( o.value ) === String( value ) ? " selected" : "" }>${ esc( o.label ) }</option>`
	).join( "" );
	return `<div class="field">${ labelHtml( name, label, help ) }` +
		`<select id="f-${ esc( name ) }" name="${ esc( name ) }">${ opts }</select></div>`;
}

/** Read every named control inside `root` into a flat map (checkbox → boolean, else string value). */
export function readForm( root: ParentNode ): Record<string, string | boolean> {
	const out: Record<string, string | boolean> = {};
	root.querySelectorAll<HTMLInputElement | HTMLSelectElement>( "[name]" ).forEach( ( el ) => {
		if ( el.disabled ) return;
		if ( el instanceof HTMLInputElement && el.type === "checkbox" ) out[ el.name ] = el.checked;
		else out[ el.name ] = el.value;
	} );
	return out;
}

/** Accept an actual checkbox value (or an omitted optional field), never string truthiness. */
export function checkboxValue( value: unknown, label: string ): boolean {
	if ( value === undefined ) return false;
	if ( typeof value !== "boolean" ) throw new Error( `${ label } must be a checkbox value.` );
	return value;
}

/** Coerce a read value to an integer, falling back to `fallback`. */
export function toInt( v: string | boolean | undefined, fallback = 0 ): number {
	const n = parseInt( String( v ), 10 );
	return Number.isFinite( n ) ? n : fallback;
}
