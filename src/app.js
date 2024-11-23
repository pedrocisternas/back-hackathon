import express from 'express';
import routes from './routes/index.js';

const app = express();
app.use(express.json());

// Rutas
app.use("/", routes);

export default app;
