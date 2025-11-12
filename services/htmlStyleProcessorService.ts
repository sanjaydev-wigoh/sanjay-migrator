import * as cheerio from 'cheerio';

interface JsonStyleEntry {
  tag?: string;
  id?: string;
  className?: string;
  html?: string;
  styles: Record<string, any>;
  jsonIndex: number;
}

interface ProcessResult {
  styledHtml: string;
  stats: {
    totalMatches: number;
    totalHtmlElements: number;
    totalJsonEntries: number;
    indexMismatches: number;
    skippedScriptElements: number;
    applicationRate: string;
  };
}

class HtmlStyleProcessorService {
  private unmatchedElements: any[];
  private elementIndex: number;
  private processedElements: Set<any>;
  private excludedTags: string[];

  constructor() {
    this.unmatchedElements = [];
    this.elementIndex = 0;
    this.processedElements = new Set();
    this.excludedTags = ['html', 'head', 'meta', 'title', 'script', 'noscript', 'style', 'link'];
  }

  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  private flattenElements(data: any, flatArray: JsonStyleEntry[] = []): JsonStyleEntry[] {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        this.flattenElements(data[i], flatArray);
      }
    } else if (data && typeof data === 'object') {
      if (data.styles && typeof data.styles === 'object') {
        if (data.tag && data.tag.toLowerCase() === 'script') {
          console.log(`⏭️  SKIPPING JSON: Script tag found in JSON - ignoring`);
          return flatArray;
        }

        if (data.html && data.html.toLowerCase().includes('<script')) {
          console.log(`⏭️  SKIPPING JSON: Script tag found in HTML string - ignoring`);
          return flatArray;
        }

        flatArray.push({
          tag: data.tag,
          id: data.id,
          className: data.className,
          html: data.html,
          styles: data.styles,
          jsonIndex: flatArray.length
        });
      }

      if (data.children && Array.isArray(data.children)) {
        for (let i = 0; i < data.children.length; i++) {
          this.flattenElements(data.children[i], flatArray);
        }
      }
    }
    return flatArray;
  }

  private getElementHtmlString(element: any, $: cheerio.CheerioAPI): string | null {
    const $el = $(element);
    const tag = (element as any).tagName?.toLowerCase() || '';

    if (tag === 'script') {
      console.log(`⏭️  SKIPPING HTML ELEMENT: Script tag detected during processing`);
      return null;
    }

    const id = $el.attr('id') || '';
    const className = $el.attr('class') || '';

    let htmlStr = `<${tag}`;
    if (id) htmlStr += ` id="${id}"`;
    if (className) htmlStr += ` class="${className}"`;
    htmlStr += `></${tag}>`;

    return htmlStr;
  }

  async processHtml(rawHtml: string, layoutJson: any): Promise<ProcessResult> {
    console.log('🚀 Starting INDEX-BASED HTML Style Matching (Body Elements Only)...');
    console.log('🎯 Method: HTML[index] ↔ JSON[index] - Direct index correspondence');

    const $ = cheerio.load(rawHtml);

    const jsonStylesArray = this.flattenElements(layoutJson);

    const allHtmlElements = $('*').toArray().filter(element => {
      const tagName = (element as any).tagName?.toLowerCase() || '';

      if (this.excludedTags.includes(tagName)) {
        console.log(`⏭️  SKIPPING HTML TAG: <${tagName}> - excluded from processing`);
        return false;
      }

      const $element = $(element);
      const isInBody = $element.closest('body').length > 0 || tagName === 'body';

      if (!isInBody) {
        console.log(`⏭️  SKIPPING: <${tagName}> - not inside body`);
        return false;
      }

      return true;
    });

    console.log(`📄 Found ${allHtmlElements.length} HTML elements in body (after filtering)`);
    console.log(`📋 Found ${jsonStylesArray.length} style entries in JSON`);
    console.log('─'.repeat(70));

    let totalMatches = 0;
    let skippedScriptElements = 0;
    let indexMismatches = 0;

    for (let htmlIndex = 0; htmlIndex < allHtmlElements.length; htmlIndex++) {
      const htmlElement = allHtmlElements[htmlIndex];
      const $htmlElement = $(htmlElement);

      if ((htmlElement as any).tagName?.toLowerCase() === 'script') {
        console.log(`⏭️  SKIPPING SCRIPT ELEMENT during main processing loop`);
        skippedScriptElements++;
        continue;
      }

      const htmlElementString = this.getElementHtmlString(htmlElement, $);

      if (htmlElementString === null) {
        skippedScriptElements++;
        continue;
      }

      console.log(`\n🔄 PROCESSING HTML[${htmlIndex}]: ${htmlElementString}`);

      if (htmlIndex < jsonStylesArray.length) {
        const jsonEntry = jsonStylesArray[htmlIndex];

        if (jsonEntry.tag && jsonEntry.tag.toLowerCase() === 'script') {
          console.log(`   ⏭️  SKIPPING JSON[${htmlIndex}]: Script tag detected`);
          indexMismatches++;
          continue;
        }

        if (jsonEntry.html && jsonEntry.html.toLowerCase().includes('<script')) {
          console.log(`   ⏭️  SKIPPING JSON[${htmlIndex}]: Contains script tag in HTML`);
          indexMismatches++;
          continue;
        }

        console.log(`\n🎯 INDEX MATCHING: HTML[${htmlIndex}] ↔ JSON[${htmlIndex}]`);

        let inlineStyleString = '';
        const styles = jsonEntry.styles;
        let validStyleCount = 0;

        for (const property in styles) {
          if (styles.hasOwnProperty(property)) {
            const value = styles[property];

            if (value !== null && value !== undefined && value !== '' &&
              (typeof value === 'string' || typeof value === 'number')) {

              inlineStyleString += `${property}: ${value}; `;
              validStyleCount++;
              console.log(`      ✅ ${property}: ${value}`);
            }
          }
        }

        if (inlineStyleString.trim() !== '') {
          const existingStyle = $htmlElement.attr('style') || '';
          const finalStyle = existingStyle + (existingStyle ? '; ' : '') + inlineStyleString.trim();

          $htmlElement.attr('style', finalStyle);

          console.log(`   ✅ APPLIED ${validStyleCount} styles to HTML element`);
        }

        totalMatches++;
      } else {
        console.log(`\n❌ NO JSON ENTRY: No JSON entry found at index ${htmlIndex}`);
        indexMismatches++;
      }
    }

    const styledHtml = this.formatCleanHtml($.html());

    console.log('\n' + '═'.repeat(70));
    console.log('📊 FINAL RESULTS (INDEX-BASED MATCHING):');
    console.log(`✅ Index matches applied: ${totalMatches}`);
    console.log(`📊 HTML elements processed: ${allHtmlElements.length}`);
    console.log(`⏭️  Script elements skipped: ${skippedScriptElements}`);
    console.log(`❌ Index mismatches/skips: ${indexMismatches}`);
    console.log(`📊 JSON entries available: ${jsonStylesArray.length}`);

    return {
      styledHtml,
      stats: {
        totalMatches,
        totalHtmlElements: allHtmlElements.length,
        totalJsonEntries: jsonStylesArray.length,
        indexMismatches,
        skippedScriptElements,
        applicationRate: ((totalMatches / allHtmlElements.length) * 100).toFixed(1)
      }
    };
  }

  private formatCleanHtml(html: string): string {
    const $ = cheerio.load(html);

    $('style').remove();
    let cleanHtml = $.html();

    if (!cleanHtml.includes('<!DOCTYPE html>')) {
      cleanHtml = '<!DOCTYPE html>\n' + cleanHtml;
    }

    return cleanHtml
      .replace(/>\s*</g, '>\n<')
      .replace(/\n\s*\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
}

export default new HtmlStyleProcessorService();
