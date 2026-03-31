import express from 'express';
import router from './routes/routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import * as OpenApiValidator from 'express-openapi-validator';

const app = express();

const root = import.meta.dirname;

const corsOptions: cors.CorsOptions = {
    origin: true,
    exposedHeaders: ['ETag'],
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(
    bodyParser.urlencoded({
        extended: true,
        limit: process.env.REQUEST_LIMIT || '100kb',
    })
);
app.use(bodyParser.text({ limit: process.env.REQUEST_LIMIT || '100kb' }));
app.use(bodyParser.json({ limit: process.env.REQUEST_LIMIT || '100kb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.static(`${root}/public`));


const apiSpec = path.join(import.meta.dirname, '/common/api.yml');
const validateResponses = !!(
    process.env.OPENAPI_ENABLE_RESPONSE_VALIDATION &&
    process.env.OPENAPI_ENABLE_RESPONSE_VALIDATION.toLowerCase() === 'true'
);
app.use(process.env.OPENAPI_SPEC || '/', express.static(apiSpec));
app.use(
      OpenApiValidator.middleware({
        apiSpec,
        validateResponses: validateResponses,
        ignorePaths: /.*\/spec(\/|$)/,
        ignoreUndocumented: false,
        
      })
    );

// Routes
app.use('/retail/v1/orders', router);

// Global error handler (should be after routes)
app.use(errorHandler);


export default app;