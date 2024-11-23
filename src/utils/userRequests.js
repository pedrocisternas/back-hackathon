import OpenAI from '../config/openai.js';
import { initializePinecone } from '../config/pinecone.js';

export async function getUserQueryVector(userId) {
    try {
        const index = await initializePinecone(); // Inicializar Pinecone
        
        const arbitraryVector = new Array(1536).fill(0);  // Vector de 128 dimensiones con valores aleatorios entre 0 y 1

        // Buscar las entradas del usuario en Pinecone utilizando el user_id
        const queryResponse = await index.query({
            vector: arbitraryVector, // No pasamos un vector para esta consulta; solo buscamos las entradas por user_id
            filter: { user_id: userId },  // Usamos el filtro para obtener las entradas del usuario
            topK: 1000,  // Número de entradas más cercanas a devolver
            includeMetadata: true , // Asegurarnos de que los metadatos estén incluidos (hecho, emoción, etc.)
            includeValues: true
        });
        console.log(queryResponse);
        
        // Extraer los vectores combinados de las entradas encontradas
        const userEntries = queryResponse.matches.map(match => ({
            metadata: match.metadata,  // Aquí tienes la metadata
            combinado: match.values  // Aquí añades el embedding combinado
        }));

        
        // Si no se encontraron entradas, devolver un vector vacío o lanzar un error
        if (!userEntries.length) {
            throw new Error('No se encontraron entradas para el usuario');
        }

        // Obtener el embedding combinado de cada entrada y devolver el promedio o el embedding más representativo
        const combinedVectors = userEntries.map(entry => entry.combinado); // Asumiendo que 'combinedEmbedding' es el nombre del campo del embedding combinado
    
        // Puedes devolver un único vector combinado representativo (promedio o más cercano, dependiendo de tu implementación)
        const userQueryVector = averageVectors(combinedVectors);

        return userQueryVector;
    } catch (error) {
        console.error('Error al obtener el vector de consulta del usuario:', error);
        throw error;
    }
}
export async function getUserEntries(userId) {
    try {
        const index = await initializePinecone(); // Inicializar Pinecone
        
        // Buscar las entradas del usuario en Pinecone utilizando el user_id
        const queryResponse = await index.query({
            vector: [],  // No pasamos un vector para esta consulta; solo buscamos las entradas por user_id
            filter: { user_id: userId },  // Usamos el filtro para obtener las entradas del usuario
            topK: 100,  // Número de entradas más cercanas a devolver
            includeMetadata: true  // Asegurarnos de que los metadatos estén incluidos (hecho, emoción, etc.)
        });
        
        // Extraer los vectores combinados de las entradas encontradas
        const userEntries = queryResponse.matches.map(match => match.metadata);
        
        // Si no se encontraron entradas, devolver un vector vacío o lanzar un error
        if (!userEntries.length) {
            throw new Error('No se encontraron entradas para el usuario');
        }

        return userEntries;
    } catch (error) {
        console.error('Error al obtener las entradas del usuario:', error);
        throw error;
    }
}

// Función para promediar los vectores (puedes cambiar esta función si prefieres otro tipo de combinación)
export function averageVectors(vectors) {
    if (vectors.length === 0) return [];


    
    const averagedVector = new Array(1536).fill(0);

    vectors.forEach(vector => {
        vector.forEach((value, index) => {
            averagedVector[index] += value;
        });
    });

    return averagedVector.map(value => value / vectors.length);
}

export async function analyzeMood(userId) {
    const index = await initializePinecone();
    const userQueryVector = await getUserQueryVector(userId); // Obtener el vector combinado del usuario
    
    const queryResponse = await index.query({
        vector: userQueryVector,
        topK: 10,  // Número de vecinos más cercanos que deseas obtener
        includeMetadata: true,  // Asegúrate de incluir la metadata
    });
    

    // Solo trabajar con los k vecinos más cercanos que se devuelven de la consulta
    const similarEntries = queryResponse.matches.map(match => match.metadata);
    console.log(similarEntries);
    // Determinar la emoción más común entre estos vecinos cercanos
    const mood = determineMoodFromEntries(similarEntries); 

    return mood; // Devuelve la emoción correspondiente
}
// Asegúrate de tener la librería instalada para interactuar con OpenAI

export async function determineMoodFromEntries(entries) {
    // Recopilar todas las emociones de los entries
    const emotions = entries.map(entry => entry.emocion);
    console.log(emotions);
    // Generar una consulta a OpenAI basada en la lista de emociones
    const mood = await determineMoodFromOpenAI(emotions);

    return mood;
}

export async function determineMoodFromOpenAI(emotions) {
    try {
        // Formatear la lista de emociones para enviar a OpenAI
        const emotionList = emotions.join(", ");

        // Enviar la lista de emociones a OpenAI para determinar el mood
        const response = await OpenAI.chat.completions.create({
            model: "gpt-3.5-turbo", // Actualizado el modelo
            messages: [
                {
                    role: "system",
                    content: "Eres un experto en análisis emocional que proporciona estados de ánimo optimistas y motivacionales."
                },
                {
                    role: "user",
                    content: `A continuación se presentan varias emociones: ${emotionList}. ¿Cuál es el estado de ánimo general asociado con estas emociones? no menciones las emociones, solo el estado de ánimo. Responde con un estado de ánimo optimista y motivacional, basado en las emociones proporcionadas.`
                }
            ],
            max_tokens: 150,
            temperature: 0.7
        });

        // Procesar la respuesta de OpenAI
        const mood = response.choices[0].message.content.trim();
        console.log(mood);

        return mood;
    } catch (error) {
        console.error('Error al obtener el mood desde OpenAI:', error);
        return 'Estado de ánimo no disponible';
    }
}