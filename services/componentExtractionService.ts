import * as cheerio from 'cheerio';
import databaseService from './databaseService';

interface ExtractedComponent {
  placeholderId: string;
  originalId: string;
  type: 'target-id' | 'section';
  found: boolean;
  componentHtml: string;
  childrenCount: number;
  dbId?: number;
}

interface ExtractionResult {
  cleanedHtml: string;
  components: ExtractedComponent[];
}

class ComponentExtractionService {
  private targetIds: string[] = ['pinnedTopLeft', 'pinnedTopRight', 'pinnedBottomLeft'];

  async extractComponents(fullPageHtml: string): Promise<ExtractionResult> {
    console.log('🚀 Starting Component Extraction...');

    await databaseService.createTableIfNotExists();

    const $ = cheerio.load(fullPageHtml);
    console.log('✅ HTML loaded into Cheerio for processing');

    const extractedComponents: ExtractedComponent[] = [];
    let placeholderCounter = 1;

    console.log('🎯 Processing target IDs...');

    for (const targetId of this.targetIds) {
      const $element = $('#' + targetId);
      const placeholderId = `wigoh-id-${String(placeholderCounter).padStart(3, '0')}`;
      placeholderCounter++;

      if ($element.length > 0) {
        console.log(`✅ Found target ID: ${targetId}`);

        $element.attr('wig-id', `{{${placeholderId}}}`);
        const componentHtml = $.html($element);

        $element.replaceWith(`{{${placeholderId}}}`);
        console.log(`🔄 Replaced ${targetId} with {{${placeholderId}}}`);

        const dbId = await databaseService.saveComponent({
          placeholder_id: placeholderId,
          original_id: targetId,
          type: 'target-id',
          html_content: componentHtml
        });

        extractedComponents.push({
          placeholderId,
          originalId: targetId,
          type: 'target-id',
          found: true,
          componentHtml: this.createCleanComponentHTML(componentHtml, targetId, placeholderId),
          childrenCount: $element.children().length,
          dbId
        });
      } else {
        console.log(`❌ Target ID not found: ${targetId}`);

        const notFoundHtml = `<div style="padding: 20px; border: 2px dashed red; background: #fff3f3;">
  <h2 style="color: red;">Component Not Found</h2>
  <p><strong>Original ID:</strong> ${targetId}</p>
  <p><strong>Placeholder ID:</strong> ${placeholderId}</p>
  <p>This component was not found in the source HTML.</p>
</div>`;

        const dbId = await databaseService.saveComponent({
          placeholder_id: placeholderId,
          original_id: targetId,
          type: 'target-id',
          html_content: notFoundHtml
        });

        extractedComponents.push({
          placeholderId,
          originalId: targetId,
          type: 'target-id',
          found: false,
          componentHtml: this.createNotFoundComponentHTML(targetId, placeholderId),
          childrenCount: 0,
          dbId
        });
      }
    }

    console.log('🗂️ Processing section elements...');

    const processedSections = new Set<string>();
    const sectionElements = $('section').toArray();

    for (let index = 0; index < sectionElements.length; index++) {
      const element = sectionElements[index];
      const $section = $(element);
      const sectionId = $section.attr('id') || `section_${index + 1}`;

      const isNested = $section.parents('section').length > 0;
      if (isNested) {
        console.log(`⏭️ Skipping nested section: ${sectionId}`);
        continue;
      }

      if (processedSections.has(sectionId)) {
        console.log(`⏭️ Skipping already processed section: ${sectionId}`);
        continue;
      }

      console.log(`✅ Found top-level section: ${sectionId}`);
      processedSections.add(sectionId);

      const placeholderId = `wigoh-id-${String(placeholderCounter).padStart(3, '0')}`;
      placeholderCounter++;

      $section.attr('wig-id', `{{${placeholderId}}}`);
      const sectionHtml = $.html($section);

      $section.replaceWith(`{{${placeholderId}}}`);
      console.log(`🔄 Replaced section ${sectionId} with {{${placeholderId}}}`);

      const dbId = await databaseService.saveComponent({
        placeholder_id: placeholderId,
        original_id: sectionId,
        type: 'section',
        html_content: sectionHtml
      });

      extractedComponents.push({
        placeholderId,
        originalId: sectionId,
        type: 'section',
        found: true,
        componentHtml: this.createCleanComponentHTML(sectionHtml, sectionId, placeholderId),
        childrenCount: $section.children().length,
        dbId
      });
    }

    console.log('🧹 Cleaning HTML...');

    $('script').remove();
    $('style').remove();
    $('link[rel="stylesheet"]').remove();
    $('meta').remove();
    $('title').remove();
    $('header').remove();
    $('footer').remove();
    $('#soapAfterPagesContainer').remove();

    let bodyContent = '';
    if ($('body').length > 0) {
      bodyContent = $('body').html() || '';
    } else {
      bodyContent = $.html();
    }

    const cleanHtmlStructure = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extracted Content with Placeholders</title>
</head>
<body>
${bodyContent}
</body>
</html>`;

    console.log('✅ Component extraction completed');
    console.log(`📊 Total components extracted: ${extractedComponents.length}`);

    await databaseService.savePlaceholderHtml(cleanHtmlStructure, extractedComponents.length);

    return {
      cleanedHtml: cleanHtmlStructure,
      components: extractedComponents
    };
  }

  private createCleanComponentHTML(componentHtml: string, elementId: string, placeholderId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Component: ${elementId}</title>
</head>
<body>
    <!-- Placeholder ID: ${placeholderId} -->
    <!-- Original ID: ${elementId} -->
${componentHtml}
</body>
</html>`;
  }

  private createNotFoundComponentHTML(elementId: string, placeholderId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Component Not Found: ${elementId}</title>
</head>
<body>
    <!-- Placeholder ID: ${placeholderId} -->
    <!-- Original ID: ${elementId} -->
    <!-- STATUS: NOT FOUND -->
    <div style="padding: 20px; border: 2px dashed red; background: #fff3f3;">
        <h2 style="color: red;">Component Not Found</h2>
        <p><strong>Original ID:</strong> ${elementId}</p>
        <p><strong>Placeholder ID:</strong> ${placeholderId}</p>
        <p>This component was not found in the source HTML.</p>
    </div>
</body>
</html>`;
  }
}

export default new ComponentExtractionService();
