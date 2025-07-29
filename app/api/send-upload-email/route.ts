import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";

export async function POST(request: NextRequest) {
  try {
    const { video_id, user_email, file_path } = await request.json();

    if (!video_id || !user_email || !file_path) {
      console.error("Missing required fields:", { video_id, user_email, file_path });
      return NextResponse.json(
        { error: "Missing video_id, user_email, or file_path" },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase configuration missing:", {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    if (!process.env.SENDGRID_API_KEY) {
      console.error("SENDGRID_API_KEY is not set");
      return NextResponse.json({ error: "Email service configuration missing" }, { status: 500 });
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      console.error("SENDGRID_FROM_EMAIL is not set");
      return NextResponse.json({ error: "Email sender configuration missing" }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      console.error("NEXT_PUBLIC_SITE_URL is not set");
      return NextResponse.json({ error: "Site URL configuration missing" }, { status: 500 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update video processing status
    const { data: videoData, error: updateError } = await supabase
      .from("videos")
      .update({ processing_status: "completed" })
      .eq("id", video_id)
      .select("short_id")
      .single();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json({ error: `Failed to update video status: ${updateError.message}` }, { status: 500 });
    }

    if (!videoData?.short_id) {
      console.error("No short_id found for video:", video_id);
      return NextResponse.json({ error: "Short URL not available for this video" }, { status: 500 });
    }

    // Setup SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const shortUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/v/${videoData.short_id}`;
    const msg = {
      to: user_email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: "Your Video Upload is Complete",
      html: `
        <h1>Video Upload Complete</h1>
        <p>Your video has been successfully uploaded and processed.</p>
        <p><a href="${shortUrl}">View your video</a></p>
      `,
    };

    await sgMail.send(msg);

    console.log("Email sent successfully to:", user_email, "with short URL:", shortUrl);
    return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });

  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response: unknown }).response === "object"
    ) {
      const errorWithResponse = error as { response: { body?: unknown } };
      console.error("Email send error:", errorWithResponse.response?.body);
    } else if (error instanceof Error) {
      console.error("Email send error:", error.message);
    } else {
      console.error("Unknown error during email send", error);
    }

    return NextResponse.json(
      { error: "Internal server error during email send" },
      { status: 500 }
    );
  }
}