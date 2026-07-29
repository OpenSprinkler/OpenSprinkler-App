import { describe, expect, it, vi } from "vitest";
import { connectAuthorizedDeviceTarget, freshDeviceTargetConfirmation } from "../www/src/auth/device-bootstrap";

function dependencies( overrides: Record<string, unknown> = {} ) {
	return {
		baseUrl: "https://controller.example/forward/v1/target/",
		confirmFreshTarget: true,
		confirm: vi.fn( () => true ),
		probe: vi.fn( async () => ( { fwv: 221, ipas: 0 } ) ),
		validatePreflight: vi.fn(),
		login: vi.fn( async () => "replayable-hash" ),
		authenticate: vi.fn( async () => ( { options: "supported" } ) ),
		persist: vi.fn(),
		...overrides,
	};
}

describe( "standalone device-target authorization", () => {
	it( "shows the exact normalized target in the confirmation", () => {
		const message = freshDeviceTargetConfirmation( "https://controller.example/forward/v1/target/" );
		expect( message ).toContain( "https://controller.example/forward/v1/target/" );
		expect( message ).toMatch( /password-derived controller credential/i );
	} );

	it( "cancellation performs no controller, authentication, or persistence work", async () => {
		const deps = dependencies( { confirm: vi.fn( () => false ) } );
		await expect( connectAuthorizedDeviceTarget( deps ) ).rejects.toThrow( /cancelled/i );
		expect( deps.confirm ).toHaveBeenCalledWith( expect.stringContaining( deps.baseUrl ) );
		expect( deps.probe ).not.toHaveBeenCalled();
		expect( deps.validatePreflight ).not.toHaveBeenCalled();
		expect( deps.login ).not.toHaveBeenCalled();
		expect( deps.authenticate ).not.toHaveBeenCalled();
		expect( deps.persist ).not.toHaveBeenCalled();
	} );

	it( "persists a fresh target only after authenticated support succeeds", async () => {
		const events: string[] = [];
		const deps = dependencies( {
			confirm: vi.fn( () => { events.push( "confirm" ); return true; } ),
			probe: vi.fn( async () => { events.push( "probe" ); return { fwv: 221, ipas: 0 }; } ),
			validatePreflight: vi.fn( () => { events.push( "preflight" ); } ),
			login: vi.fn( async () => { events.push( "login" ); return "replayable-hash"; } ),
			authenticate: vi.fn( async ( details ) => {
				events.push( "authenticated-support" );
				expect( details ).toEqual( { firmwareVersion:221, ignoresPassword:0, pwHash:"replayable-hash" } );
				return { options:"supported" };
			} ),
			persist: vi.fn( () => { events.push( "persist" ); } ),
		} );
		await expect( connectAuthorizedDeviceTarget( deps ) ).resolves.toMatchObject( {
			firmwareVersion:221, ignoresPassword:0, pwHash:"replayable-hash",
		} );
		expect( events ).toEqual( [ "confirm", "probe", "preflight", "login", "authenticated-support", "persist" ] );
	} );

	it( "does not persist when probing, login, or authenticated support fails", async () => {
		for ( const failing of [ "probe", "login", "authenticate" ] as const ) {
			const failure = vi.fn( async () => { throw new Error( `${ failing } failed` ); } );
			const deps = dependencies( { [ failing ]: failure } );
			await expect( connectAuthorizedDeviceTarget( deps ) ).rejects.toThrow( `${ failing } failed` );
			expect( deps.persist ).not.toHaveBeenCalled();
		}
	} );

	it( "keeps saved and firmware-selected targets on their trusted no-confirm path", async () => {
		const deps = dependencies( {
			confirmFreshTarget:false, firmwareVersion:221, ignoresPassword:1, persist:undefined,
		} );
		await connectAuthorizedDeviceTarget( deps );
		expect( deps.confirm ).not.toHaveBeenCalled();
		expect( deps.probe ).not.toHaveBeenCalled();
		expect( deps.login ).not.toHaveBeenCalled();
		expect( deps.authenticate ).toHaveBeenCalledWith( {
			firmwareVersion:221, ignoresPassword:1, pwHash:undefined,
		} );
	} );
} );
