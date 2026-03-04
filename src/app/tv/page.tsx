"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";

export default function TvDashboard() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [activeRound, setActiveRound] = useState<any>(null);
    const [previousWinner, setPreviousWinner] = useState<any>(null);

    // 5 minutter = 300 sekunder
    const ROUND_TIME = 300;
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchCurrentRound = async () => {
        try {
            const res = await fetch("/api/rounds/current");
            const data = await res.json();

            if (data.activeRound) {
                setActiveRound(data.activeRound);
                setCandidates(data.candidates);
                setPreviousWinner(data.previousWinner);

                // Beregn tid igjen basert på start_time fra DB, 
                // slik at hvis man oppdaterer siden, starter ikke timeren på 5 min på nytt
                const startTime = new Date(data.activeRound.start_time).getTime();
                const now = new Date().getTime();
                const diffSeconds = Math.floor((now - startTime) / 1000);

                const remaining = ROUND_TIME - diffSeconds;
                setTimeLeft(remaining > 0 ? remaining : 0);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const triggerNextRound = async () => {
        setIsTransitioning(true);
        try {
            await fetch("/api/rounds/next", { method: "POST" });
            // Gi det 2 sekunder for dramatisk effekt, deretter hent ny runde
            setTimeout(() => {
                fetchCurrentRound();
                setIsTransitioning(false);
            }, 2000);
        } catch (e) {
            console.error(e);
            setIsTransitioning(false);
        }
    };

    // Timer-logikk
    useEffect(() => {
        if (timeLeft <= 0 && activeRound && !isTransitioning) {
            triggerNextRound();
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timeLeft, activeRound, isTransitioning]);

    // Initial load og Realtime Abonnement
    useEffect(() => {
        fetchCurrentRound();

        // Lytt på stemmer for pågående runde
        const votesSubscription = supabase
            .channel('public:round_candidates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'round_candidates' }, (payload) => {
                setCandidates((currentCandidates) => {
                    return currentCandidates.map(c =>
                        c.candidate_id === payload.new.id
                            ? { ...c, votes: payload.new.votes }
                            : c
                    );
                });
            })
            .subscribe();

        // Lytt på start av ny runde (i tilfelle noen tvinger den frem fra en annen skjerm/admin)
        const roundsSubscription = supabase
            .channel('public:rounds')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' }, () => {
                fetchCurrentRound();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(votesSubscription);
            supabase.removeChannel(roundsSubscription);
        };
    }, []);

    // Formater tid mm:ss
    const formatTime = (seconds: number) => {
        if (seconds < 0) return "00:00";
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    // Beregn høyeste stemmetall for å skalere grafen (minst 10 som baseline for at søyler ikke skal fylle 100% på 1 stemme)
    const maxVotes = Math.max(10, ...candidates.map(c => c.votes));

    // Finn domenet (hvis den er live eller localhost)
    const domainUrl = typeof window !== "undefined" ? window.location.origin : "";

    if (isTransitioning) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center">
                <h1 className="text-6xl font-black tracking-tighter animate-pulse">KÅRER VINNER...</h1>
            </div>
        );
    }

    if (!activeRound) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold mb-4">Venter på at første runde skal starte...</h1>
                <button
                    onClick={async () => {
                        await fetch("/api/setup", { method: "POST" });
                        fetchCurrentRound();
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
                >
                    Start System (Seeding)
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col font-sans">

            {/* HEADER */}
            <header className="flex justify-between items-center p-8 border-b border-neutral-800 bg-neutral-900/50">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase text-blue-500">Nottveit Holding AS</h1>
                    <p className="text-neutral-400 font-mono text-sm tracking-widest mt-1">Live Vurderingssystem</p>
                </div>

                <div className="flex flex-col items-center">
                    <div className={`text-6xl font-mono font-bold ${timeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <span className="text-neutral-500 text-xs uppercase tracking-widest mt-2">Gjenstående tid</span>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex p-8 gap-8">

                {/* KANDIDATER (Søylediagram-seksjon) */}
                <div className="flex-1 flex justify-center items-end gap-12 pb-12">
                    {candidates.map((c, idx) => {
                        // Beregn høyden på søylen (prosent)
                        const heightPercent = (c.votes / maxVotes) * 100;

                        return (
                            <div key={c.candidate_id} className="flex flex-col items-center justify-end h-full w-48 relative">

                                {/* Stemmetall (Flytende over søylen) */}
                                <div className="text-4xl font-black mb-4 z-10 drop-shadow-lg">
                                    {c.votes}
                                </div>

                                {/* Selve Søylen */}
                                <div className="w-full bg-neutral-900 rounded-t-xl overflow-hidden relative" style={{ height: '60%' }}>
                                    <div
                                        className="absolute bottom-0 left-0 w-full rounded-t-xl transition-all duration-1000 ease-out bg-gradient-to-t from-blue-900 to-blue-500"
                                        style={{ height: `${Math.max(2, heightPercent)}%` }}
                                    >
                                        {/* Animasjons-striper for litt ekstra "tech"-følelse */}
                                        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
                                    </div>
                                </div>

                                {/* Profil */}
                                <div className="mt-6 flex flex-col items-center">
                                    <img src={c.image_url} alt={c.name} className="w-24 h-24 rounded-full border-4 border-neutral-800 object-cover shadow-2xl" />
                                    <h2 className="mt-4 text-xl font-bold text-center">{c.name}</h2>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* SIDEBAR (Vinner og QR) */}
                <div className="w-80 flex flex-col gap-6">

                    {/* Forrige Vinner */}
                    {previousWinner && (
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-bl-lg border-l border-b border-yellow-500/30">
                                SISTE FORFREMMELSE
                            </div>
                            <img src={previousWinner.image_url} alt={previousWinner.name} className="w-32 h-32 rounded-full border-4 border-yellow-500/50 object-cover mt-4" />
                            <h3 className="mt-4 text-lg font-bold text-white text-center">{previousWinner.name}</h3>
                        </div>
                    )}

                    {/* QR Kode for stemming */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center flex-1 shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Gi din stemme</h3>
                        <p className="text-neutral-400 text-sm text-center mb-6">Skann koden for å åpne ansatt-portalen og gi forfremmelse.</p>
                        <div className="bg-white p-4 rounded-xl">
                            {domainUrl && <QRCodeSVG value={domainUrl} size={150} />}
                        </div>
                        <p className="text-neutral-500 text-xs mt-4 truncate max-w-full font-mono">{domainUrl}</p>
                    </div>
                </div>

            </main>

        </div>
    );
}
