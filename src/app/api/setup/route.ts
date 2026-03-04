import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Bruker SERVICE_ROLE_KEY her for admin-rettigheter slik at vi kan overstyre RLS og dytte inn mock-data
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

const MOCK_GUESTS = [
    { name: "Kari Nordmann", image_url: "https://i.pravatar.cc/150?img=1" },
    { name: "Ola Nordmann", image_url: "https://i.pravatar.cc/150?img=11" },
    { name: "Per Pålsson", image_url: "https://i.pravatar.cc/150?img=33" },
    { name: "Espen Askeladd", image_url: "https://i.pravatar.cc/150?img=14" },
    { name: "Nils Nilsen", image_url: "https://i.pravatar.cc/150?img=15" },
    { name: "Ine Inesen", image_url: "https://i.pravatar.cc/150?img=16" },
    { name: "Sara Sarasen", image_url: "https://i.pravatar.cc/150?img=17" },
    { name: "Jens Jensen", image_url: "https://i.pravatar.cc/150?img=18" },
    { name: "Trude Trudesen", image_url: "https://i.pravatar.cc/150?img=19" },
    { name: "Geir Geirsen", image_url: "https://i.pravatar.cc/150?img=60" },
];

export async function POST() {
    try {
        // 1. Sett inn mock-gjester (hvis tabellen er tom)
        const { data: existingGuests, error: countError } = await supabaseAdmin.from('guests').select('id').limit(1);

        if (countError) throw countError;

        let guestsList = [];

        if (!existingGuests || existingGuests.length === 0) {
            console.log("No guests found. Seeding database...");
            const { data: insertedGuests, error: insertError } = await supabaseAdmin
                .from('guests')
                .insert(MOCK_GUESTS)
                .select();

            if (insertError) throw insertError;
            guestsList = insertedGuests;
        } else {
            console.log("Guests already exist. Skipping seed.");
            const { data: allGuests } = await supabaseAdmin.from('guests').select('*');
            guestsList = allGuests || [];
        }

        // Sørg for at vi har gjester før vi fortsetter
        if (guestsList.length < 3) {
            return NextResponse.json({ error: "Not enough guests to start a round" }, { status: 400 });
        }

        // 2. Sjekk om vi har en aktiv runde
        const { data: activeRound, error: activeRoundError } = await supabaseAdmin
            .from('rounds')
            .select('*')
            .eq('is_active', true)
            .single();

        // Ignorer error hvis "0 rows returned" (forventet hvis ingen runder finnes)
        if (activeRoundError && activeRoundError.code !== 'PGRST116') {
            throw activeRoundError;
        }

        if (!activeRound) {
            console.log("No active round found. Creating the first one...");

            // Opprett en ny runde
            const { data: newRound, error: roundError } = await supabaseAdmin
                .from('rounds')
                .insert([{ is_active: true }])
                .select()
                .single();

            if (roundError) throw roundError;

            // Trekk 3 unike, tilfeldige gjester   
            const shuffled = [...guestsList].sort(() => 0.5 - Math.random());
            const selectedCandidates = shuffled.slice(0, 3);

            // Lagre dem som kandidater for runden
            const candidatesToInsert = selectedCandidates.map(c => ({
                round_id: newRound.id,
                guest_id: c.id,
                votes: 0
            }));

            const { error: candidatesError } = await supabaseAdmin
                .from('round_candidates')
                .insert(candidatesToInsert);

            if (candidatesError) throw candidatesError;

            return NextResponse.json({ message: "Seeded and first round created!", round: newRound });
        }

        return NextResponse.json({ message: "Database already seeded and a round is active." });

    } catch (error: any) {
        console.error("Setup API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
