import * as cheerio from 'cheerio';
import databaseService from './databaseService';

interface DOMNode {
  tagName: string;
  attributes: Record<string, string>;
  children: (DOMNode | string)[];
  textContent?: string;
}

interface ConversionResult {
  json: DOMNode;
  totalNodes: number;
  dbId: number;
}

class HtmlToJsonService {
  private nodeCount: number = 0;

  async convertToJson(): Promise<ConversionResult> {
    try {
      console.log('🔄 Starting HTML to JSON conversion...');

      // Get reconstructed HTML from database
      console.log('📄 Fetching reconstructed HTML from database...');
      const reconstructedData = await databaseService.getLatestReconstructedHtml();

      if (!reconstructedData) {
        throw new Error('No reconstructed HTML found in database');
      }

      console.log(`✅ Retrieved reconstructed HTML`);

      // Parse HTML with cheerio
      const $ = cheerio.load(reconstructedData.html_content, {
        xmlMode: false
      });

      // Reset node counter
      this.nodeCount = 0;

      // Convert to JSON starting from body (or root element)
      console.log('🌳 Converting HTML to DOM tree JSON...');
      const body = $('body').length > 0 ? $('body')[0] : $.root()[0];
      const json = this.elementToJson($, body);

      console.log(`✅ Converted HTML to JSON (${this.nodeCount} nodes)`);

      // Save to database
      console.log('💾 Saving JSON to database...');
      const dbId = await databaseService.saveHtmlJson(json, this.nodeCount);

      console.log('🎉 HTML to JSON conversion complete!');
      console.log(`   📊 Stats:`);
      console.log(`      - Total nodes: ${this.nodeCount}`);
      console.log(`      - Database ID: ${dbId}`);

      return {
        json,
        totalNodes: this.nodeCount,
        dbId
      };
    } catch (error: any) {
      console.error('❌ Error during HTML to JSON conversion:', error.message);
      throw error;
    }
  }

  private elementToJson($: cheerio.CheerioAPI, element: any): any {
    this.nodeCount++;

    // Handle text nodes
    if (element.type === 'text') {
      const text = $(element).text().trim();
      return text || '';
    }

    // Handle comment nodes - skip them
    if (element.type === 'comment') {
      return '';
    }

    // Handle element nodes
    if (element.type === 'tag') {
      const node: any = {
        tagName: element.name,
        attributes: {},
        children: []
      };

      // Extract attributes
      if (element.attribs) {
        Object.keys(element.attribs).forEach(key => {
          node.attributes[key] = element.attribs[key];
        });
      }

      // Process children
      if (element.children && element.children.length > 0) {
        element.children.forEach((child: any) => {
          const childNode = this.elementToJson($, child);
          
          // Only add non-empty children
          if (typeof childNode === 'string') {
            if (childNode.trim()) {
              node.children.push(childNode);
            }
          } else if (childNode) {
            node.children.push(childNode);
          }
        });
      }

      // Add textContent for leaf elements with text
      if (node.children.length === 1 && typeof node.children[0] === 'string') {
        node.textContent = node.children[0];
        node.children = [];
      }

      return node;
    }

    return '';
  }
}

export default new HtmlToJsonService();
