import databaseService from './databaseService';

interface OptimizationResult {
  componentId: number;
  placeholderId: string;
  originalHtml: string;
  optimizedHtml: string;
  originalLines: number;
  optimizedLines: number;
  reductionPercentage: number;
}

class AIService {
  private apiKey: string;
  private apiUrl: string = 'https://api.anthropic.com/v1/messages';

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY not found in .env file');
    }
  }

  async optimizeAllComponents(): Promise<OptimizationResult[]> {
    try {
      console.log('🔍 Fetching components from database...');
      const components = await databaseService.getAllComponents();

      if (components.length === 0) {
        console.log('⚠️  No components found to optimize');
        return [];
      }

      console.log(`🤖 Optimizing ${components.length} components...`);
      const results: OptimizationResult[] = [];

      for (const component of components) {
        console.log(`\n📝 Optimizing component: ${component.placeholder_id}`);
        
        const originalHtml = component.html_content;
        const originalLines = originalHtml.split('\n').filter(l => l.trim()).length;

        try {
          const optimizedHtml = await this.callClaudeAPI(originalHtml);
          const optimizedLines = optimizedHtml.split('\n').filter(l => l.trim()).length;
          const reductionPercentage = Math.round(((originalLines - optimizedLines) / originalLines) * 100);

          console.log(`\n📊 Optimization Stats:`);
          console.log(`   Original: ${originalLines} lines`);
          console.log(`   Optimized: ${optimizedLines} lines`);
          console.log(`   Reduction: ${reductionPercentage}%`);
          console.log(`   Original first 200 chars: ${originalHtml.substring(0, 200).replace(/\n/g, ' ')}`);
          console.log(`   Optimized first 200 chars: ${optimizedHtml.substring(0, 200).replace(/\n/g, ' ')}`);
          console.log(`   Are they same? ${originalHtml === optimizedHtml ? 'YES ❌' : 'NO ✅'}`);

          // Check if wig-id is preserved
          const originalWigId = originalHtml.match(/wig-id="([^"]+)"/);
          const optimizedWigId = optimizedHtml.match(/wig-id="([^"]+)"/);
          
          if (originalWigId && !optimizedWigId) {
            console.error(`⚠️  WARNING: wig-id="${originalWigId[1]}" is MISSING in optimized HTML!`);
          } else if (originalWigId && optimizedWigId) {
            console.log(`   ✅ wig-id preserved: ${optimizedWigId[1]}`);
          }

          if (originalHtml === optimizedHtml) {
            console.error(`⚠️  WARNING: Optimized HTML is IDENTICAL to original - Claude did not optimize!`);
          }

          await databaseService.saveOptimizedComponent(
            component.id,
            originalHtml,
            optimizedHtml,
            originalLines,
            optimizedLines,
            reductionPercentage
          );

          results.push({
            componentId: component.id,
            placeholderId: component.placeholder_id,
            originalHtml,
            optimizedHtml,
            originalLines,
            optimizedLines,
            reductionPercentage
          });

          console.log(`✅ ${component.placeholder_id}: ${originalLines} → ${optimizedLines} lines (${reductionPercentage}% reduction)`);
        } catch (error: any) {
          console.error(`❌ Failed to optimize ${component.placeholder_id}:`, error.message);
        }
      }

      console.log(`\n🎉 Optimization complete! Processed ${results.length}/${components.length} components`);
      return results;
    } catch (error: any) {
      console.error('❌ Error during component optimization:', error.message);
      throw error;
    }
  }

  private async callClaudeAPI(htmlContent: string): Promise<string> {
    const prompt = this.createOptimizationPrompt(htmlContent);

    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude API');
      }

      const rawResponse = data.content[0].text;
      console.log(`\n🤖 Claude raw response length: ${rawResponse.length} chars`);
      console.log(`   First 300 chars: ${rawResponse.substring(0, 300).replace(/\n/g, ' ')}`);

      const extracted = this.extractOptimizedHTML(rawResponse);
      console.log(`   Extracted HTML length: ${extracted.length} chars`);
      
      return extracted;
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Claude API. Check your internet connection.');
      }
      throw error;
    }
  }

  private createOptimizationPrompt(htmlContent: string): string {
    const lineCount = htmlContent.split('\n').filter(l => l.trim()).length;
    const targetLines = Math.ceil(lineCount * 0.20); // Target 80% reduction

    return `
<task>
CRITICAL: Create BARE MINIMUM HTML code that achieves 75-85% line reduction while maintaining EXACT pixel-perfect visual output. This is MANDATORY - no compromise on reduction percentage.
</task>

<requirements>
  <mandatory>
    <requirement priority="CRITICAL">MUST achieve 75-85% line reduction - this is NON-NEGOTIABLE</requirement>
    <requirement priority="CRITICAL">BARE MINIMUM code only - remove EVERYTHING that doesn't affect visual output</requirement>
    <requirement priority="CRITICAL">MUST preserve wig-id attribute on ROOT element - this is ESSENTIAL for future processing</requirement>
    <requirement>Use CSS Grid as PRIMARY layout system with grid-area positioning</requirement>
    <requirement>Must be responsive using grid functions: repeat(auto-fit, minmax(220px, 1fr))</requirement>
    <requirement>Preserve ALL {{widget-xx}} placeholders EXACTLY in their original positions</requirement>
    <requirement>Maintain PIXEL-PERFECT visual match - no visual differences whatsoever</requirement>
    <requirement>Use inline styles only (no classes, no external CSS, no style tags)</requirement>
    <requirement>Single root container with grid layout - NO unnecessary wrapper divs</requirement>
    <requirement>Root element MUST have wig-id="{{wigoh-id-XXX}}" attribute from original</requirement>
  </mandatory>

  <aggressive_removal>
    <remove>ALL empty div wrappers - merge into parent immediately</remove>
    <remove>ALL redundant positioning divs - use direct grid-area placement</remove>
    <remove>ALL unnecessary nesting - flatten structure completely</remove>
    <remove>perspective-origin, transform-origin (unless visually essential)</remove>
    <remove>pointer-events (unless interactive)</remove>
    <remove>will-change, backface-visibility (optimization hints)</remove>
    <remove>Multiple wrapper divs with same positioning</remove>
    <remove>Divs with ONLY position:absolute;inset:0 - merge to parent</remove>
    <remove>Container divs that only pass through dimensions</remove>
  </aggressive_removal>

  <grid_layout>
    <instruction>Analyze original grid-template-rows and grid-template-columns from source</instruction>
    <instruction>Use grid-area: row/col/row/col syntax for precise element positioning</instruction>
    <instruction>Use justify-self and align-self for fine-tuning within grid cells</instruction>
    <instruction>Use margin values for exact pixel positioning within grid areas</instruction>
    <instruction>Position absolute ONLY for: background overlays, nested SVG containers, complex overlapping elements</instruction>
  </grid_layout>

  <nested_structure>
    <svg_elements>
      <parent>div with grid-area:X/Y/Z/W; position:relative; margin:...</parent>
      <nested>div with position:absolute; inset:0; fill:rgb(); stroke:rgb(); contains {{widget-n}}</nested>
    </svg_elements>
    <text_elements>Single container with proper grid positioning</text_elements>
    <complex_widgets>Maintain essential nesting for functionality</complex_widgets>
  </nested_structure>

  <pixel_perfect>
    <extract>
      <property>grid-row-start, grid-row-end, grid-column-start, grid-column-end</property>
      <property>margin-left, margin-top, margin-bottom values</property>
      <property>left, top positions converted to margin offsets</property>
      <property>width, height, min-width, min-height dimensions</property>
    </extract>
    <preserve>
      <property>EXACT colors using original rgb() values</property>
      <property>EXACT spacing, overflow, box-sizing properties</property>
      <property>Essential visual properties: borders, shadows, backgrounds</property>
    </preserve>
  </pixel_perfect>

  <optimization_techniques>
    <technique priority="HIGH">Remove ALL redundant wrapper divs - flatten structure completely</technique>
    <technique priority="HIGH">ONE root grid container maximum - place all elements directly in grid</technique>
    <technique priority="HIGH">Merge 5-10 nested divs into single container with combined styles</technique>
    <technique priority="HIGH">Combine repetitive styles using CSS shorthand (margin, padding, inset)</technique>
    <technique>Use inset:0 instead of top:0;right:0;bottom:0;left:0</technique>
    <technique>Eliminate ALL non-essential properties: perspective-origin, transform-origin, pointer-events, will-change</technique>
    <technique>Consolidate identical positioning patterns into single element</technique>
    <technique>Remove divs with ONLY position:absolute;inset:0 - merge to parent</technique>
    <technique>Place {{widget-xx}} directly in grid cells - NO wrapper needed</technique>
    <technique>For SVG widgets: parent container + nested child ONLY (2 divs max)</technique>
    <technique>For non-SVG widgets: single container ONLY (1 div max)</technique>
  </optimization_techniques>

  <bare_minimum_structure>
    <example>
      BEFORE (200 lines):
      &lt;section id="comp-lt8qhfae" wig-id="{{wigoh-id-004}}" style="position:relative;height:1129px"&gt;
        &lt;div style="position:absolute;inset:0"&gt;
          &lt;div style="position:absolute;width:100%;height:100%"&gt;
            &lt;div style="display:grid;grid-template-rows:repeat(9,min-content) 1fr"&gt;
              &lt;div style="grid-area:1/1/2/2;position:relative"&gt;
                &lt;div style="position:absolute;inset:0"&gt;
                  &lt;div&gt;{{widget-1}}&lt;/div&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/section&gt;
      
      AFTER (50 lines) - NOTICE wig-id PRESERVED:
      &lt;section wig-id="{{wigoh-id-004}}" style="display:grid;grid-template-rows:repeat(9,min-content) 1fr;min-height:100vh"&gt;
        &lt;div style="grid-area:1/1/2/2"&gt;{{widget-1}}&lt;/div&gt;
      &lt;/section&gt;
    </example>
    
    <rule>CRITICAL: Root element MUST preserve wig-id="{{wigoh-id-XXX}}" attribute</rule>
    <rule>Maximum 2-3 div layers total (root grid + widget containers)</rule>
    <rule>NO position:absolute unless absolutely essential for visual output</rule>
    <rule>Grid-area placement instead of absolute positioning</rule>
    <rule>Each {{widget-xx}} in its own grid cell - direct placement</rule>
  </bare_minimum_structure>

  <responsive_guidelines>
    <rule>Do NOT use style tags or external CSS - achieve responsiveness inline only</rule>
    <rule>Use grid functions, fluid units (%, vw, vh), minmax(), auto-fit/auto-fill, clamp()</rule>
    <rule>Preferred responsive pattern: grid-template-columns:repeat(auto-fit,minmax(220px,1fr))</rule>
    <rule>Preserve vertical rhythm: grid-template-rows: repeat(9, min-content) 1fr</rule>
    <rule>Lock viewport height: min-height:100vh on root/background containers</rule>
    <rule>Center layouts: max-width:1400px; margin:auto on top-level containers</rule>
    <rule>Fluid typography: font-size:clamp(14px,1.6vw,20px)</rule>
    <rule>Scalable widths: width:clamp(120px,20vw,420px)</rule>
  </responsive_guidelines>

  <forbidden>
    <action>Using position:absolute for main layout structure</action>
    <action>Missing ANY {{widget-xx}} placeholders</action>
    <action>Changing visual appearance in ANY way</action>
    <action>Less than 70% line reduction</action>
    <action>Breaking SVG container nesting when present</action>
    <action>Removing essential visual properties</action>
  </forbidden>

  <validation_checklist>
    <check priority="CRITICAL">75-85% line reduction ACHIEVED - count lines and verify BEFORE returning</check>
    <check priority="CRITICAL">If reduction less than 75%, remove MORE divs and flatten MORE - keep optimizing</check>
    <check priority="CRITICAL">Maximum 2-3 div layers - if more exists, FLATTEN IMMEDIATELY</check>
    <check priority="CRITICAL">Root element has wig-id="{{wigoh-id-XXX}}" attribute preserved from original</check>
    <check>All {{widget-xx}} placeholders present and correctly positioned</check>
    <check>Grid-based layout with grid-area positioning</check>
    <check>Identical visual output (pixel-perfect match)</check>
    <check>Proper nested structure for SVG elements (2 divs max)</check>
    <check>Single container for non-SVG elements (1 div max)</check>
    <check>Essential properties preserved</check>
    <check>All content within background boundaries</check>
    <check>NO redundant wrappers remaining</check>
    <check>Proper overflow control</check>
    <svg_validation>
      <check>FOR EACH {{widget-xx}}: Check original HTML for SVG properties</check>
      <check>IF SVG properties found: Verify nested structure exists (parent + child)</check>
      <check>IF NO SVG properties: Verify single container structure</check>
      <check>All SVG elements have nested structure, all non-SVG have single structure</check>
    </svg_validation>
    <container_height_validation>
      <check>No parent and child both have explicit height values</check>
      <check>Nested containers don't cause vertical stacking</check>
      <check>Child containers fill parent naturally without height duplication</check>
    </container_height_validation>
    <background_content_validation>
      <check>All content elements positioned WITHIN background containers</check>
      <check>Background containers properly contain their content</check>
      <check>Content positioning relative to background boundaries</check>
      <check>No content elements floating independently</check>
      <check>Visual layering maintained (background contains content)</check>
    </background_content_validation>
  </validation_checklist>

  <analysis_approach>
    <step>Identify main grid structure (rows/columns)</step>
    <step>Map each {{widget-xx}} to its grid position</step>
    <step>Calculate exact positioning from margin-left + left values</step>
    <step>Preserve nested SVG structure where present</step>
    <step>Eliminate redundant wrappers while maintaining visual accuracy</step>
    <step>Verify background containment and container hierarchy</step>
    <step>Ensure all content within background bounds</step>
  </analysis_approach>
</requirements>

<output_rules>
  <rule priority="CRITICAL">Output must be pure HTML only (no markdown, no code blocks, no explanations)</rule>
  <rule priority="CRITICAL">MUST achieve ${targetLines} lines or LESS - this is MANDATORY</rule>
  <rule priority="CRITICAL">Maximum 2-3 div nesting levels - anything more is WRONG</rule>
  <rule priority="CRITICAL">Remove ALL wrapper divs that don't affect visual positioning</rule>
  <rule priority="CRITICAL">Root element MUST have wig-id="{{wigoh-id-XXX}}" attribute - NEVER remove this</rule>
  <rule>Use inline styles exclusively on every element</rule>
  <rule>Use grid-area: r/c/r/c syntax for placement</rule>
  <rule>Single root grid container with all {{widget-xx}} as direct children when possible</rule>
  <rule>{{widget-xx}} must be in exact same visual position as original</rule>
  <rule>Maintain SVG parent->nested-child structure ONLY for SVG widgets (2 divs)</rule>
  <rule>Non-SVG widgets get single container ONLY (1 div)</rule>
  <rule>Keep pixel-exact rgb() color values and spacing for visible elements</rule>
  <rule>Background containers have overflow:hidden when necessary</rule>
  <rule>Remove ALL: empty divs, redundant wrappers, position:absolute wrappers that can be grid cells</rule>
  <rule>Use fluid/responsive grid: grid-template-columns:repeat(auto-fit,minmax(220px,1fr))</rule>
  <rule>Place elements directly in grid - NO intermediate positioning divs</rule>
</output_rules>

<final_check>
  <step>1. Count lines in your output</step>
  <step>2. Calculate: (${lineCount} - yourLines) / ${lineCount} * 100</step>
  <step>3. If result less than 75%, GO BACK and remove MORE divs</step>
  <step>4. Flatten MORE nesting - combine styles into fewer containers</step>
  <step>5. Ensure visual output is pixel-perfect identical</step>
  <step>6. Return ONLY when 75-85% reduction achieved</step>
</final_check>

<bad_response_examples>
  <issue>Missing Container Hierarchy</issue>
  <issue>Incorrect Grid Structure</issue>
  <issue>Background Layer Loss</issue>
  <issue>Layout positioning incorrect</issue>
  <issue>Widget Positioning wrong</issue>
  <issue>SVG Container Nesting broken</issue>
  <issue>Flex vs Grid Conflict</issue>
  <issue>Send response without checking original positioning</issue>
</bad_response_examples>

<original_html lines="${lineCount}">
${htmlContent}
</original_html>

<instruction>
CRITICAL MISSION: Create BARE MINIMUM optimized HTML that:
1. MUST have ${targetLines} lines or LESS (currently ${lineCount} lines - target 75-85% reduction)
2. MUST preserve wig-id="{{wigoh-id-XXX}}" attribute on ROOT element - this is ESSENTIAL
3. Renders IDENTICALLY to original using CSS Grid with grid-area positioning
4. Uses MAXIMUM 2-3 div layers total (root grid + widget containers)
5. Places each {{widget-xx}} directly in grid cells - NO unnecessary wrappers
6. Removes ALL redundant divs, position:absolute wrappers, empty containers
7. Flattens ALL nested structures that don't affect visual output

BEFORE RETURNING:
- Count your output lines
- If greater than ${targetLines}, REMOVE MORE divs and flatten MORE
- Verify 75-85% reduction achieved
- VERIFY root element has wig-id="{{wigoh-id-XXX}}" attribute
- DO NOT compromise on reduction percentage

EXAMPLE of correct root element:
&lt;section wig-id="{{wigoh-id-004}}" style="display:grid;..."&gt;
  ... optimized content ...
&lt;/section&gt;

Return ONLY the optimized HTML code with no explanations, no markdown formatting, no code blocks.
</instruction>`;
  }

  private extractOptimizedHTML(response: string): string {
    const codeBlockMatch = response.match(/```html\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const htmlMatch = response.match(/<[^>]+[\s\S]*>/);
    if (htmlMatch) {
      return response.trim();
    }

    console.warn('⚠️  Warning: Could not extract clear HTML from AI response');
    return response.trim();
  }
}

export default new AIService();
