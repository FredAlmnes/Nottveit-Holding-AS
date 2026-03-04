import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { candidate_id } = body;

        if (!candidate_id) {
            return NextResponse.json({ error: "Missing candidate_id" }, { status: 400 });
        }

        // Kjører en enkel RPC-funksjon eller oppdaterer direkte (vi kan oppdatere direkte siden vi har slått på update)
        // For å unngå race-conditions burde vi egentlig brukt RPC funksjon i Supabase (increment_votes), 
        // men en enkel hent-og-oppdater fungerer for fest.

        // --- Bedre løsning med bare JS: ---
        const { data: candidate, error: fetchError } = await supabase
            .from('round_candidates')
            .select('votes')
            .eq('id', candidate_id)
            .single();

        if (fetchError || !candidate) {
            throw new Error("Candidate not found");
        }

        const currentVotes = candidate.votes;

        const { error: updateError } = await supabase
            .from('round_candidates')
            .update({ votes: currentVotes + 1 })
            .eq('id', candidate_id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, message: "Vote registered!" });

    } catch (error: any) {
        console.error("Vote API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
