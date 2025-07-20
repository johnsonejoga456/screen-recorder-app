import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Parse JSON body
    const { video_id, user_email, file_url } = await req.json();

    // Initialize and load FFmpeg
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.7/dist/umd/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.7/dist/umd/ffmpeg-core.wasm",
    });

    // Download video file
    await ffmpeg.writeFile("input.webm", await fetchFile(file_url));

    // Compress/transcode
    await ffmpeg.exec(["-i", "input.webm", "-vcodec", "libx264", "-crf", "28", "output.mp4"]);

    // Retrieve compressed file
    const output = await ffmpeg.readFile("output.mp4");

    // Upload compressed video to Supabase Storage
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(`compressed-${video_id}.mp4`, output, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Send email using Resend
    const resend = new Resend(process.env.RESEND_API_KEY!);

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

    return NextResponse.json(
      { message: "Video processed and email sent." },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Error processing video:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}