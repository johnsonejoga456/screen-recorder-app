"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function RecordPage() {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const { user, loading } = useAuth();
  const router = useRouter();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.current.push(event.data);
      };
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (error) {
      alert("Error starting recording: " + error);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);

    mediaRecorderRef.current!.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      const filename = `recording-${Date.now()}.webm`;

      if (!user) {
        alert("You must be logged in to upload.");
        recordedChunks.current = [];
        return;
      }

      setUploading(true);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filename, blob);

      if (uploadError) {
        alert("Upload failed: " + uploadError.message);
        setUploading(false);
        recordedChunks.current = [];
        return;
      }
        // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("videos")
        .getPublicUrl(filename);

      // Insert metadata into Supabase Database
      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: filename,
        file_url: publicUrlData.publicUrl,
        visibility: "private",
      });

      if (dbError) {
        alert("Error saving video metadata: " + dbError.message);
        setUploading(false);
        recordedChunks.current = [];
        return;
      }

      alert("Upload successful!");
      setUploading(false);
      recordedChunks.current = [];

      router.push("/dashboard");
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-center">You need to be logged in to record and upload videos.</p>
        <button
          onClick={() => router.push("/auth")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-semibold">Screen Recorder</h1>
      {!recording ? (
        <button
          onClick={startRecording}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Start Recording"}
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Stop Recording
        </button>
      )}
    </div>
  );
}
