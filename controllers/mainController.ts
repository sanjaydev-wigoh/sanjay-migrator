import { Request, Response } from 'express';
import gcsService from '../services/gcsService';
import htmlStyleProcessorService from '../services/htmlStyleProcessorService';
import widgetExtractionService from '../services/widgetExtractionService';
import componentExtractionService from '../services/componentExtractionService';
import aiService from '../services/aiService';
import reconstructionService from '../services/reconstructionService';
import htmlToJsonService from '../services/htmlToJsonService';
import gcsUploadService from '../services/gcsUploadService';

export const fetchGCSFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, css } = await gcsService.fetchFiles();
    res.json({ success: true, data: { html, css } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processHtmlWithStyles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, css } = await gcsService.fetchFiles();
    const result = await htmlStyleProcessorService.processHtml(html, css);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(result.styledHtml);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const extractWidgets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, css } = await gcsService.fetchFiles();
    const styledResult = await htmlStyleProcessorService.processHtml(html, css);
    const widgetResult = await widgetExtractionService.extractWidgets(styledResult.styledHtml);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(widgetResult.modifiedHtml);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const extractComponents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, css } = await gcsService.fetchFiles();
    const styledResult = await htmlStyleProcessorService.processHtml(html, css);
    const widgetResult = await widgetExtractionService.extractWidgets(styledResult.styledHtml);
    const extractionResult = await componentExtractionService.extractComponents(widgetResult.modifiedHtml);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(extractionResult.cleanedHtml);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const optimizeComponents = async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await aiService.optimizeAllComponents();
    
    res.json({
      success: true,
      message: `Successfully optimized ${results.length} components`,
      data: results.map(r => ({
        componentId: r.componentId,
        placeholderId: r.placeholderId,
        originalLines: r.originalLines,
        optimizedLines: r.optimizedLines,
        reductionPercentage: r.reductionPercentage
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOptimizedComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const databaseService = (await import('../services/databaseService')).default;
    const component = await databaseService.getOptimizedComponentById(parseInt(id));
    
    if (!component) {
      res.status(404).json({ success: false, message: 'Optimized component not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(component.optimized_html);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reconstructHtml = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await reconstructionService.reconstructHtml();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(result.reconstructedHtml);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const convertHtmlToJson = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await htmlToJsonService.convertToJson();
    
    // Return pure DOM tree JSON
    res.json(result.json);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadJsonToGcs = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await gcsUploadService.uploadJsonToGcs();
    
    res.json({
      success: true,
      message: 'JSON uploaded to GCS successfully',
      data: {
        jobId: result.jobId,
        fileName: result.fileName,
        filePath: result.filePath,
        publicUrl: result.publicUrl,
        totalNodes: result.totalNodes
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
