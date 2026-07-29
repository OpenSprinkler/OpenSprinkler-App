import { describe, expect, it } from "vitest";

// The localization helper is intentionally plain JavaScript so the Node task can invoke it directly.
// @ts-expect-error The local .mjs helper has no separate declaration file.
import { poToMessageFormat } from "../scripts/po-to-json.mjs";
// @ts-expect-error The local .mjs helper has no separate declaration file.
import { languageFromTranslationFilename } from "../scripts/localization.mjs";

describe( "PO localization conversion", () => {
	it( "preserves contexts and omits fuzzy translations", () => {
		const source = `
msgid "Hello"
msgstr "Bonjour"

msgctxt "menu"
msgid "Open"
msgstr "Ouvrir"

#, fuzzy
msgid "Draft"
msgstr "Brouillon"
`;

		expect( poToMessageFormat( source ) ).toEqual( {
			Hello: "Bonjour",
			[ `menu\u0004Open` ]: "Ouvrir",
		} );
	} );

	it( "preserves metaproperty-shaped message ids as inert own data", () => {
		const messages = poToMessageFormat( `
msgid "__proto__"
msgstr "Prototype label"

msgid "constructor"
msgstr "Constructor label"
` );
		expect( Object.getPrototypeOf( messages ) ).toBeNull();
		expect( messages.__proto__ ).toBe( "Prototype label" );
		expect( messages.constructor ).toBe( "Constructor label" );
		expect( JSON.parse( JSON.stringify( messages ) ) ).toEqual( {
			[ "__proto__" ]: "Prototype label", constructor: "Constructor label",
		} );
	} );

	it( "maps regional Transifex filenames to the legacy base-language bundle", () => {
		expect( languageFromTranslationFilename( "messages_pt_BR.po" ) ).toBe( "pt" );
		expect( languageFromTranslationFilename( "messages_zh-CN.po" ) ).toBe( "zh" );
		expect( languageFromTranslationFilename( "unrelated.po" ) ).toBeUndefined();
	} );
} );
