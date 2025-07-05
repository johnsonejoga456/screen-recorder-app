"use client";
import { useState, useRef } from "react";

export default function RecordPage() {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    const blob = new Blob(recordedChunks.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording.webm";
    a.click();
    recordedChunks.current = [];
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-semibold">Screen Recorder</h1>
      {!recording ? (
        <button
          onClick={startRecording}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Start Recording
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
