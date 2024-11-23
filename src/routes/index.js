import express from 'express';
import { factService } from '../services/factService.js';

const router = express.Router();

// Ruta de prueba para upsertFact
router.post('/facts', async (req, res) => {
    try {
        const result = await factService.upsertFact(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error en POST /facts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta de prueba simple
router.get('/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
});


export default router;


