import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(req: Request) {
    try {
        // Enkel sikkerhet: Hvis du vil, kan du sjekke en secret nøkkel sendt inn via header, 
        // men for en fest-app lar vi denne gjerne stå litt åpen, 
        // eller bare styrt fra en intern TV.

        // 1. Finn aktiv runde og dens kandidater
        const { data: activeRound, error: activeRoundError } = await supabaseAdmin
            .from('rounds')
            .select('*')
            .eq('is_active', true)
            .single();

        if (activeRoundError && activeRoundError.code !== 'PGRST116') throw activeRoundError;

        let winnerId = null;

        // 2. Hvis det finnes en aktiv runde, finn vinneren og lukk den
        if (activeRound) {
            // Hent kandidatene og finn hvem som har flest stemmer
            const { data: candidates } = await supabaseAdmin
                .from('round_candidates')
                .select('*')
                .eq('round_id', activeRound.id)
                .order('votes', { ascending: false });

            if (candidates && candidates.length > 0) {
                // Den med flest stemmer vinner (eventuelt uavgjort plukker første i arrayet)
                winnerId = candidates[0].guest_id;
            }

            // Marker runden som fullført (inaktiv) og sett forrige rulles vinner hvis noen fantes
            const { error: updateError } = await supabaseAdmin
                .from('rounds')
                .update({ is_active: false })
                .eq('id', activeRound.id);

            if (updateError) throw updateError;
        }

        // 3. Hent ALLE gjester for å trekke nye
        const { data: allGuests, error: guestsError } = await supabaseAdmin
            .from('guests')
            .select('id');

        if (guestsError || !allGuests) throw new Error("Could not fetch guests");

        if (allGuests.length < 3) {
            return NextResponse.json({ error: "Not enough guests in DB to start a round" }, { status: 400 });
        }

        // --- AVANSERT (Men enkel nok) LOGIKK: Finn vinnere / de som har blitt trukket før ---
        // For å unngå at samme person trekkes igjen og igjen, 
        // kan vi f.eks. bare velge 3 helt tilfeldige hver gang. 
        // For en fest er tilfeldig ofte det enkleste.

        const shuffled = [...allGuests].sort(() => 0.5 - Math.random());
        // Sikre at vi ikke trekker forrige vinner med én gang hvis vi har nok gjester
        let validCandidates = shuffled;
        if (winnerId && shuffled.length > 4) {
            validCandidates = shuffled.filter(g => g.id !== winnerId);
        }

        const selectedForNextRun = validCandidates.slice(0, 3);

        // 4. Opprett NY runde
        const { data: newRound, error: insertRoundError } = await supabaseAdmin
            .from('rounds')
            .insert([{
                is_active: true,
                winner_id: winnerId // Den nye runden husker hvem som vant forrige!
            }])
            .select()
            .single();

        if (insertRoundError) throw insertRoundError;

        // 5. Sett inn nye kandidater
        const candidatesToInsert = selectedForNextRun.map(c => ({
            round_id: newRound.id,
            guest_id: c.id,
            votes: 0
        }));

        const { error: candidatesError } = await supabaseAdmin
            .from('round_candidates')
            .insert(candidatesToInsert);

        if (candidatesError) throw candidatesError;

        return NextResponse.json({
            success: true,
            message: "Next round started!",
            newRound
        });

    } catch (error: any) {
        console.error("Next round API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
