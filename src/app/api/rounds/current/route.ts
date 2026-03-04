import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 0; // Don't cache this route

export async function GET() {
    try {
        // 1. Hent den aktive runden
        const { data: activeRound, error: roundError } = await supabase
            .from('rounds')
            .select('*')
            .eq('is_active', true)
            .single();

        if (roundError) {
            if (roundError.code === 'PGRST116') {
                // Ingen rader funnet (PGRST116 betyr "ingen data")
                return NextResponse.json({ activeRound: null, candidates: [] });
            }
            throw roundError;
        }

        // 2. Hent kandidatene for den aktive runden (med gjeste-info)
        const { data: candidates, error: candidatesError } = await supabase
            .from('round_candidates')
            .select(`
                id,
                votes,
                guests ( id, name, image_url )
            `)
            .eq('round_id', activeRound.id);

        if (candidatesError) throw candidatesError;

        // 3. Omformuler litt for frontendens skyld
        const formattedCandidates = candidates.map((c: any) => ({
            candidate_id: c.id,
            votes: c.votes,
            guest_id: c.guests.id,
            name: c.guests.name,
            image_url: c.guests.image_url
        }));

        // 4. (Valgfritt) Hent forrige vinner for å vise "på veggen"
        let previousWinner = null;
        if (activeRound.winner_id) {
            const { data: winnerData } = await supabase
                .from('guests')
                .select('name, image_url')
                .eq('id', activeRound.winner_id)
                .single();
            previousWinner = winnerData;
        }

        return NextResponse.json({
            activeRound,
            candidates: formattedCandidates,
            previousWinner
        });

    } catch (error: any) {
        console.error("Fetch current round Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
