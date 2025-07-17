import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";
import { createFFmpeg, fetchFile } from "https://esm.sh/@ffmpeg/ffmpeg";

serve(async (req) => {
  const { video_id, user_email, file_url } = await req.json();

  const supabase = createClient(
    Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!,
    Deno.env.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Initialize and load ffmpeg
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    // Download video file
    const response = await fetch(file_url);
    const data = new Uint8Array(await response.arrayBuffer());

    ffmpeg.FS("writeFile", "input.webm", data);

    // Compress/transcode
    await ffmpeg.run("-i", "input.webm", "-vcodec", "libx264", "-crf", "28", "output.mp4");

    // Retrieve compressed file
    const output = ffmpeg.FS("readFile", "output.mp4");

    // Upload compressed video back to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("videos")
      .upload(`compressed-${video_id}.mp4`, output.buffer, { contentType: "video/mp4" });

    if (uploadError) {
      console.error("Compression upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload compressed video." }), { status: 500 });
    }

    // Update DB with new file URL and status
    const { error } = await supabase
      .from("videos")
      .update({
        file_url: uploadData.publicUrl,
        processing_status: "completed"
      })
      .eq("id", video_id);

    if (error) {
      console.error("Error updating video status:", error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    // Send completion email via Resend
    const resend = new Resend(Deno.env.get("NEXT_RESEND_API_KEY")!);

    await resend.emails.send({
      from: "Screen Recorder <noreply@screenrecorder.onresend.com>",
      to: [user_email],
      subject: "Your video is ready!",
      html: `
        <h2>Processing Completed</h2>
        <p>Your video has been processed and is ready to view.</p>
        <p><a href="${uploadData.publicUrl}">Click here to view your video</a></p>
      `,
    });

    return new Response(JSON.stringify({ message: "Video processed, compressed, and email sent." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});