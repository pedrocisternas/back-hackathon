import { supabase } from "../config/supabase.js";

/**
 * CRUD operations for facts
 */
export const factService = {
    // Create/Update fact with emotions
    async upsertFact({ hecho, tema, emociones }) {
        try {
            const { data: existingFact } = await supabase
                .from('hechos')
                .select('*')
                .match({ hecho, tema })
                .single();

            const updates = {
                hecho,
                tema,
                count: existingFact ? existingFact.count + 1 : 1,
            };

            // Actualizar cada emoción
            Object.entries(emociones).forEach(([emocion, valor]) => {
                updates[emocion] = existingFact ? existingFact[emocion] + valor : valor;
            });

            const { data, error } = await supabase
                .from('hechos')
                .upsert(updates, {
                    onConflict: 'hecho,tema',
                    returning: 'representation'
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error en upsertFact:', error);
            throw error;
        }
    },

    // Read a specific fact
    async getFact(hecho, tema) {
        const { data, error } = await supabase
            .from('hechos')
            .select('*')
            .match({ hecho, tema })
            .single();

        if (error) throw error;
        return data;
    },

    // Read all facts by theme
    async getFactsByTheme(tema) {
        const { data, error } = await supabase
            .from('hechos')
            .select('*')
            .eq('tema', tema);

        if (error) throw error;
        return data;
    },

    // Get emotional averages for a fact
    async getFactAverages(hecho, tema) {
        const { data, error } = await supabase
            .from('hechos')
            .select('*')
            .match({ hecho, tema })
            .single();

        if (error) throw error;

        const averages = {};
        // Calculamos promedios para cada emoción
        Object.entries(data)
            .filter(([key]) => key !== 'hecho' && key !== 'tema' && key !== 'count' && key !== 'id' && key !== 'creado_en' && key !== 'actualizado_en')
            .forEach(([emocion, valor]) => {
                averages[emocion] = valor / data.count;
            });

        return {
            hecho: data.hecho,
            tema: data.tema,
            count: data.count,
            promedios: averages
        };
    }
};
