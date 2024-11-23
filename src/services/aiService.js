import OpenAI from '../config/openai.js';
import { journalProcessor } from './journalProcessor.js';
import axios from 'axios';
import { File } from 'buffer';
import { embeddingService } from './embeddingService.js';
import { supabase } from '../config/supabase.js';

export const aiService = {
  async extractText(payload) {
    let text;

    if (payload.type === 'audio') {
      const transcription = await this.transcribeAudio(payload.content);
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

    return text;
  },

  async processInput(payload) {
    try {
      const text = await this.extractText(payload);

      // Create journal entry in Supabase
      const { data: journalEntry, error } = await supabase
        .from('journal_entries')
        .insert([
          {
            content: text,
            user_id: payload.user_id,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating journal entry:', error);
        throw error;
      }

      console.log('📔 Journal entry created:', journalEntry);


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

      return results;
    } catch (error) {
      console.error('❌ Error en processInput:', error);
      throw error;
    }
  },

  async transcribeAudio(audioUrl) {
    try {
      console.log('🎤 Descargando audio desde:', audioUrl);

      // Descargar el archivo usando fetch
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener el blob directamente
      const audioBlob = await response.blob();

      // Crear un FormData para enviar a OpenAI
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      // Transcribir el audio usando OpenAI
      const transcription = await OpenAI.audio.transcriptions.create({
        file: formData.get('file'),
        model: 'whisper-1',
        language: 'es',
      });

      if (!transcription || !transcription.text) {
        throw new Error('La transcripción está vacía');
      }

      console.log('🎤 Audio transcrito:', transcription.text);
      return transcription.text;
    } catch (error) {
      console.error('❌ Error transcribiendo audio:', error);
      throw error;
    }
  },

  async getQuickAnalysis(payload) {
    try {
      const text = await this.extractText(payload);
      
      const prompt = {
        model: "gpt-4-turbo-preview",
        messages: [{
          role: "system",
          content: "Eres un psicólogo empático analizando el estado emocional del usuario. Analiza el texto y devuelve un JSON con el siguiente formato: { title: string (título emotivo que resuma el estado de ánimo), description: string (análisis profesional y empático en tercera persona sobre el estado emocional del usuario, en 2 líneas), mood_emoji: string (un emoji que represente el estado de ánimo), recommendations: Array<{activity: string, duration: string}> (3 actividades recomendadas con su duración) }"
        }, {
          role: "user",
          content: text
        }],
        response_format: { type: "json_object" }
      };

      const completion = await OpenAI.chat.completions.create(prompt);
      const analysis = JSON.parse(completion.choices[0].message.content);

      // Procesar el texto en background sin esperar la respuesta
      this.processInput(payload).catch(error => {
        console.error('Error en procesamiento background:', error);
      });

      return analysis;
    } catch (error) {
      console.error('❌ Error en getQuickAnalysis:', error);
      throw error;
    }
  }
};
