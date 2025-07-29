"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { type PostgrestSingleResponse } from "@supabase/supabase-js";
import useAuth from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, Loader2 } from "lucide-react";
import Link from "next/link";

type VideoRecord = {
  user_id: string;
  title: string;
  file_url: string;
  visibility: "public" | "private" | "unlisted";
  processing_status: string;
};

export default function RecordPage() {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        console.log("Cleaned up video URL:", videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = "";
      videoRef.current.load();
      videoRef.current.src = videoUrl;
      videoRef.current.load();
      console.log("Video element reloaded with URL:", videoUrl, "MIME type:", videoBlob?.type);
    }
  }, [videoUrl, videoBlob]);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: true,
      });
      streamRef.current = stream;
      console.log("Stream acquired:", stream.getTracks());

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=h264")
        ? "video/webm;codecs=h264"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
      if (!mimeType) {
        throw new Error("No supported video MIME type found.");
      }
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      console.log("MediaRecorder initialized with MIME type:", mimeType);

      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log("Data available, chunk size:", e.data.size);
        } else {
          console.log("Empty chunk received");
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log("Recording stopped, blob size:", blob.size, "MIME type:", mimeType);
        if (blob.size === 0) {
          setError("No video data was recorded. Please try again.");
          return;
        }
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
      mediaRecorderRef.current.onerror = (e: Event) => {
        console.error("MediaRecorder error:", e);
        setError("An error occurred while recording. Please try again.");
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      console.log("Recording started");
    } catch (err: unknown) {
      setError("Failed to start recording. Please check your browser permissions and try again.");
      console.error("Start recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      console.log("Recording stopped by user");
    }
  };

  const handleUpload = async () => {
    if (!user || !user.id || !user.email) {
      setError("Please sign in to upload videos.");
      console.error("User object invalid:", user);
      return;
    }
    if (!videoBlob || !title) {
      setError("Please record a video and enter a title.");
      return;
    }
    if (videoBlob.size === 0) {
      setError("The recorded video is empty. Please record again.");
      return;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError("App configuration error. Please contact support.");
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadSuccess(false);
    try {
      const fileExtension = videoBlob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `user_${user.id}/${Date.now()}_${title.replace(/\s+/g, "_")}.${fileExtension}`;
      console.log("Uploading to:", fileName, "Content-Type:", videoBlob.type);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, videoBlob, { contentType: videoBlob.type });
      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload video to storage. Please try again.");
      }
      if (!uploadData) {
        console.error("No upload data returned");
        throw new Error("No upload data returned from storage.");
      }

      const file_path = uploadData.path;
      console.log("Uploaded file URL:", file_path);

      const videoRecord: VideoRecord = {
        user_id: user.id,
        title,
        file_url: file_path,
        visibility: "private",
        processing_status: "pending",
      };
      console.log("Inserting video record:", videoRecord);

      const { data: videoData, error: insertError }: PostgrestSingleResponse<VideoRecord & { id: string }> = await supabase
        .from("videos")
        .insert(videoRecord)
        .select()
        .single();
      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to save video details. Please try again.");
      }
      if (!videoData) {
        console.error("No video data returned");
        throw new Error("No video data returned from database.");
      }

      // Attempt to send email notification
      try {
        console.log("Sending email to:", user.email);
        const response = await fetch("/api/send-upload-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoData.id, user_email: user.email, file_path }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Email API error:", errorData);
          alert("Video uploaded successfully, but we couldn’t send the email notification. Check your email settings.");
        } else {
          alert("Video uploaded successfully! You’ll receive an email when processing is complete.");
        }
      } catch (emailErr) {
        console.error("Email notification error:", emailErr);
        alert("Video uploaded successfully, but we couldn’t send the email notification. Check your email settings.");
      }

      setUploadSuccess(true);
      setVideoBlob(null);
      setVideoUrl(null);
      setTitle("");
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.load();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload video. Please try again.";
      setError(errorMessage);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const debugDownload = () => {
    if (videoBlob && videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `debug_${title || "video"}.${videoBlob.type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      console.log("Debug download triggered");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Record Screen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button
              onClick={recording ? stopRecording : startRecording}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
            >
              {recording ? "Stop Recording" : "Start Recording"}
              <Video className="ml-2 w-4 h-4" />
            </Button>
            {videoBlob && (
              <Button variant="outline" onClick={debugDownload}>
                Download Debug Video
              </Button>
            )}
          </div>

          {videoBlob && (
            <div className="mt-4">
              <video
                ref={videoRef}
                controls
                className="w-full max-w-2xl rounded-lg shadow"
                onError={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                  console.error("Video playback error:", e);
                  setError("Failed to play the recorded video. Try downloading it to check.");
                }}
              >
                {videoUrl && <source src={videoUrl} type={videoBlob?.type} />}
              </video>
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Video Title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              disabled={uploading}
            />
            <Button
              onClick={handleUpload}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={uploading || !videoBlob || !title}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Upload Video"}
            </Button>
          </div>

          {uploadSuccess && (
            <Alert variant="default" className="bg-green-100 text-green-800">
              <AlertDescription>
                Your video was uploaded successfully!{" "}
                <Link href="/dashboard" className="text-blue-600 hover:underline">
                  View your videos on the dashboard
                </Link>.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}