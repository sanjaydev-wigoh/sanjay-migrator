import { Storage } from '@google-cloud/storage';
import databaseService from './databaseService';

interface UploadResult {
  jobId: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
  totalNodes: number;
}

class GcsUploadService {
  private storage: Storage;
  private bucketName: string = 'wigoh-migration';
  private basePath: string = 'karthik_local/try_10/wigoh_migrator-280501';

  constructor() {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS;
    const projectId = process.env.PROJECT_ID;
    
    if (!credentialsPath) {
      throw new Error('GOOGLE_CREDENTIALS environment variable not set');
    }

    if (!projectId) {
      throw new Error('PROJECT_ID environment variable not set');
    }

    this.storage = new Storage({
      keyFilename: credentialsPath,
      projectId: projectId
    });

    console.log(`✅ GCS Storage initialized with project: ${projectId}`);
  }

  async uploadJsonToGcs(): Promise<UploadResult> {
    try {
      console.log('☁️  Starting JSON upload to GCS...');

      // Get latest JSON from database
      console.log('📄 Fetching JSON from database...');
      const jsonData = await databaseService.getLatestHtmlJson();

      if (!jsonData) {
        throw new Error('No JSON found in database');
      }

      console.log(`✅ Retrieved JSON with ${jsonData.total_nodes} nodes`);

      // Generate job ID (timestamp-based)
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fileName = `${jobId}.json`;
      const filePath = `${this.basePath}/${fileName}`;

      console.log(`📝 Job ID: ${jobId}`);
      console.log(`📂 Uploading to: gs://${this.bucketName}/${filePath}`);

      // Upload to GCS
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      // Convert JSON to string
      const jsonContent = typeof jsonData.json_content === 'string' 
        ? jsonData.json_content 
        : JSON.stringify(jsonData.json_content, null, 2);

      await file.save(jsonContent, {
        contentType: 'application/json',
        metadata: {
          jobId: jobId,
          totalNodes: jsonData.total_nodes.toString(),
          uploadedAt: new Date().toISOString()
        }
      });

      console.log('✅ File uploaded successfully!');

      // Make file publicly accessible (optional)
      try {
        await file.makePublic();
        console.log('✅ File made public');
      } catch (publicErr: any) {
        console.warn('⚠️  Could not make file public (might not have permissions):', publicErr.message);
      }
      
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      console.log(`🌐 Public URL: ${publicUrl}`);

      console.log('🎉 Upload complete!');
      console.log(`   📊 Stats:`);
      console.log(`      - Job ID: ${jobId}`);
      console.log(`      - File: ${fileName}`);
      console.log(`      - Total nodes: ${jsonData.total_nodes}`);
      console.log(`      - GCS path: gs://${this.bucketName}/${filePath}`);

      return {
        jobId,
        fileName,
        filePath: `gs://${this.bucketName}/${filePath}`,
        publicUrl,
        totalNodes: jsonData.total_nodes
      };
    } catch (error: any) {
      console.error('❌ Error uploading to GCS:', error.message);
      console.error('Error details:', {
        name: error.name,
        code: error.code,
        errors: error.errors
      });
      throw error;
    }
  }

  async uploadCustomJson(jsonContent: any, customJobId?: string): Promise<UploadResult> {
    try {
      console.log('☁️  Starting custom JSON upload to GCS...');

      // Generate job ID
      const jobId = customJobId || `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fileName = `${jobId}.json`;
      const filePath = `${this.basePath}/${fileName}`;

      console.log(`📝 Job ID: ${jobId}`);
      console.log(`📂 Uploading to: gs://${this.bucketName}/${filePath}`);

      // Count nodes in JSON (recursive)
      const countNodes = (obj: any): number => {
        if (typeof obj !== 'object' || obj === null) return 1;
        if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countNodes(item), 0);
        return 1 + (obj.children ? countNodes(obj.children) : 0);
      };

      const totalNodes = countNodes(jsonContent);

      // Upload to GCS
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      const jsonString = typeof jsonContent === 'string' 
        ? jsonContent 
        : JSON.stringify(jsonContent, null, 2);

      await file.save(jsonString, {
        contentType: 'application/json',
        metadata: {
          jobId: jobId,
          totalNodes: totalNodes.toString(),
          uploadedAt: new Date().toISOString()
        }
      });

      console.log('✅ File uploaded successfully!');

      // Make file publicly accessible
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      console.log(`🌐 Public URL: ${publicUrl}`);

      return {
        jobId,
        fileName,
        filePath: `gs://${this.bucketName}/${filePath}`,
        publicUrl,
        totalNodes
      };
    } catch (error: any) {
      console.error('❌ Error uploading custom JSON to GCS:', error.message);
      throw error;
    }
  }
}

export default new GcsUploadService();
