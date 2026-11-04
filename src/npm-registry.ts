import type { Dependency, LatestVersion } from './types.js';

type NpmLatestResponse = {
  version?: unknown;
};

export async function fetchLatestVersions(dependencies: Dependency[]): Promise<LatestVersion[]> {
  const uniqueNames = [...new Set(dependencies.map((dependency) => dependency.name))];
  const results = new Map<string, LatestVersion>();
  const queue = [...uniqueNames];
  const workerCount = Math.min(8, queue.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const packageName = queue.shift();
      if (!packageName) return;
      results.set(packageName, await fetchLatestVersion(packageName));
    }
  }));

  return dependencies.map((dependency) => results.get(dependency.name) ?? { packageName: dependency.name });
}

async function fetchLatestVersion(packageName: string): Promise<LatestVersion> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { packageName };

    const body = (await response.json()) as NpmLatestResponse;
    return {
      packageName,
      version: typeof body.version === 'string' ? body.version : undefined,
    };
  } catch {
    return { packageName };
  }
}
