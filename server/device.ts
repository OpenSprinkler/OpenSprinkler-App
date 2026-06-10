import { BrowserDeviceSeam } from "../www/src/seam/device";
import { OsApiClient } from "../www/src/api/client";
import { md5 } from "../www/src/auth/md5";

export interface DeviceClientConfig { controllerBase: string; controllerPw?: string; controllerFwv?: number; }

/**
 * Build an authenticated OsApiClient (FR-10): probe the pre-auth /jo for fwv (unless configured),
 * hash the password server-side (md5 for fwv>=213, cleartext fallback), and return a ready client.
 */
export async function createDeviceClient( cfg: DeviceClientConfig ): Promise<{ client: OsApiClient; fwv: number }> {
	const base = cfg.controllerBase.endsWith( "/" ) ? cfg.controllerBase : cfg.controllerBase + "/";
	let fwv = cfg.controllerFwv ?? 0;
	if ( !fwv ) {
		const res = await fetch( base + "jo", { headers: { Accept: "application/json" } } );
		const jo = await res.json() as { fwv?: number };
		fwv = typeof jo.fwv === "number" ? jo.fwv : 0;
	}
	const pwHash = cfg.controllerPw ? ( fwv >= 213 ? md5( cfg.controllerPw ) : cfg.controllerPw ) : "";
	const seam = new BrowserDeviceSeam( { baseUrl: base, pwHash, ver: fwv, ipas: cfg.controllerPw ? 0 : 1 } );
	return { client: new OsApiClient( seam ), fwv };
}
