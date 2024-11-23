async function getUserQueryVector(userId) {
    try {
        const index = await initializePinecone(); // Inicializar Pinecone
        
        // Buscar las entradas del usuario en Pinecone utilizando el user_id
        const queryResponse = await index.query({
            vector: [],  // No pasamos un vector para esta consulta; solo buscamos las entradas por user_id
            filter: { user_id: userId },  // Usamos el filtro para obtener las entradas del usuario
            top_k: 100,  // Número de entradas más cercanas a devolver
            includeMetadata: true  // Asegurarnos de que los metadatos estén incluidos (hecho, emoción, etc.)
        });
        
        // Extraer los vectores combinados de las entradas encontradas
        const userEntries = queryResponse.matches.map(match => match.metadata);
        
        // Si no se encontraron entradas, devolver un vector vacío o lanzar un error
        if (!userEntries.length) {
            throw new Error('No se encontraron entradas para el usuario');
        }

        // Obtener el embedding combinado de cada entrada y devolver el promedio o el embedding más representativo
        const combinedVectors = userEntries.map(entry => entry.combinedEmbedding); // Asumiendo que 'combinedEmbedding' es el nombre del campo del embedding combinado
        
        // Puedes devolver un único vector combinado representativo (promedio o más cercano, dependiendo de tu implementación)
        const userQueryVector = averageVectors(combinedVectors);

        return userQueryVector;
    } catch (error) {
        console.error('Error al obtener el vector de consulta del usuario:', error);
        throw error;
    }
}

// Función para promediar los vectores (puedes cambiar esta función si prefieres otro tipo de combinación)
function averageVectors(vectors) {
    if (vectors.length === 0) return [];

    const vectorLength = vectors[0].length;
    const averagedVector = new Array(vectorLength).fill(0);

    vectors.forEach(vector => {
        vector.forEach((value, index) => {
            averagedVector[index] += value;
        });
    });

    return averagedVector.map(value => value / vectors.length);
}