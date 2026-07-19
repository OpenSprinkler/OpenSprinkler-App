import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
	pluginJs.configs.recommended,
  {
	  files: ["**/*.js"],
	  languageOptions: {
		  sourceType: "script",
		  globals: {
			  ...globals.browser,
			  Chart: "readonly"
		  }
	  },
	  rules: {
		  "no-useless-escape": "warn",
		  "no-prototype-builtins": "warn",
		  "semi": ["error", "always"],
		  "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
	  },
  },
];
