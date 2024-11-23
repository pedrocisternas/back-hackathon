import OpenAI from '../config/openai.js';
import { factService } from './factService.js';

export const journalProcessor = {
    async processJournalEntry(text) {
        try {
            console.log('🔵 Iniciando procesamiento de entrada:', text);

            // 1. Obtener estructura de referencia
            const referenceStructure = await factService.getReferenceStructure();
            console.log('📚 Estructura de referencia obtenida:', JSON.stringify(referenceStructure, null, 2));
            
            // 2. Procesar el texto con OpenAI
            const analysis = await this.analyzeText(text, referenceStructure);
            
            // 3. Asegurarnos de que analysis.hechos existe y es un array
            if (!analysis.hechos || !Array.isArray(analysis.hechos)) {
                console.error('❌ La respuesta de OpenAI no tiene el formato esperado:', analysis);
                throw new Error('Formato de respuesta inválido de OpenAI');
            }
            
            // 4. Procesar cada hecho identificado
            const results = await Promise.all(
                analysis.hechos.map(fact => factService.upsertFact(fact))
            );
            console.log('Procesamiento exitoso.');

            return results;
        } catch (error) {
            console.error('❌ Error en processJournalEntry:', error);
            throw error;
        }
    },

    async analyzeText(text, referenceStructure) {
        try {
            const completion = await OpenAI.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `Analiza el texto y extrae los hechos mencionados junto con sus emociones asociadas.
                                 
                                 Temas y hechos disponibles:
                                 ${Object.entries(referenceStructure.temas)
                                     .map(([tema, hechos]) => `${tema}: ${hechos.join(', ')}`)
                                     .join('\n')}

                                 Emociones posibles:
                                 ${referenceStructure.emociones.join(', ')}

                                 Reglas:
                                 1. Usa los nombres exactos de hechos existentes
                                 2. Para hechos nuevos, usa "Otro" en el tema correspondiente
                                 3. Solo incluye emociones con valor > 0
                                 4. Valores de emociones entre 0 y 1

                                 Formato JSON de respuesta:
                                 {
                                    "message": "texto original analizado",
                                    "hechos": [
                                        {
                                            "hecho": "nombre exacto del hecho",
                                            "tema": "tema correspondiente",
                                            "emociones": {
                                                // solo emociones con valor > 0
                                            }
                                        }
                                    ]
                                 }`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            const responseContent = completion.choices[0].message.content;
            console.log('📝 Respuesta cruda de OpenAI:', responseContent);
            
            try {
                const response = JSON.parse(responseContent);
                
                // Validar la estructura básica
                if (!response.message || !response.hechos || !Array.isArray(response.hechos)) {
                    throw new Error('Formato de respuesta inválido');
                }

                // Validar cada hecho
                response.hechos = response.hechos.map(hecho => {
                    // Verificar que el tema existe
                    if (!referenceStructure.temas[hecho.tema]) {
                        throw new Error(`Tema inválido: ${hecho.tema}`);
                    }
                    // Verificar que el hecho pertenece al tema
                    if (!referenceStructure.temas[hecho.tema].includes(hecho.hecho)) {
                        throw new Error(`Hecho '${hecho.hecho}' no válido para el tema '${hecho.tema}'`);
                    }
                    
                    // Mantener solo las emociones con valor > 0
                    return {
                        hecho: hecho.hecho,
                        tema: hecho.tema,
                        emociones: Object.fromEntries(
                            Object.entries(hecho.emociones)
                                .filter(([_, valor]) => valor > 0)
                        )
                    };
                });
                
                return response;
            } catch (parseError) {
                console.error('❌ Error procesando respuesta:', parseError);
                throw new Error(`Error procesando respuesta: ${parseError.message}`);
            }
        } catch (error) {
            console.error('❌ Error en analyzeText:', error);
            throw error;
        }
    }
};