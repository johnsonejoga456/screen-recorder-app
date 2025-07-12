"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // If logged in, redirect to dashboard
        router.push("/dashboard");
      } else {
        // If not logged in, redirect to auth page
        router.push("/auth");
      }
    }
  }, [user, loading, router]);

  return (
    <main className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Checking authentication status...</p>
    </main>
  );
}