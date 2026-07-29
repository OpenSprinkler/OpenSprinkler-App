export function writePrivateFile( outputPath: string, content: string | Uint8Array ): Promise<void>;

export function publishPrivateDirectory(
	outputDir: string,
	entries: Record<string, string | Uint8Array>,
): Promise<void>;
