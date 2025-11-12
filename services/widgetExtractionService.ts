import { JSDOM } from 'jsdom';
import databaseService from './databaseService';

const WIDGET_ELEMENTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'svg', 'img', 'image',
  'video', 'span', 'button', 'a', 'text', 'wow-image', 'wix-video',
  'wow-svg', 'wow-icon', 'wow-canvas', 'main'
];

interface WidgetExtractionResult {
  widgets: Record<string, string>;
  modifiedHtml: string;
  totalWidgets: number;
}

class WidgetExtractionService {
  async extractWidgets(htmlContent: string): Promise<WidgetExtractionResult> {
    try {
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      const widgets: Record<string, string> = {};
      let widgetCounter = 1;

      const isInsideSection = (element: any): boolean => {
        let parent = element.parentElement;
        while (parent) {
          if (parent.tagName && parent.tagName.toLowerCase() === 'section') {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };

      const processElement = (element: any) => {
        if (element.nodeType === 1) {
          const tagName = element.tagName.toLowerCase();

          if (WIDGET_ELEMENTS.includes(tagName)) {
            if (tagName === 'main') {
              if (!isInsideSection(element)) {
                const children = Array.from(element.childNodes);
                children.forEach((child: any) => processElement(child));
                return;
              }
            }

            const widgetKey = `{{widget-${widgetCounter}}}`;
            widgets[widgetKey] = element.outerHTML;

            const placeholder = document.createTextNode(widgetKey);
            element.parentNode.replaceChild(placeholder, element);

            widgetCounter++;
          } else {
            const children = Array.from(element.childNodes);
            children.forEach((child: any) => processElement(child));
          }
        }
      };

      const body = document.body || document.documentElement;
      if (body) {
        const children = Array.from(body.childNodes);
        children.forEach((child: any) => processElement(child));
      }

      const modifiedHtml = dom.serialize();

      console.log(`🔧 Extracted ${Object.keys(widgets).length} widgets, saving to database...`);

      for (const [widgetKey, widgetHtml] of Object.entries(widgets)) {
        await databaseService.saveWidget(widgetKey, widgetHtml);
      }

      console.log(`✅ Successfully saved ${Object.keys(widgets).length} widgets to database`);

      return {
        widgets,
        modifiedHtml,
        totalWidgets: Object.keys(widgets).length
      };
    } catch (error) {
      console.error(`Error extracting widgets:`, error);
      throw new Error(`Failed to extract widgets: ${error}`);
    }
  }
}

export default new WidgetExtractionService();
