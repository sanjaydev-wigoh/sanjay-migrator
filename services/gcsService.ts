class GCSService {
  private bucketName: string = 'wigoh-migration';
  private html: string = '';
  private css: any = null;

  async fetchFiles(): Promise<{ html: string; css: any }> {
    try {
      const htmlUrl = `https://storage.googleapis.com/${this.bucketName}/karthik_local/try_10/pages/wigoh`;
      const htmlResponse = await fetch(htmlUrl);
      
      if (!htmlResponse.ok) {
        throw new Error(`HTML file not found: ${htmlResponse.status} ${htmlResponse.statusText}`);
      }
      
      this.html = await htmlResponse.text();

      const cssUrl = `https://storage.googleapis.com/${this.bucketName}/karthik_local/try_10/pages/wigoh_computed_style.json`;
      const cssResponse = await fetch(cssUrl);
      
      if (!cssResponse.ok) {
        throw new Error(`CSS file not found: ${cssResponse.status} ${cssResponse.statusText}`);
      }
      
      this.css = await cssResponse.json();

      return { html: this.html, css: this.css };
    } catch (error) {
      throw new Error(`Failed to fetch files from GCS: ${error}`);
    }
  }

  getHtml(): string {
    return this.html;
  }

  getCss(): any {
    return this.css;
  }
}

export default new GCSService();
