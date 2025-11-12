require('dotenv').config();
require('ts-node').register();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const gcsRoutes = require('./routes/gcsRoutes.ts').default;
const htmlProcessorRoutes = require('./routes/htmlProcessorRoutes.ts').default;
const widgetRoutes = require('./routes/widgetRoutes.ts').default;
const componentRoutes = require('./routes/componentRoutes.ts').default;
const aiRoutes = require('./routes/aiRoutes.ts').default;
const reconstructionRoutes = require('./routes/reconstructionRoutes.ts').default;
const htmlToJsonRoutes = require('./routes/htmlToJsonRoutes.ts').default;
const gcsUploadRoutes = require('./routes/gcsUploadRoutes.ts').default;

app.use('/api/gcs', gcsRoutes);
app.use('/api/html-processor', htmlProcessorRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reconstruction', reconstructionRoutes);
app.use('/api/html-to-json', htmlToJsonRoutes);
app.use('/api/gcs-upload', gcsUploadRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
