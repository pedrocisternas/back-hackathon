import express from 'express';
import { factService } from '../services/factService.js';
import { journalProcessor } from '../services/journalProcessor.js';

const router = express.Router();


// Ruta de prueba con texto hardcodeado
router.get('/test-journal', async (req, res) => {
    try {
        const testText = `
            Hoy fue un día interesante. Jugué fútbol con mis amigos y metí dos goles, 
            me sentí muy feliz y orgulloso. Después visité a mamá y cocinamos juntos, 
            lo cual me alegró mucho. También tuve una reunión en el trabajo que fue 
            algo estresante, pero al final salió bien.
        `;

        console.log('🚀 Iniciando prueba con texto:', testText);
        const results = await journalProcessor.processJournalEntry(testText);
        res.json(results);
    } catch (error) {
        console.error('❌ Error en test-journal:', error);
        res.status(500).json({ error: error.message });
    }
});

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


