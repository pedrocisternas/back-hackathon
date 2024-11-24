# Yournal Backend

Este es el backend para la aplicación Yournal, un diario inteligente que procesa entradas de texto para proporcionar insights emocionales.

## Estructura del Proyecto

### Configuración (`/config`)
- `openai.js` - Configuración y credenciales para la API de OpenAI
- `pinecone.js` - Configuración para la base de datos vectorial Pinecone
- `supabase.js` - Configuración para la base de datos principal Supabase

### Núcleo de la Aplicación
- `app.js` - Configuración y middleware de la aplicación Express
- `server.js` - Punto de entrada y configuración del servidor

### API (`/routes`)
- `index.js` - Definición de endpoints y rutas de la API

### Servicios (`/services`)
- `aiService.js` - Lógica de procesamiento de IA y comunicación con OpenAI
- `embeddingService.js` - Generación y gestión de embeddings vectoriales
- `factService.js` - Extracción y procesamiento de datos factuales
- `journalProcessor.js` - Procesamiento principal de las entradas del diario

### Utilidades (`/utils`)
- `insightAnalyzer.js` - Análisis y generación de insights emocionales
- `userRequests.js` - Helpers para manejo de peticiones de usuario


