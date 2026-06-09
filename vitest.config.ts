import { defineConfig } from "vitest/config";

// Phase 1 contract tests only — scoped to not disturb the existing karma suite (npm test).
export default defineConfig( {
	test: {
		include: [ "test/api-contract.spec.ts", "test/seam-spike.spec.ts", "test/decode.spec.ts", "test/views.spec.ts", "test/logs.spec.ts", "test/home-bootstrap.spec.ts", "test/auth.spec.ts", "test/login.spec.ts", "test/time.spec.ts", "test/fork-tag.spec.ts", "test/diagnostics.spec.ts", "test/weather-view.spec.ts", "test/empty-states.spec.ts", "test/xss.spec.ts", "test/encode.spec.ts", "test/commands.spec.ts", "test/settings.spec.ts", "test/dispatch.spec.ts" ],
		environment: "node",
	},
} );
