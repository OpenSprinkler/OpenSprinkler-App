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
	  },
  },
  {
	  languageOptions: {
		  globals: globals.browser
	  },
  },
];
