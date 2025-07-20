// supabase/functions/process-video/index.ts

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";
import { createFFmpeg, fetchFile } from "https://esm.sh/@ffmpeg/ffmpeg";

serve(async (req) => {
  const { video_id, user_email, file_url } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    // Download video
    const response = await fetch(file_url);
    const data = new Uint8Array(await response.arrayBuffer());
    ffmpeg.FS("writeFile", "input.webm", data);

    // Transcode/compress
    await ffmpeg.run("-i", "input.webm", "-vcodec", "libx264", "-crf", "28", "output.mp4");

    const output = ffmpeg.FS("readFile", "output.mp4");

    // Upload compressed video back to Supabase Storage
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(`compressed-${video_id}.mp4`, output.buffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
    }

    // Generate public URL for the compressed video
    const { data: publicUrlData } = supabase.storage
      .from("videos")
      .getPublicUrl(`compressed-${video_id}.mp4`);

    const compressedUrl = publicUrlData.publicUrl;

    // Update DB
    const { error: dbError } = await supabase
      .from("videos")
      .update({
        file_url: compressedUrl,
        processing_status: "completed",
      })
      .eq("id", video_id);

    if (dbError) {
      console.error("DB update error:", dbError);
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });
    }

    // Send email using Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    await resend.emails.send({
      from: "Screen Recorder <noreply@screenrecorder.onresend.com>",
      to: [user_email],
      subject: "Your video is ready!",
      html: `
        <h2>Processing Completed</h2>
        <p>Your video has been processed and is ready to view.</p>
        <p><a href="${compressedUrl}">Click here to view your video</a></p>
      `,
    });

    return new Response(JSON.stringify({ message: "Video processed and email sent." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing video:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});