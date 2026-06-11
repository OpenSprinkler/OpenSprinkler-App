import { defineConfig } from "vitest/config";

// TEMP config for the live-hardware proof (test/live.spec.ts). Not part of the normal suite.
export default defineConfig( {
	test: { include: [ "test/live.spec.ts" ], environment: "node", testTimeout: 20000 },
} );
