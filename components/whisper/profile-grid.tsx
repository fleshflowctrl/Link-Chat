"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { homeGridProfiles } from "@/data/profiles";
import { ProfileCard } from "./profile-card";

export function ProfileGrid() {
  const [toast, setToast] = useState<string | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setToast(null), 2600);
  };

  return (
    <section className="px-5 pt-7">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[400] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {homeGridProfiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onToast={showToast}
          />
        ))}
      </div>
    </section>
  );
}
