import { describe, expect, it } from 'vitest';
import { snykScanner } from '../src/scanners/snyk.js';

describe('snykScanner', () => {
  it('parses object reports', () => {
    const result = snykScanner.parse({
      vulnerabilities: [
        { packageName: 'pino', severity: 'high', title: 'Prototype pollution' },
        { packageName: 'zod', severity: 'medium' },
      ],
    });

    expect(result).toEqual({
      valid: true,
      findings: [
        { packageName: 'pino', severity: 'high', title: 'Prototype pollution' },
        { packageName: 'zod', severity: 'medium', title: undefined },
      ],
    });
  });

  it('parses array reports', () => {
    const result = snykScanner.parse([
      { vulnerabilities: [{ packageName: 'pino', severity: 'critical' }] },
      { vulnerabilities: [{ packageName: 'typescript', severity: 'low' }] },
    ]);

    expect(result).toEqual({
      valid: true,
      findings: [
        { packageName: 'pino', severity: 'critical', title: undefined },
        { packageName: 'typescript', severity: 'low', title: undefined },
      ],
    });
  });

  it('marks unexpected report shapes as invalid', () => {
    expect(snykScanner.parse({ error: 'Invalid token' })).toEqual({ valid: false, findings: [] });
  });

  it('marks malformed vulnerability entries as invalid', () => {
    expect(snykScanner.parse({ vulnerabilities: [{}] })).toEqual({ valid: false, findings: [] });
  });

  it('accepts an empty vulnerability list as a valid clean report', () => {
    expect(snykScanner.parse({ vulnerabilities: [] })).toEqual({ valid: true, findings: [] });
  });

  it('attributes transitive vulnerabilities to the direct manifest package from the from path', () => {
    const result = snykScanner.parse({
      vulnerabilities: [
        {
          packageName: 'adm-zip',
          severity: 'high',
          title: 'Symlink Attack',
          from: ['awesome-pw-template@1.0.0', 'allure@3.16.0', 'adm-zip@0.6.0'],
        },
        {
          packageName: 'fast-uri',
          severity: 'high',
          title: 'Host Confusion',
          from: [
            'awesome-pw-template@1.0.0',
            '@playwright/test@1.62.1',
            'ctrf@0.2.1',
            'fast-uri@3.1.6',
          ],
        },
      ],
    });

    expect(result).toEqual({
      valid: true,
      findings: [
        { packageName: 'allure', severity: 'high', title: 'Symlink Attack' },
        { packageName: '@playwright/test', severity: 'high', title: 'Host Confusion' },
      ],
    });
  });

  it('deduplicates the same vulnerability reported through multiple paths', () => {
    const result = snykScanner.parse({
      vulnerabilities: [
        {
          id: 'SNYK-JS-FASTURI-19502854',
          packageName: 'fast-uri',
          severity: 'high',
          title: 'Host Confusion',
          from: ['app@1.0.0', 'playwright-ctrf-json-reporter@0.0.29', 'fast-uri@3.1.6'],
        },
        {
          id: 'SNYK-JS-FASTURI-19502854',
          packageName: 'fast-uri',
          severity: 'high',
          title: 'Host Confusion',
          from: ['app@1.0.0', 'playwright-ctrf-json-reporter@0.0.29', 'ctrf@0.2.1', 'fast-uri@3.1.6'],
        },
      ],
    });

    expect(result).toEqual({
      valid: true,
      findings: [
        {
          packageName: 'playwright-ctrf-json-reporter',
          vulnerabilityId: 'SNYK-JS-FASTURI-19502854',
          severity: 'high',
          title: 'Host Confusion',
        },
      ],
    });
  });
});
