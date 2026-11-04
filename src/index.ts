import * as core from '@actions/core';
import { readFile, writeFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { getInputs } from './inputs.js';
import { parseManifest } from './manifests/index.js';
import { fetchLatestVersions } from './npm-registry.js';
import { generateMatrix } from './markdown/matrix.js';
import { replaceMarkedSection } from './markdown/replace.js';
import { getScannerAdapter } from './scanners/index.js';
import type { SecurityFinding } from './types.js';

export async function run(): Promise<void> {
  const inputs = getInputs();

  try {
    const rawManifest = await readFile(inputs.manifest, 'utf8');
    const dependencies = parseManifest(inputs.manifestType, rawManifest, {
      includeDependencies: inputs.includeDependencies,
      includeDevDependencies: inputs.includeDevDependencies,
    });
    const findings = await readScannerFindings(inputs);
    const securityStatusAvailable = findings !== undefined;
    const dependencyNames = new Set(dependencies.map((dependency) => dependency.name));
    const renderedFindings = findings?.filter((finding) => dependencyNames.has(finding.packageName)) ?? [];
    const latestVersions = inputs.includeLatestVersion ? await fetchLatestVersions(dependencies) : [];
    const result = generateMatrix({
      dependencies,
      findings: renderedFindings,
      latestVersions,
      heading: inputs.heading,
      includeLatestVersion: inputs.includeLatestVersion,
      includeStatusNote: inputs.includeStatusNote,
      securityStatusAvailable,
      collapsed: inputs.collapsed,
      collapseSummary: inputs.collapseSummary,
    });

    const currentReadme = await readFile(inputs.readme, 'utf8');
    const nextReadme = replaceMarkedSection(currentReadme, result.markdown, {
      startMarker: inputs.startMarker,
      endMarker: inputs.endMarker,
      failOnMissingMarkers: inputs.failOnMissingMarkers,
    });
    const updated = currentReadme !== nextReadme;

    if (updated) await writeFile(inputs.readme, nextReadme);

    core.setOutput('updated', String(updated));
    core.setOutput('dependency-count', String(result.dependencyCount));
    core.setOutput('latest-version-count', String(result.latestVersionCount));
    core.setOutput('scanner-used', securityStatusAvailable ? inputs.scanner : 'none');
    core.setOutput('security-status-available', String(result.securityStatusAvailable));
    core.setOutput('issue-count', String(result.issueCount));
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function readScannerFindings(inputs: ReturnType<typeof getInputs>): Promise<SecurityFinding[] | undefined> {
  if (!inputs.scannerReport) return handleUnavailableScannerReport(inputs, 'No scanner-report input was provided.');

  try {
    await access(inputs.scannerReport);
  } catch {
    return handleUnavailableScannerReport(inputs, `Scanner report does not exist: ${inputs.scannerReport}`);
  }

  try {
    const scanner = getScannerAdapter(inputs.scanner);
    const rawReport = await readFile(inputs.scannerReport, 'utf8');
    const result = scanner.parse(JSON.parse(rawReport));

    if (!result.valid) {
      return handleUnavailableScannerReport(inputs, `Scanner report does not match ${inputs.scanner} format.`);
    }

    return result.findings;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.startsWith('Unsupported scanner:')) {
      throw new Error(message);
    }

    return handleUnavailableScannerReport(inputs, `Could not parse scanner report: ${message}`);
  }
}

function handleUnavailableScannerReport(
  inputs: ReturnType<typeof getInputs>,
  message: string,
): SecurityFinding[] | undefined {
  if (inputs.scannerReportRequired || !inputs.fallbackWithoutScanner) {
    throw new Error(message);
  }

  core.warning(`${message} Generating matrix without security status.`);
  return undefined;
}

await run();
