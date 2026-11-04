import type { SecurityFinding } from '../types.js';
import type { ScannerAdapter } from './scanner.js';

type SnykVulnerability = {
  id?: unknown;
  packageName?: unknown;
  severity?: unknown;
  title?: unknown;
  from?: unknown;
};

type SnykReport = {
  vulnerabilities?: unknown;
};

const severities = new Set(['low', 'medium', 'high', 'critical']);

export const snykScanner: ScannerAdapter = {
  parse(report: unknown) {
    const reports = Array.isArray(report) ? report : [report];
    const snykReports = reports.filter(isSnykReport);

    if (snykReports.length !== reports.length || snykReports.some((report) => !hasValidVulnerabilities(report))) {
      return { valid: false, findings: [] };
    }

    return {
      valid: true,
      findings: deduplicateFindings(
        snykReports.flatMap((entry) => {
          const vulnerabilities = entry.vulnerabilities;
          if (!Array.isArray(vulnerabilities)) return [];
          return vulnerabilities.flatMap((vulnerability) => toSecurityFinding(vulnerability));
        }),
      ),
    };
  },
};

function isSnykReport(report: unknown): report is SnykReport {
  if (!report || typeof report !== 'object') return false;
  if (!('vulnerabilities' in report)) return false;

  const vulnerabilities = (report as SnykReport).vulnerabilities;
  return vulnerabilities === undefined || Array.isArray(vulnerabilities);
}

function toSecurityFinding(vulnerability: unknown): SecurityFinding[] {
  if (!vulnerability || typeof vulnerability !== 'object') return [];

  const snykVulnerability = vulnerability as SnykVulnerability;
  const targetPackage = resolveTargetPackage(snykVulnerability);
  if (!targetPackage) return [];

  return [
    {
      packageName: targetPackage,
      ...(typeof snykVulnerability.id === 'string' && { vulnerabilityId: snykVulnerability.id }),
      severity: toSeverity(snykVulnerability.severity),
      title: typeof snykVulnerability.title === 'string' ? snykVulnerability.title : undefined,
    },
  ];
}

function hasValidVulnerabilities(report: SnykReport): boolean {
  if (!Array.isArray(report.vulnerabilities)) return report.vulnerabilities === undefined;

  return report.vulnerabilities.every((vulnerability) => {
    if (!vulnerability || typeof vulnerability !== 'object') return false;
    const value = vulnerability as SnykVulnerability;
    return Boolean(resolveTargetPackage(value));
  });
}

function deduplicateFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    if (!finding.vulnerabilityId) return true;

    const key = `${finding.packageName}\u0000${finding.vulnerabilityId}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function resolveTargetPackage(vulnerability: SnykVulnerability): string | undefined {
  if (Array.isArray(vulnerability.from) && vulnerability.from.length > 1) {
    const directDep = vulnerability.from[1];
    if (typeof directDep === 'string') {
      return extractPackageName(directDep);
    }
  }

  if (typeof vulnerability.packageName === 'string') {
    return vulnerability.packageName;
  }

  return undefined;
}

function extractPackageName(specifier: string): string {
  const atIndex = specifier.lastIndexOf('@');
  if (atIndex > 0) {
    return specifier.slice(0, atIndex);
  }
  return specifier;
}

function toSeverity(value: unknown): SecurityFinding['severity'] | undefined {
  if (typeof value !== 'string' || !severities.has(value)) return undefined;
  return value as SecurityFinding['severity'];
}
