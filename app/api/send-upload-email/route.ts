import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const { video_id, user_email, file_url } = await request.json();

    if (!video_id || !user_email || !file_url) {
      console.error("Missing required fields:", { video_id, user_email, file_url });
      return NextResponse.json(
        { error: "Missing video_id, user_email, or file_url" },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update video processing_status to 'completed'
    const { error: updateError } = await supabase
      .from("videos")
      .update({ processing_status: "completed" })
      .eq("id", video_id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json(
        { error: `Failed to update video status: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Initialize Resend client
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set");
      return NextResponse.json(
        { error: "Email service configuration missing" },
        { status: 500 }
      );
    }
    const resend = new Resend(resendApiKey);

    // Send email notification
    const fromEmail = process.env.RESEND_DOMAIN
      ? `noreply@${process.env.RESEND_DOMAIN}`
      : "onboarding@resend.dev"; // Fallback to test mode email
    const { data, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: user_email,
      subject: "Your Video Upload is Complete",
      html: `
        <h1>Video Upload Complete</h1>
        <p>Your video has been successfully uploaded and processed.</p>
        <p>View it here: <a href="${file_url}">${file_url}</a></p>
      `,
    });

    if (emailError) {
      console.error("Resend email error:", emailError);
      return NextResponse.json(
        { error: `Failed to send email: ${emailError.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data);
    return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${(error as Error).message || "Unknown error"}` },
      { status: 500 }
    );
  }
}