import OpenAI from '../config/openai.js';
import { journalProcessor } from './journalProcessor.js';
import { embeddingService } from './embeddingService.js';
import { supabase } from '../config/supabase.js';
import { getEmotionalInsights, getEmotionsFromFact } from '../utils/insightAnalyzer.js';

export const aiService = {
  async extractText(payload) {
    console.time(`[${payload.source}] extractText`);
    let text;

    if (payload.type === 'audio') {
      console.log(`🎤 [${payload.source}] Iniciando transcripción de audio`);
      const transcription = await this.transcribeAudio(payload);
      if (!transcription || !transcription.trim()) {
        throw new Error('La transcripción del audio está vacía');
      }
      text = transcription;
    } else {
      if (!payload.content || !payload.content.trim()) {
        throw new Error('El contenido del mensaje está vacío');
      }
      text = payload.content;
    }

    console.timeEnd(`[${payload.source}] extractText`);
    return text;
  },

  async processInput(payload, skipJournalEntry = false) {
    console.time('[FULL_ANALYSIS] processInput');
    try {
      console.log('🔄 [FULL_ANALYSIS] Iniciando procesamiento completo');
      const text = await this.extractText({ ...payload, source: 'FULL_ANALYSIS' });

      let journalEntry;
      if (!skipJournalEntry) {
        // Create journal entry in Supabase
        console.time('[FULL_ANALYSIS] supabase-insert');
        const { data, error } = await supabase
          .from('journal_entries')
          .insert([
            {
              content: text,
              user_id: payload.user_id,
            },
          ])
          .select()
          .single();
        console.timeEnd('[FULL_ANALYSIS] supabase-insert');

        if (error) {
          console.error('Error creating journal entry:', error);
          throw error;
        }
        
        journalEntry = data;
        console.log('📔 Journal entry created:', journalEntry);
      }

      console.log('📝 Texto a procesar:', text);

      // 1. Procesar el texto para obtener hechos y emociones
      const results = await journalProcessor.processJournalEntry(text, payload.user_id);

      // 2. Para cada resultado, generar y almacenar embeddings
      for (const entry of results) {
        // Generar embeddings
        const vectors = await embeddingService.generateEmbeddings({
          hecho: entry.hecho,
          emocion: entry.emocion
        });

        // Almacenar en Pinecone
        await embeddingService.storeVectors({
          hecho: entry.hecho,
          emocion: entry.emocion,
          vectors,
          user_id: entry.user_id
        });
      }

      console.timeEnd('[FULL_ANALYSIS] processInput');
      return results;
    } catch (error) {
      console.error('❌ [FULL_ANALYSIS] Error en processInput:', error);
      throw error;
    }
  },

  async transcribeAudio(payload) {
    const source = payload.source;
    console.time(`[${source}] transcribeAudio`);
    try {
        console.log(`🎤 [${source}] Descargando audio desde:`, payload.content);

        // Descargar el archivo usando fetch
        const response = await fetch(payload.content);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Obtener el blob directamente
        const audioBlob = await response.blob();
        
        // Detectar el tipo MIME real del blob
        const actualType = audioBlob.type;
        console.log(`🔍 [${source}] Tipo MIME detectado:`, actualType);

        // Mapear el tipo MIME correcto según el tipo real
        const mimeTypes = {
            'audio/mp4': 'audio/mp4',
            'audio/mpeg': 'audio/mpeg',
            'audio/wav': 'audio/wav',
            'audio/webm': 'audio/webm',
            'audio/ogg': 'audio/ogg',
            'audio/x-m4a': 'audio/mp4'
        };

        // Determinar la extensión correcta basada en el tipo MIME real
        const extensionMap = {
            'audio/mp4': 'mp4',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/webm': 'webm',
            'audio/ogg': 'ogg',
            'audio/x-m4a': 'm4a'
        };

        // Usar el tipo MIME real o fallback a mp4 para iOS
        const mimeType = mimeTypes[actualType] || 'audio/mp4';
        const extension = extensionMap[actualType] || 'm4a';

        // Crear un nuevo Blob con el tipo MIME correcto
        const newBlob = new Blob([await audioBlob.arrayBuffer()], { type: mimeType });

        // Crear un File object
        const file = new File(
            [newBlob],
            `audio.${extension}`,
            { type: mimeType }
        );

        console.log(`📁 [${source}] Archivo preparado:`, {
            extension,
            mimeType,
            size: file.size,
            originalType: actualType,
            newType: file.type
        });

        // Crear FormData con el archivo
        const formData = new FormData();
        formData.append('file', file);

        // Transcribir el audio usando OpenAI
        const transcription = await OpenAI.audio.transcriptions.create({
            file: formData.get('file'),
            model: 'whisper-1',
            language: 'es',
            response_format: 'text'
        });

        if (!transcription || !transcription.trim()) {
            throw new Error('La transcripción está vacía');
        }

        console.log(`🎤 [${source}] Audio transcrito:`, transcription);
        console.timeEnd(`[${source}] transcribeAudio`);
        return transcription;
    } catch (error) {
        console.error(`❌ [${source}] Error transcribiendo audio:`, error);
        console.error('Detalles del error:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            payload: payload,
            url: payload.content,
            mimeType: audioBlob?.type
        });
        throw error;
    }
},

  async getQuickAnalysis(payload) {
    console.time('[QUICK_ANALYSIS] getQuickAnalysis');
    try {
      console.log('🔄 [QUICK_ANALYSIS] Iniciando análisis rápido');
      const text = await this.extractText({ ...payload, source: 'QUICK_ANALYSIS' });
      
      console.time('[QUICK_ANALYSIS] gpt-analysis');
      const prompt = {
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: "Eres un psicólogo empático analizando el estado emocional del usuario. Analiza el texto y devuelve un JSON con el siguiente formato: { title: string (título emotivo que resuma el estado de ánimo), description: string (análisis profesional y empático hablándole directamente al usuario, en 12 palabras máximo. Que sea breve y al grano), mood_emoji: string (un emoji que represente el estado de ánimo), insights: Array<{text: string, type: 'positive' | 'negative'}> (entre 1 y 3 observaciones personalizadas sobre patrones o comportamientos identificados en el texto, cada una con su tipo) }"
        }, {
          role: "user",
          content: text
        }],
        response_format: { type: "json_object" }
      };

      const completion = await OpenAI.chat.completions.create(prompt);
      const analysis = JSON.parse(completion.choices[0].message.content);
      console.timeEnd('[QUICK_ANALYSIS] gpt-analysis');

      // Procesar el texto en background sin esperar la respuesta
      console.log('🔄 [QUICK_ANALYSIS] Iniciando procesamiento en background');
      this.processInput({ ...payload, journalEntryId: null }).catch(error => {
        console.error('[QUICK_ANALYSIS] Error en procesamiento background:', error);
      });

      console.timeEnd('[QUICK_ANALYSIS] getQuickAnalysis');
      return analysis;
    } catch (error) {
      console.error('❌ [QUICK_ANALYSIS] Error en getQuickAnalysis:', error);
      throw error;
    }
  },

  async getInsightResponse(userId, userQuestion) {
    try {
        console.time('[AI_INSIGHT] getInsightResponse');
        
        const response = await OpenAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Eres un asistente empático especializado en análisis emocional. Tienes acceso a dos funciones:
                    1. getEmotionalInsights(userId, emotion): Para preguntas sobre estados emocionales
                    2. getEmotionsFromFact(userId, fact): Para preguntas sobre actividades específicas

                    Instrucciones para el uso de funciones:
                    - SIEMPRE intenta relacionar la pregunta con alguna de las funciones disponibles
                    - Para preguntas sobre recomendaciones o decisiones, usa getEmotionsFromFact con la actividad mencionada
                    - Para preguntas sobre estados de ánimo o sentimientos, usa getEmotionalInsights
                    
                    Ejemplos de mapeo:
                    - "Me recomendarías seguir estudiando?" -> getEmotionsFromFact(userId, "estudiar")
                    - "Debería cambiar de trabajo?" -> getEmotionsFromFact(userId, "trabajo")
                    - "Por qué me siento así?" -> getEmotionalInsights(userId, "tristeza")
                    - "Qué me hace feliz?" -> getEmotionalInsights(userId, "felicidad")

                    Instrucciones de respuesta:
                    - Para emociones positivas: enfócate SOLO en experiencias positivas
                    - Para emociones negativas o actividades: mantén un tono constructivo
                    - Sé conciso (máximo 3 oraciones)
                    - Si NO puedes relacionar la pregunta con ninguna función:
                      * Explica amablemente que no tienes datos suficientes
                      * Sugiere reformular la pregunta hacia emociones o actividades específicas
                      * Mantén un tono positivo y servicial`
                },
                {
                    role: "user",
                    content: userQuestion
                }
            ],
            functions: [
                {
                    name: "getEmotionalInsights",
                    description: "Obtiene insights sobre qué situaciones provocan una emoción específica",
                    parameters: {
                        type: "object",
                        properties: {
                            userId: { type: "string" },
                            emotion: { type: "string" }
                        },
                        required: ["userId", "emotion"]
                    }
                },
                {
                    name: "getEmotionsFromFact",
                    description: "Obtiene insights sobre qué emociones genera una actividad específica",
                    parameters: {
                        type: "object",
                        properties: {
                            userId: { type: "string" },
                            fact: { type: "string" }
                        },
                        required: ["userId", "fact"]
                    }
                }
            ],
            function_call: "auto",
            temperature: 0.7,
            max_tokens: 250
        });

        // Si no hay llamada a función, dar una respuesta explicativa
        if (!response.choices[0].message.function_call) {
            return {
                success: true,
                question: userQuestion,
                answer: "Disculpa, no tengo suficiente información en tu diario para responder esa pregunta específica. ¿Podrías reformularla enfocándote en una emoción que sientes o una actividad específica? Por ejemplo, podrías preguntarme sobre cómo te sientes cuando haces cierta actividad o qué situaciones te generan cierta emoción.",
                data: null
            };
        }

        // Ejecutar la función correspondiente
        let insightData;
        const functionCall = response.choices[0].message.function_call;
        
        if (functionCall.name === "getEmotionalInsights") {
            const { emotion } = JSON.parse(functionCall.arguments);
            insightData = await getEmotionalInsights(userId, emotion);
        } else {
            const { fact } = JSON.parse(functionCall.arguments);
            insightData = await getEmotionsFromFact(userId, fact);
        }

        // Obtener la respuesta final
        const finalResponse = await OpenAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Genera una respuesta empática y constructiva basada en los datos proporcionados.
                    - Si los datos son sobre una emoción positiva, mantén el foco SOLO en lo positivo
                    - Si son sobre una emoción negativa o actividad, mantén un tono esperanzador
                    - Sé conciso pero amable (máximo 3 oraciones)
                    - Responde directamente a la pregunta original
                    - Si los datos son limitados, sugiere amablemente formas de obtener más información`
                },
                {
                    role: "user",
                    content: userQuestion
                },
                {
                    role: "function",
                    name: functionCall.name,
                    content: JSON.stringify(insightData)
                }
            ],
            max_tokens: 250,
            temperature: 0.7
        });

        console.timeEnd('[AI_INSIGHT] getInsightResponse');
        
        return {
            success: true,
            question: userQuestion,
            answer: finalResponse.choices[0].message.content,
            data: insightData
        };

    } catch (error) {
        console.error('Error en getInsightResponse:', error);
        throw error;
    }
}
};