import { Pool } from 'pg';

interface Component {
  id?: number;
  placeholder_id: string;
  original_id: string;
  type: 'target-id' | 'section';
  html_content: string;
  created_at?: Date;
}

class DatabaseService {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (!this.pool) {
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found in environment variables');
      }

      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false
        }
      });

      console.log('✅ Database connection pool created');
    }

    return this.pool;
  }

  async createTableIfNotExists(): Promise<void> {
    const pool = this.getPool();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS components (
        id SERIAL PRIMARY KEY,
        placeholder_id VARCHAR(50) NOT NULL,
        original_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        html_content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_placeholder_id ON components(placeholder_id);
      CREATE INDEX IF NOT EXISTS idx_original_id ON components(original_id);

      CREATE TABLE IF NOT EXISTS placeholder_html (
        id SERIAL PRIMARY KEY,
        html_content TEXT NOT NULL,
        total_placeholders INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS widgets (
        id SERIAL PRIMARY KEY,
        widget_key VARCHAR(50) NOT NULL,
        widget_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS optimized_components (
        id SERIAL PRIMARY KEY,
        component_id INTEGER NOT NULL,
        original_html TEXT NOT NULL,
        optimized_html TEXT NOT NULL,
        original_lines INTEGER,
        optimized_lines INTEGER,
        reduction_percentage DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reconstructed_html (
        id SERIAL PRIMARY KEY,
        html_content TEXT NOT NULL,
        total_components INTEGER,
        total_widgets INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS html_json (
        id SERIAL PRIMARY KEY,
        json_content JSONB NOT NULL,
        total_nodes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_widget_key ON widgets(widget_key);
      CREATE INDEX IF NOT EXISTS idx_optimized_component_id ON optimized_components(component_id);
    `;

    try {
      await pool.query(createTableQuery);
      console.log('✅ Components, placeholder_html, widgets, optimized_components, reconstructed_html, and html_json tables ready');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw new Error(`Failed to create tables: ${error}`);
    }
  }

  async saveComponent(component: Component): Promise<number> {
    const pool = this.getPool();

    const insertQuery = `
      INSERT INTO components (placeholder_id, original_id, type, html_content)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [
        component.placeholder_id,
        component.original_id,
        component.type,
        component.html_content
      ]);

      const componentId = result.rows[0].id;
      console.log(`✅ Saved component to database: ${component.placeholder_id} (ID: ${componentId})`);
      
      return componentId;
    } catch (error) {
      console.error('❌ Error saving component:', error);
      throw new Error(`Failed to save component: ${error}`);
    }
  }

  async getComponentByPlaceholderId(placeholderId: string): Promise<Component | null> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT * FROM components
      WHERE placeholder_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    try {
      const result = await pool.query(selectQuery, [placeholderId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error fetching component:', error);
      throw new Error(`Failed to fetch component: ${error}`);
    }
  }

  async savePlaceholderHtml(htmlContent: string, totalPlaceholders: number): Promise<number> {
    const pool = this.getPool();

    const insertQuery = `
      INSERT INTO placeholder_html (html_content, total_placeholders)
      VALUES ($1, $2)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [htmlContent, totalPlaceholders]);
      const id = result.rows[0].id;
      console.log(`✅ Saved placeholder HTML to database (ID: ${id}, ${totalPlaceholders} placeholders)`);
      return id;
    } catch (error) {
      console.error('❌ Error saving placeholder HTML:', error);
      throw new Error(`Failed to save placeholder HTML: ${error}`);
    }
  }

  async getLatestPlaceholderHtml(): Promise<{ id: number; html_content: string; total_placeholders: number; created_at: Date } | null> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT * FROM placeholder_html
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    try {
      const result = await pool.query(selectQuery);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error fetching placeholder HTML:', error);
      throw new Error(`Failed to fetch placeholder HTML: ${error}`);
    }
  }

  async saveWidget(widgetKey: string, widgetHtml: string): Promise<number> {
    const pool = this.getPool();

    const insertQuery = `
      INSERT INTO widgets (widget_key, widget_html)
      VALUES ($1, $2)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [widgetKey, widgetHtml]);
      const id = result.rows[0].id;
      console.log(`✅ Saved widget to database: ${widgetKey} (ID: ${id})`);
      return id;
    } catch (error) {
      console.error('❌ Error saving widget:', error);
      throw new Error(`Failed to save widget: ${error}`);
    }
  }

  async getAllComponents(): Promise<Array<{ id: number; placeholder_id: string; html_content: string }>> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT id, placeholder_id, html_content
      FROM components
      ORDER BY id ASC;
    `;

    try {
      const result = await pool.query(selectQuery);
      console.log(`✅ Retrieved ${result.rows.length} components from database`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching components:', error);
      throw new Error(`Failed to fetch components: ${error}`);
    }
  }

  async saveOptimizedComponent(
    componentId: number,
    originalHtml: string,
    optimizedHtml: string,
    originalLines: number,
    optimizedLines: number,
    reductionPercentage: number
  ): Promise<number> {
    const pool = this.getPool();

    // Ensure table exists before inserting
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS optimized_components (
          id SERIAL PRIMARY KEY,
          component_id INTEGER NOT NULL,
          original_html TEXT NOT NULL,
          optimized_html TEXT NOT NULL,
          original_lines INTEGER,
          optimized_lines INTEGER,
          reduction_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_optimized_component_id ON optimized_components(component_id);
      `);
    } catch (err) {
      console.warn('⚠️  Table might already exist or creation failed:', err);
    }

    const insertQuery = `
      INSERT INTO optimized_components (
        component_id, original_html, optimized_html, 
        original_lines, optimized_lines, reduction_percentage
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [
        componentId,
        originalHtml,
        optimizedHtml,
        originalLines,
        optimizedLines,
        reductionPercentage
      ]);
      const id = result.rows[0].id;
      console.log(`✅ Saved optimized component (ID: ${id}) - ${reductionPercentage}% reduction`);
      return id;
    } catch (error) {
      console.error('❌ Error saving optimized component:', error);
      throw new Error(`Failed to save optimized component: ${error}`);
    }
  }

  async getOptimizedComponents(): Promise<any[]> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT id, component_id, original_lines, optimized_lines, reduction_percentage, created_at
      FROM optimized_components
      ORDER BY created_at DESC;
    `;

    try {
      const result = await pool.query(selectQuery);
      console.log(`✅ Retrieved ${result.rows.length} optimized components`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching optimized components:', error);
      throw new Error(`Failed to fetch optimized components: ${error}`);
    }
  }

  async getOptimizedComponentById(id: number): Promise<any | null> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT *
      FROM optimized_components
      WHERE id = $1;
    `;

    try {
      const result = await pool.query(selectQuery, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching optimized component:', error);
      throw new Error(`Failed to fetch optimized component: ${error}`);
    }
  }

  async getAllWidgets(): Promise<Array<{ widget_key: string; widget_html: string }>> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT widget_key, widget_html
      FROM widgets
      ORDER BY id ASC;
    `;

    try {
      const result = await pool.query(selectQuery);
      console.log(`✅ Retrieved ${result.rows.length} widgets from database`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching widgets:', error);
      throw new Error(`Failed to fetch widgets: ${error}`);
    }
  }

  async saveReconstructedHtml(htmlContent: string, totalComponents: number, totalWidgets: number): Promise<number> {
    const pool = this.getPool();

    // Ensure table exists before inserting
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reconstructed_html (
          id SERIAL PRIMARY KEY,
          html_content TEXT NOT NULL,
          total_components INTEGER,
          total_widgets INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err) {
      console.warn('⚠️  Table might already exist or creation failed:', err);
    }

    const insertQuery = `
      INSERT INTO reconstructed_html (html_content, total_components, total_widgets)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [htmlContent, totalComponents, totalWidgets]);
      const id = result.rows[0].id;
      console.log(`✅ Saved reconstructed HTML to database (ID: ${id}, ${totalComponents} components, ${totalWidgets} widgets)`);
      return id;
    } catch (error) {
      console.error('❌ Error saving reconstructed HTML:', error);
      throw new Error(`Failed to save reconstructed HTML: ${error}`);
    }
  }

  async getLatestReconstructedHtml(): Promise<{ id: number; html_content: string; total_components: number; total_widgets: number; created_at: Date } | null> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT * FROM reconstructed_html
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    try {
      const result = await pool.query(selectQuery);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error fetching reconstructed HTML:', error);
      throw new Error(`Failed to fetch reconstructed HTML: ${error}`);
    }
  }

  async saveHtmlJson(jsonContent: any, totalNodes: number): Promise<number> {
    const pool = this.getPool();

    // Ensure table exists before inserting
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS html_json (
          id SERIAL PRIMARY KEY,
          json_content JSONB NOT NULL,
          total_nodes INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err) {
      console.warn('⚠️  Table might already exist or creation failed:', err);
    }

    const insertQuery = `
      INSERT INTO html_json (json_content, total_nodes)
      VALUES ($1, $2)
      RETURNING id;
    `;

    try {
      const result = await pool.query(insertQuery, [JSON.stringify(jsonContent), totalNodes]);
      const id = result.rows[0].id;
      console.log(`✅ Saved HTML JSON to database (ID: ${id}, ${totalNodes} nodes)`);
      return id;
    } catch (error) {
      console.error('❌ Error saving HTML JSON:', error);
      throw new Error(`Failed to save HTML JSON: ${error}`);
    }
  }

  async getLatestHtmlJson(): Promise<{ id: number; json_content: any; total_nodes: number; created_at: Date } | null> {
    const pool = this.getPool();

    const selectQuery = `
      SELECT * FROM html_json
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    try {
      const result = await pool.query(selectQuery);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error fetching HTML JSON:', error);
      throw new Error(`Failed to fetch HTML JSON: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ Database connection pool closed');
      this.pool = null;
    }
  }
}

export default new DatabaseService();
