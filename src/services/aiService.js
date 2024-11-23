import OpenAI from '../config/openai.js';
import { journalProcessor } from './journalProcessor.js';
import axios from 'axios';
import { File } from 'buffer';

export const aiService = {
  async processInput(payload) {
    try {
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

      console.log('📝 Texto a procesar:', text);
      // Create journal entry in Supabase
      const { data: journalEntry, error } = await supabase
        .from('journal_entries')
        .insert([
          {
            content: text,
            type: payload.type,
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

      const results = await journalProcessor.processJournalEntry(
        text,
        payload.user_id
      );
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
};
