"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MobileVoting() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  // Hent runde-data
  const fetchCurrentRound = async () => {
    try {
      const res = await fetch("/api/rounds/current", { cache: "no-store" });
      const data = await res.json();

      if (data.activeRound) {
        setActiveRound(data.activeRound);
        setCandidates(data.candidates);

        // Sjekk om brukeren allerede har stemt i denne runden
        const votedInRound = localStorage.getItem(`voted_round_${data.activeRound.id}`);
        if (votedInRound) {
          setHasVoted(true);
        } else {
          setHasVoted(false); // Resett hvis ny runde
        }
      } else {
        setActiveRound(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCurrentRound();

    // Lytt til runde-bytter. 
    // Når TV-en triggler ny runde (INSERT i rounds-tabellen), oppdaterer mobilen seg automagisk!
    const roundsSubscription = supabase
      .channel('public:rounds:mobile')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' }, () => {
        fetchCurrentRound();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roundsSubscription);
    };
  }, []);

  const handleVote = async (candidateId: string) => {
    if (hasVoted || isVoting || !activeRound) return;

    setIsVoting(true);
    try {
      const res = await fetch("/api/rounds/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId })
      });

      if (res.ok) {
        // Skjul bak localStorage så de ikke kan stemme mer
        localStorage.setItem(`voted_round_${activeRound.id}`, "true");
        setHasVoted(true);
      }
    } catch (error) {
      console.error("Vote error:", error);
    } finally {
      setIsVoting(false);
    }
  };

  if (!activeRound) {
    return (
      <div className="min-h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-black text-white mb-2">Ansattportal lukket</h1>
        <p className="text-neutral-400">Venter på at neste forfremmelses-runde skal starte...</p>
      </div>
    );
  }

  // Hvis de allerede har stemt
  if (hasVoted) {
    return (
      <div className="min-h-[100dvh] bg-green-950 flex flex-col items-center justify-center p-6 text-center transition-colors duration-500">
        <div className="w-24 h-24 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">STEMME REGISTRERT</h1>
        <p className="text-green-300 font-medium">Se resultatet live på TV-skjermen!</p>
        <p className="text-green-800 text-sm mt-12 animate-pulse">Neste runde starter om kort tid...</p>
      </div>
    );
  }

  // Stemmeskjema
  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col p-4 pb-12 font-sans overflow-hidden">
      <header className="text-center py-6 border-b border-neutral-800/80 mb-6 shrink-0">
        <h1 className="text-2xl font-black text-blue-500 uppercase tracking-widest">Nottveit Holding</h1>
        <p className="text-xs text-neutral-500 uppercase mt-2 tracking-wider">Hvem fortjener forfremmelse?</p>
      </header>

      <main className="flex flex-col gap-4 flex-1 justify-center z-10 w-full max-w-sm mx-auto">
        {candidates.map((c) => (
          <button
            key={c.candidate_id}
            onClick={() => handleVote(c.candidate_id)}
            disabled={isVoting}
            className="group relative bg-neutral-900 border border-neutral-800 rounded-2xl p-4 pr-6 flex items-center gap-4 text-left overflow-hidden active:scale-95 transition-all duration-200 shadow-xl"
          >
            {/* Dynamisk Knapp-bakgrunn */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

            {/* Bilde */}
            <div className="relative shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full opacity-60 blur-sm group-active:opacity-100 transition-opacity"></div>
              <img
                src={c.image_url}
                alt={c.name}
                className="relative w-20 h-20 rounded-full object-cover border-2 border-neutral-900"
              />
            </div>

            {/* Info (Navn) */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{c.name}</h2>
              <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Stemm opp</p>
            </div>

            {/* Check-merke pil */}
            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center shrink-0 shadow-inner group-hover:bg-blue-600 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </main>

      {isVoting && (
        <div className="fixed inset-0 bg-neutral-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="animate-spin w-16 h-16 border-4 border-neutral-700 border-t-blue-500 rounded-full mb-6"></div>
          <p className="text-blue-500 font-bold tracking-widest uppercase animate-pulse">Registrerer i systemet...</p>
        </div>
      )}
    </div>
  );
}
