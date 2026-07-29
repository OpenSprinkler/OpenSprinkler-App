/* eslint-disable */
import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
	pluginJs.configs.recommended,
  {
	  files: ["**/*.js"],
	  languageOptions: {
		  sourceType: "script"
	  },
	  rules: {
		  "no-useless-escape": "warn",
		  "no-prototype-builtins": "warn",
		  // ESLint 10 added these to the recommended preset. Keep the existing
		  // legacy-code policy until those assignments/error wrappers are refactored.
		  "no-useless-assignment": "off",
		  "preserve-caught-error": "off",
			"semi": ["error", "always"], // require semicolons
	  },
  },
	  {
		  languageOptions: {
			  globals: globals.browser
		  },
	  },
	  {
		  files: ["scripts/**/*.mjs"],
		  languageOptions: {
			  globals: globals.node
		  },
		  rules: {
			  "preserve-caught-error": "off",
		  },
	  },
];
