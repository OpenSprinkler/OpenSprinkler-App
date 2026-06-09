import { defineConfig } from "vitest/config";

// Phase 1 contract tests only — scoped to not disturb the existing karma suite (npm test).
export default defineConfig( {
	test: {
		include: [ "test/api-contract.spec.ts", "test/seam-spike.spec.ts", "test/decode.spec.ts", "test/views.spec.ts" ],
		environment: "node",
	},
} );
