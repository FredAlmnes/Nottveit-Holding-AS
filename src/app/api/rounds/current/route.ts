import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

export const revalidate = 0; // Don't cache this route

export async function GET() {
    try {
        // 1. Hent den SISTE aktive runden. Bruker limit(1)+order istedenfor .single() 
        //    slik at vi ikke krasjer om det skulle finnes flere aktive runder.
        const { data: activeRounds, error: roundError } = await supabaseAdmin
            .from('rounds')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (roundError) {
            console.error("Round error:", roundError.message);
            return NextResponse.json({ error: roundError.message }, { status: 500 });
        }

        if (!activeRounds || activeRounds.length === 0) {
            return NextResponse.json({ activeRound: null, candidates: [] });
        }

        const activeRound = activeRounds[0];

        // 2. Hent kandidatene for den aktive runden (med gjeste-info)
        const { data: candidates, error: candidatesError } = await supabaseAdmin
            .from('round_candidates')
            .select(`
                id,
                votes,
                guests ( id, name, image_url )
            `)
            .eq('round_id', activeRound.id);

        if (candidatesError) {
            console.error("Candidates error:", candidatesError.message);
            return NextResponse.json({ error: candidatesError.message }, { status: 500 });
        }

        // 3. Omformuler for frontend
        const formattedCandidates = (candidates || []).map((c: any) => ({
            candidate_id: c.id,
            votes: c.votes,
            guest_id: c.guests?.id,
            name: c.guests?.name,
            image_url: c.guests?.image_url
        }));

        // 4. Hent forrige vinner
        let previousWinner = null;
        if (activeRound.winner_id) {
            const { data: winnerData } = await supabaseAdmin
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
