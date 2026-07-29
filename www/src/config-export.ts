/**
 * Read-only, schema-versioned controller export. This deliberately uses an allowlist: controller
 * password hashes, API/provider keys, OTC tokens, special-station definitions, hosts, URLs, MAC/IP
 * addresses, and opaque future fields never enter the export object.
 */
import type { JcResponse, JeResponse, JnResponse, JoResponse, JpResponse, OSProgram } from "./api/types";

export const CONFIG_EXPORT_SCHEMA = "opensprinkler.configuration";
export const CONFIG_EXPORT_VERSION = 1;

export interface ConfigurationExportSource {
	jc: JcResponse;
	jo: JoResponse;
	jn: JnResponse;
	je: JeResponse;
	jp: JpResponse;
}

export interface ConfigurationExportV1 {
	schema: typeof CONFIG_EXPORT_SCHEMA;
	version: typeof CONFIG_EXPORT_VERSION;
	exportedAtControllerEpoch: number;
	controller: {
		name: string;
		location: string;
		enabled: boolean;
		firmware: { fwv: number; fwm: number; fwf?: string; hardware: number };
	};
	options: Record<string, number | number[]>;
	stations: {
		names: string[];
		disabled: number[];
		ignoreRain: number[];
		ignoreSensor1: number[];
		ignoreSensor2: number[];
		groups: number[];
		specialTypes: Record<string, number>;
	};
	programs: {
		limits: { maxPrograms: number; maxStartTimes: number; nameBytes: number };
		tuples: OSProgram[];
	};
}

const SAFE_NUMERIC_OPTIONS = [
	"tz", "ntp", "dhcp", "hp0", "hp1", "sdt", "mas", "mton", "mtof", "mas2", "mton2", "mtof2",
	"wl", "uwt", "den", "lg", "dim", "sar", "ife", "ife2", "sn1t", "sn1o", "sn1on", "sn1of",
	"sn2t", "sn2o", "sn2on", "sn2of", "fpr0", "fpr1", "ext", "bst", "laton", "latof", "tpdv",
	"imin", "imax", "fwire",
] as const;

function cloneProgram( program: OSProgram ): OSProgram {
	return [
		program[ 0 ], program[ 1 ], program[ 2 ], [ ...program[ 3 ] ], [ ...program[ 4 ] ], program[ 5 ],
		[ ...program[ 6 ] ] as OSProgram[ 6 ],
	];
}

function safeOptions( jo: JoResponse ): Record<string, number | number[]> {
	const options: Record<string, number | number[]> = {};
	for ( const key of SAFE_NUMERIC_OPTIONS ) {
		const value = jo[ key ];
		if ( typeof value === "number" && Number.isFinite( value ) ) options[ key ] = value;
	}
	if ( Array.isArray( jo.ms ) && jo.ms.every( Number.isFinite ) ) options.ms = [ ...jo.ms ];
	return options;
}

/** Build a detached snapshot containing only the stable, documented, non-secret schema. */
export function buildConfigurationExport( source: ConfigurationExportSource ): ConfigurationExportV1 {
	const specialTypes: Record<string, number> = {};
	for ( const [ station, definition ] of Object.entries( source.je ) ) specialTypes[ station ] = definition.st;
	return {
		schema: CONFIG_EXPORT_SCHEMA,
		version: CONFIG_EXPORT_VERSION,
		exportedAtControllerEpoch: source.jc.devt,
		controller: {
			name: source.jc.dname,
			location: source.jc.loc,
			enabled: source.jc.en === 1,
			firmware: {
				fwv: source.jo.fwv, fwm: source.jo.fwm, hardware: source.jo.hwv,
				...( source.jo.fwf ? { fwf: source.jo.fwf } : {} ),
			},
		},
		options: safeOptions( source.jo ),
		stations: {
			names: [ ...source.jn.snames ],
			disabled: [ ...source.jn.stn_dis ],
			ignoreRain: [ ...source.jn.ignore_rain ],
			ignoreSensor1: [ ...source.jn.ignore_sn1 ],
			ignoreSensor2: [ ...source.jn.ignore_sn2 ],
			groups: [ ...source.jn.stn_grp ],
			specialTypes,
		},
		programs: {
			limits: { maxPrograms: source.jp.mnp, maxStartTimes: source.jp.mnst, nameBytes: source.jp.pnsize },
			tuples: source.jp.pd.map( cloneProgram ),
		},
	};
}

export function serializeConfigurationExport( source: ConfigurationExportSource ): string {
	return JSON.stringify( buildConfigurationExport( source ), null, 2 ) + "\n";
}

export function configurationExportFilename( controllerName: string ): string {
	const slug = controllerName.trim().toLowerCase().replace( /[^a-z0-9]+/g, "-" ).replace( /^-|-$/g, "" );
	return `opensprinkler-${ slug || "controller" }-configuration-v${ CONFIG_EXPORT_VERSION }.json`;
}

export type ConfigurationExportDelivery = "shared" | "downloaded";

/** Prefer the native share sheet (iPhone); fall back to a normal browser download. */
export async function deliverConfigurationExport(
	source: ConfigurationExportSource,
	environment: {
		navigator?: Pick<Navigator, "canShare" | "share">;
		document?: Document;
		url?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
	} = {},
): Promise<ConfigurationExportDelivery> {
	const nav = environment.navigator ?? globalThis.navigator;
	const doc = environment.document ?? globalThis.document;
	const url = environment.url ?? globalThis.URL;
	const name = configurationExportFilename( source.jc.dname );
	const json = serializeConfigurationExport( source );
	const file = new File( [ json ], name, { type: "application/json" } );
	if ( typeof nav.canShare === "function" && typeof nav.share === "function" && nav.canShare( { files: [ file ] } ) ) {
		await nav.share( { title: "OpenSprinkler configuration", files: [ file ] } );
		return "shared";
	}
	const href = url.createObjectURL( file );
	const anchor = doc.createElement( "a" );
	anchor.href = href;
	anchor.download = name;
	anchor.hidden = true;
	doc.body.appendChild( anchor );
	try { anchor.click(); }
	finally {
		anchor.remove();
		url.revokeObjectURL( href );
	}
	return "downloaded";
}
