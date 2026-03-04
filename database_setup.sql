-- Opprett 'guests'-tabellen
CREATE TABLE public.guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opprett 'rounds'-tabellen
CREATE TABLE public.rounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    winner_id UUID REFERENCES public.guests(id) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opprett 'round_candidates'-tabellen (kandidatene for en gitt runde)
CREATE TABLE public.round_candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(round_id, guest_id)
);

-- Slå på Row Level Security (RLS) slik at vi kan tillate lesing fra web, 
-- og deaktiverer sletting fra klienten (hvis nødvendig).
-- For dette bursdagsprosjektet kan vi gjøre dataen åpen for alle lokalt.
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_candidates ENABLE ROW LEVEL SECURITY;

-- Tillat anonym lesetilgang
CREATE POLICY "Allow public read access to guests" ON public.guests FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Allow public read access to round_candidates" ON public.round_candidates FOR SELECT USING (true);

-- Tillat anonym oppdatering av stemmer (for at klienter kan stemme uten log in)
CREATE POLICY "Allow public update access to round_candidates votes" ON public.round_candidates FOR UPDATE USING (true);

-- Aktiver Supabase Realtime for runder og kandidater!
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_candidates;
