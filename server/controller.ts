import { createHash } from "node:crypto";
import type { OsApiClient } from "../www/src/api/client";
import type { JcResponse } from "../www/src/api/types";
import { collectOnce, type CollectResult } from "./collect";
import { createDeviceClient, type DeviceClientConfig } from "./device";
import type { StorageProvider } from "./storage/provider";

export interface ControllerCollectorConfig extends DeviceClientConfig {
	controllerId?: string;
	logBackfillDays: number;
}

export type DeviceClientFactory = ( cfg: DeviceClientConfig, signal?: AbortSignal ) => Promise<{
	client: OsApiClient;
	fwv: number;
	status: JcResponse;
}>;

export class CollectionCycleError extends Error {
	constructor( readonly errors: string[] ) {
		super( errors.join( "; " ) );
		this.name = "CollectionCycleError";
	}
}

export function fallbackControllerId( controllerBase: string ): string {
	const digest = createHash( "sha256" ).update( controllerBase ).digest( "hex" ).slice( 0, 20 );
	return `base:${ digest }`;
}

/** A stable operational label that never exposes an OTC path token or controller identifier. */
export function controllerLogSummary( controllerBase: string, controllerId: string ): string {
	const origin = new URL( controllerBase ).origin;
	const idHash = createHash( "sha256" ).update( controllerId ).digest( "hex" ).slice( 0, 12 );
	return `${ origin } (idHash=${ idHash })`;
}

/** Owns retryable device acquisition and resolves the controller identity before the first write. */
export class ControllerCollector {
	private client: OsApiClient | null = null;
	private identityResolved: boolean;
	private readonly fallbackId: string;

	constructor(
		private readonly config: ControllerCollectorConfig,
		private readonly store: StorageProvider,
		private readonly now: () => number = () => Math.floor( Date.now() / 1000 ),
		private readonly clientFactory: DeviceClientFactory = createDeviceClient,
	) {
		this.identityResolved = Boolean( config.controllerId );
		this.fallbackId = fallbackControllerId( config.controllerBase );
		config.controllerId ||= this.fallbackId;
	}

	get controllerId(): string { return this.config.controllerId ?? this.fallbackId; }

	async cycle( signal?: AbortSignal ): Promise<CollectResult> {
		if ( !this.client ) {
			const created = await this.clientFactory( this.config, signal );
			if ( !this.identityResolved ) {
				const mac = typeof created.status.mac === "string" ? created.status.mac.trim().toLowerCase() : "";
				this.config.controllerId = mac || this.fallbackId;
				this.identityResolved = true;
			}
			this.client = created.client;
		}

		const result = await collectOnce( this.client, this.store, this.controllerId, {
			backfillDays: this.config.logBackfillDays,
			now: this.now(),
			signal,
		} );
		if ( result.errors.length > 0 ) throw new CollectionCycleError( result.errors );
		return result;
	}
}
