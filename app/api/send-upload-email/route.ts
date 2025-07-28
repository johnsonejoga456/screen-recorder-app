import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";

export async function POST(request: NextRequest) {
  try {
    const { video_id, user_email, file_url } = await request.json();

    if (!video_id || !user_email || !file_url) {
      console.error("Missing required fields:", { video_id, user_email, file_url });
      return NextResponse.json({ error: "Missing video_id, user_email, or file_url" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: updateError } = await supabase
      .from("videos")
      .update({ processing_status: "completed" })
      .eq("id", video_id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Setup SendGrid API
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY is not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    sgMail.setApiKey(sendgridApiKey);

    const msg = {
      to: user_email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: "Your Video Upload is Complete",
      html: `
        <h1>Video Upload Complete</h1>
        <p>Your video has been successfully uploaded and processed.</p>
        <p><a href="${file_url}">View your video</a></p>
      `,
    };

    await sgMail.send(msg);

    console.log("Email sent successfully");
    return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });

  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "response" in error) {
      console.error("Email send error:", (error as any).response?.body);
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
