export function replaceMarkedSection(
  markdown: string,
  generatedSection: string,
  options: { startMarker: string; endMarker: string; failOnMissingMarkers: boolean },
): string {
  const startIndex = markdown.indexOf(options.startMarker);
  const endIndex = markdown.indexOf(options.endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    if (options.failOnMissingMarkers) {
      throw new Error(`Could not find a valid marker range: ${options.startMarker} ... ${options.endMarker}`);
    }

    const withoutOrphanMarkers = markdown
      .replace(options.startMarker, '')
      .replace(options.endMarker, '')
      .trimEnd();
    return `${withoutOrphanMarkers}\n\n${options.startMarker}${generatedSection}${options.endMarker}\n`;
  }

  return `${markdown.slice(0, startIndex)}${options.startMarker}${generatedSection}${options.endMarker}${markdown.slice(
    endIndex + options.endMarker.length,
  )}`;
}
