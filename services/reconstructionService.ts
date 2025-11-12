import databaseService from './databaseService';

interface ReconstructionResult {
  reconstructedHtml: string;
  totalComponents: number;
  totalWidgets: number;
  dbId: number;
}

class ReconstructionService {
  async reconstructHtml(): Promise<ReconstructionResult> {
    try {
      console.log('🔨 Starting HTML reconstruction...');

      // Step 1: Get placeholder HTML (template with {{wigoh-id-XXX}})
      console.log('📄 Fetching placeholder HTML from database...');
      const placeholderData = await databaseService.getLatestPlaceholderHtml();
      
      if (!placeholderData) {
        throw new Error('No placeholder HTML found in database');
      }

      let reconstructedHtml = placeholderData.html_content;
      console.log(`✅ Retrieved placeholder HTML with ${placeholderData.total_placeholders} placeholders`);

      // Step 2: Get all optimized components
      console.log('🧩 Fetching optimized components from database...');
      const optimizedComponents = await databaseService.getOptimizedComponents();
      console.log(`✅ Retrieved ${optimizedComponents.length} optimized components`);

      // Step 3: Replace {{wigoh-id-XXX}} with optimized component HTML
      console.log('🔄 Replacing component placeholders with optimized HTML...');
      let componentsReplaced = 0;

      for (const component of optimizedComponents) {
        // Get the full optimized component data including HTML
        const fullComponent = await databaseService.getOptimizedComponentById(component.id);
        
        if (!fullComponent || !fullComponent.optimized_html) {
          console.warn(`⚠️  Skipping component ${component.id} - no optimized HTML found`);
          continue;
        }

        // Extract wig-id from optimized HTML
        const wigIdMatch = fullComponent.optimized_html.match(/wig-id="(\{\{wigoh-id-\d+\}\})"/);
        
        if (!wigIdMatch) {
          console.warn(`⚠️  No wig-id found in optimized component ${component.id}`);
          continue;
        }

        const wigIdPlaceholder = wigIdMatch[1]; // e.g., {{wigoh-id-001}}
        
        // Replace placeholder with optimized HTML
        if (reconstructedHtml.includes(wigIdPlaceholder)) {
          reconstructedHtml = reconstructedHtml.replace(wigIdPlaceholder, fullComponent.optimized_html);
          componentsReplaced++;
          console.log(`   ✅ Replaced ${wigIdPlaceholder} with optimized component`);
        } else {
          console.warn(`   ⚠️  Placeholder ${wigIdPlaceholder} not found in template`);
        }
      }

      console.log(`✅ Replaced ${componentsReplaced} component placeholders`);

      // Step 4: Get all widgets
      console.log('🎨 Fetching widgets from database...');
      const widgets = await databaseService.getAllWidgets();
      console.log(`✅ Retrieved ${widgets.length} widgets`);

      // Step 5: Replace {{widget-N}} with actual widget HTML
      console.log('🔄 Replacing widget placeholders with actual HTML...');
      let widgetsReplaced = 0;

      for (const widget of widgets) {
        const placeholder = widget.widget_key; // e.g., {{widget-1}}
        
        if (reconstructedHtml.includes(placeholder)) {
          // Use a global replace to handle multiple occurrences
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
          const occurrences = (reconstructedHtml.match(regex) || []).length;
          reconstructedHtml = reconstructedHtml.replace(regex, widget.widget_html);
          widgetsReplaced += occurrences;
          console.log(`   ✅ Replaced ${placeholder} (${occurrences} occurrence${occurrences > 1 ? 's' : ''})`);
        }
      }

      console.log(`✅ Replaced ${widgetsReplaced} widget placeholders`);

      // Step 6: Save reconstructed HTML to database
      console.log('💾 Saving reconstructed HTML to database...');
      const dbId = await databaseService.saveReconstructedHtml(
        reconstructedHtml,
        componentsReplaced,
        widgetsReplaced
      );

      console.log('🎉 HTML reconstruction complete!');
      console.log(`   📊 Stats:`);
      console.log(`      - Components replaced: ${componentsReplaced}`);
      console.log(`      - Widgets replaced: ${widgetsReplaced}`);
      console.log(`      - Database ID: ${dbId}`);

      return {
        reconstructedHtml,
        totalComponents: componentsReplaced,
        totalWidgets: widgetsReplaced,
        dbId
      };
    } catch (error: any) {
      console.error('❌ Error during HTML reconstruction:', error.message);
      throw error;
    }
  }
}

export default new ReconstructionService();
