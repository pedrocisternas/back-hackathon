import OpenAI from '../config/openai.js';
import { factService } from './factService.js';

export const journalProcessor = {
    async processJournalEntry(text, user_id) {
        try {
            const completion = await OpenAI.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `Analiza el texto y extrae los hechos y emociones principales.
                        
                        REGLAS PARA HECHOS:
                        - Usa frases cortas (3-5 palabras máximo)
                        - Mantén el contexto importante
                        - Usa verbos en infinitivo (ej: "jugar fútbol con amigos")
                        - Evita detalles específicos de tiempo/lugar
                        - Normaliza actividades similares

                        EMOCIONES PERMITIDAS:
                        alegría, tristeza, enojo, miedo, sorpresa, amor, 
                        orgullo, vergüenza, culpa, gratitud, ansiedad, 
                        serenidad, frustración, entusiasmo, satisfacción, felicidad

                        FORMATO DE RESPUESTA:
                        {
                            "entries": [
                                {
                                    "hecho": "frase corta descriptiva",
                                    "emocion": "emoción de la lista"
                                }
                            ]
                        }

                        EJEMPLOS CORRECTOS:
                        ✅ "jugar fútbol con amigos" + "alegría"
                        ✅ "cocinar en familia" + "amor"
                        ✅ "presentar en trabajo" + "ansiedad"

                        EJEMPLOS INCORRECTOS:
                        ❌ "jugar un partido muy emocionante de fútbol" (muy largo)
                        ❌ "felicidad extrema" (emoción no en lista)
                        ❌ "jugué fútbol ayer" (tiempo específico)`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            const response = JSON.parse(completion.choices[0].message.content);
            
            // Transformar y validar la respuesta
            return response.entries.map(entry => ({
                hecho: entry.hecho.toLowerCase(),
                emocion: entry.emocion.toLowerCase(),
                user_id
            }));

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