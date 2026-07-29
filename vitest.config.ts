import { defineConfig } from "vitest/config";

// Node-side contract/unit tests; the legacy browser suite uses the repository-owned Chromium harness.
export default defineConfig( {
	test: {
		include: [ "test/*.spec.ts" ],
		exclude: [ "test/live.spec.ts" ],
		environment: "node",
	},
} );
