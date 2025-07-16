// supabase/functions/process-video/index.ts

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";

serve(async (req) => {
  const { video_id, user_email, file_url } = await req.json();

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Placeholder: Here you would add compression/trimming logic using ffmpeg.wasm or external service.

    // Update the database to mark as processed
    const { error } = await supabaseClient
      .from("videos")
      .update({ processing_status: "completed" })
      .eq("id", video_id);

    if (error) {
      console.error("Error updating video status:", error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    // Send completion email via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    await resend.emails.send({
      from: "Screen Recorder <noreply@yourdomain.com>",
      to: [user_email],
      subject: "Your video is ready!",
      html: `
        <h2>Processing Completed</h2>
        <p>Your video has been processed and is ready to view.</p>
        <p><a href="${file_url}">Click here to view your video</a></p>
      `,
    });

    return new Response(JSON.stringify({ message: "Video processed and email sent." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
