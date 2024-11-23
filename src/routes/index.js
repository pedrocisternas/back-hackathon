import express from 'express';
import { factService } from '../services/factService.js';
import { journalProcessor } from '../services/journalProcessor.js';
import { aiService } from '../services/aiService.js';
import multer from 'multer';
import { embeddingService } from '../services/embeddingService.js';

const router = express.Router();

router.post('/journal-fast-response', async (req, res) => {
    try {
      console.log('🚀 Iniciando respuesta rápida con payload:', req.body);
      const payload = req.body;
  
      const results = await aiService.getQuickAnalysis(payload);
      res.json(results);
    } catch (error) {
      console.error('Error en POST /journal-fast-response:', error);
      res.status(500).json({ error: error.message });
    }
  });

router.post('/chat', async (req, res) => {
  try {
    console.log('🚀 Iniciando chat con payload:', req.body);
    const payload = req.body;

    const results = await aiService.processInput(payload);
    res.json(results);
  } catch (error) {
    console.error('Error en POST /chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rutas de prueba (se pueden eliminar)
// Ruta de prueba con texto hardcodeado
router.post('/journal', async (req, res) => {
    try {
      const { text, user_id } = req.body;
  
      if (!text || !user_id) {
        return res.status(400).json({ 
          error: 'Se requieren los campos "text" y "user_id"' 
        });
      }
  
      console.log('🚀 Procesando entrada de diario:', { text, user_id });
      const results = await journalProcessor.processJournalEntry(text, user_id);
      res.json(results);
    } catch (error) {
      console.error('❌ Error en POST /journal:', error);
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
  
  const upload = multer();

// Endpoint para crear embeddings y almacenarlos en Pinecone
router.post('/embeddings', async (req, res) => {
    try {
        const { hecho, emocion, user_id } = req.body;

        if (!hecho || !emocion || !user_id) {
            return res.status(400).json({ 
                error: 'Se requieren los campos "hecho", "emocion" y "user_id"' 
            });
        }

        console.log('📥 Procesando:', { hecho, emocion, user_id });

        // 1. Generar embeddings
        const vectors = await embeddingService.generateEmbeddings({ 
            hecho, 
            emocion 
        });

        // 2. Almacenar en Pinecone
        await embeddingService.storeVectors({ 
            hecho, 
            emocion, 
            vectors,
            user_id 
        });

        res.json({ 
            success: true, 
            message: 'Embeddings generados y almacenados',
            data: { hecho, emocion, user_id }
        });

    } catch (error) {
        console.error('❌ Error en POST /embeddings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para buscar similitudes
router.post('/search', async (req, res) => {
    try {
        const { texto, tipo = 'hecho', topK = 5 } = req.body;

        if (!texto) {
            return res.status(400).json({ 
                error: 'Se requiere el campo "texto"' 
            });
        }

        // 1. Generar embedding para el texto de búsqueda
        const searchEmbedding = await embeddingService.generateEmbeddings({ 
            hecho: texto, 
            emocion: texto // usamos el mismo texto para ambos ya que solo necesitamos uno
        });

        // 2. Buscar similitudes usando el vector correspondiente
        const vector = tipo === 'hecho' ? searchEmbedding.hechoVector : searchEmbedding.emocionVector;
        const results = await embeddingService.searchSimilar({ 
            vector,
            tipo,
            topK 
        });

        res.json({ 
            success: true,
            results: results.map(match => ({
                hecho: match.metadata.hecho,
                emocion: match.metadata.emocion,
                score: match.score,
                user_id: match.metadata.user_id
            }))
        });

    } catch (error) {
        console.error('❌ Error en POST /search:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
