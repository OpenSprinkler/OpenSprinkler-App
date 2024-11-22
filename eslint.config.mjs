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
	  },
  },
  {
	  languageOptions: {
		  globals: globals.browser
	  },
  },
];
