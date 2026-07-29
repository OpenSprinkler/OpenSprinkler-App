import { describe, expect, it } from "vitest";
import {
	clearCompanionSession, loadCompanionSession, saveCompanionSession, selectCompanionSession,
	type SessionStore,
} from "../www/src/api/companion-session";

function memoryStore( initial: Record<string, string> = {} ): SessionStore & { values: Map<string, string> } {
	const values = new Map( Object.entries( initial ) );
	return {
		values,
		getItem: ( key ) => values.get( key ) ?? null,
		setItem: ( key, value ) => { values.set( key, value ); },
		removeItem: ( key ) => { values.delete( key ); },
	};
}

describe( "companion session pairing", () => {
	it( "never carries a saved bearer token to a newly selected base", () => {
		const saved = { base: "https://old.example/", token: "old-secret" };
		expect( selectCompanionSession( "https://default.example/", {
			base: "https://new.example/",
		}, saved ) ).toEqual( { base: "https://new.example/" } );
	} );

	it( "reuses a token only for the exact normalized base and accepts an explicit replacement", () => {
		const saved = { base: "https://same.example/", token: "saved-secret" };
		expect( selectCompanionSession( "https://default.example/", {
			base: "https://same.example/",
		}, saved ).token ).toBe( "saved-secret" );
		expect( selectCompanionSession( "https://default.example/", {
			base: "https://new.example/", token: "new-secret",
		}, saved ).token ).toBe( "new-secret" );
	} );

	it( "binds a token-only handoff to the default base instead of a saved base", () => {
		const saved = { base: "https://old.example/", token: "old-secret" };
		expect( selectCompanionSession( "https://default.example/", {
			token: "new-secret",
		}, saved ) ).toEqual( {
			base: "https://default.example/",
			token: "new-secret",
		} );
	} );

	it( "fails closed on malformed stored values and removes obsolete split-token keys", () => {
		const malformed = memoryStore( { "opensprinkler.companion": '{"base":42,"token":"secret"}' } );
		expect( loadCompanionSession( malformed ) ).toBeUndefined();

		const storage = memoryStore( {
			"opensprinkler.companionBase": "https://old.example/",
			"opensprinkler.companionToken": "old-secret",
		} );
		saveCompanionSession( storage, { base: "https://new.example/" } );
		expect( [ ...storage.values.keys() ] ).toEqual( [ "opensprinkler.companion" ] );
		clearCompanionSession( storage );
		expect( storage.values.size ).toBe( 0 );
	} );
} );
