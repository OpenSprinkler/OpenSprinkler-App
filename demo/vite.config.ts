import { defineConfig } from "vite";

// Demo harness for the Phase-1 seam spike. Root is this demo/ folder; allow importing the
// spike source and fixtures from the sibling www/src and test directories.
export default defineConfig( {
	server: { fs: { allow: [ ".." ] }, open: true },
	build: { outDir: "dist", emptyOutDir: true },
} );
