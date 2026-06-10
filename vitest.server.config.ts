import { defineConfig } from "vitest/config";

// Companion server tests — separate from the contract suite + the verify:live harness.
export default defineConfig( {
	test: { include: [ "test/server/**/*.spec.ts" ], environment: "node", testTimeout: 15000 },
} );
