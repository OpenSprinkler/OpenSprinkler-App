/**
 * Network settings — DHCP vs static (IP/gateway/DNS/subnet), HTTP port (hp0/hp1 low/high byte),
 * and NTP (enable + server IP). Writes via /co named keys. Static address octets are only sent
 * when DHCP is off (mirrors the legacy validation).
 */
import type { JoResponse } from "../../api/types";
import { textField, numberField, checkboxField, checkboxValue } from "../../ui/form";
import { infoNote } from "../../ui/help";
import { ipOctets } from "../../api/encode";

export type FormValues = Record<string, string | boolean >;

function dotted( a?: number, b?: number, c?: number, d?: number ): string {
	if ( [ a, b, c, d ].some( ( n ) => typeof n !== "number" ) ) return "";
	return `${ a }.${ b }.${ c }.${ d }`;
}

export function renderNetwork( jo: JoResponse ): string {
	const port = ( ( jo.hp1 ?? 0 ) << 8 ) | ( jo.hp0 ?? 80 );
	return `<section aria-label="Network settings"><h2>Network</h2>` +
		infoNote( "Static addresses are only applied when DHCP is off. Some changes require a reboot." ) +
		`<form class="settings" data-settings="network">` +
		checkboxField( "dhcp", "Use DHCP", jo.dhcp === 1, "Let the router assign the address automatically." ) +
		textField( "ip", "Static IP", dotted( jo.ip1, jo.ip2, jo.ip3, jo.ip4 ), { placeholder: "192.168.1.100" } ) +
		textField( "gw", "Gateway", dotted( jo.gw1, jo.gw2, jo.gw3, jo.gw4 ), { placeholder: "192.168.1.1" } ) +
		textField( "dns", "DNS", dotted( jo.dns1, jo.dns2, jo.dns3, jo.dns4 ), { placeholder: "8.8.8.8" } ) +
		textField( "subnet", "Subnet mask", dotted( jo.subn1, jo.subn2, jo.subn3, jo.subn4 ), { placeholder: "255.255.255.0" } ) +
		numberField( "port", "HTTP port", port, { min: 1, max: 65535 } ) +
		checkboxField( "ntp", "Sync time over NTP", jo.ntp === 1 ) +
		textField( "ntpServer", "NTP server IP", dotted( jo.ntp1, jo.ntp2, jo.ntp3, jo.ntp4 ), { placeholder: "(optional)" } ) +
		`<button type="submit" class="action primary" data-save="network">Save</button>` +
		`</form></section>`;
}

export function buildNetworkOptions( v: FormValues ): Record<string, string | number > {
	const dhcp = checkboxValue( v.dhcp, "DHCP" );
	const ntp = checkboxValue( v.ntp, "NTP" );
	const out: Record<string, string | number > = { dhcp: dhcp ? 1 : 0, ntp: ntp ? 1 : 0 };
	const rawPort = String( v.port ?? "" ).trim();
	if ( !/^\d+$/.test( rawPort ) ) throw new Error( "HTTP port must be a whole number." );
	const port = Number( rawPort );
	if ( !Number.isInteger( port ) || port < 1 || port > 65535 ) throw new Error( "HTTP port must be between 1 and 65535." );
	out.hp0 = port & 0xff;
	out.hp1 = ( port >> 8 ) & 0xff;
	const addOctets = ( prefix: string, label: string, dottedStr: unknown, required = false ): void => {
		if ( typeof dottedStr !== "string" || dottedStr.trim() === "" ) {
			if ( required ) throw new Error( `${ label } is required when DHCP is off.` );
			return;
		}
		let octets: [ number, number, number, number ];
		try { octets = ipOctets( dottedStr ); }
		catch ( e ) { throw new Error( `${ label }: ${ e instanceof Error ? e.message : String( e ) }` ); }
		const [ a, b, c, d ] = octets;
		out[ `${ prefix }1` ] = a; out[ `${ prefix }2` ] = b; out[ `${ prefix }3` ] = c; out[ `${ prefix }4` ] = d;
	};
	if ( !dhcp ) {
		addOctets( "ip", "Static IP", v.ip, true );
		addOctets( "gw", "Gateway", v.gw, true );
		addOctets( "dns", "DNS", v.dns );
		addOctets( "subn", "Subnet mask", v.subnet, true );
	}
	if ( ntp ) addOctets( "ntp", "NTP server", v.ntpServer );
	return out;
}
