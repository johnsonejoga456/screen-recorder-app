import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";

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

    // Initialize Nodemailer with SendGrid SMTP
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY is not set");
      return NextResponse.json(
        { error: "Email service configuration missing" },
        { status: 500 }
      );
    }

    const transporter = createTransport({
      host: "ejogajohnson@gmail.com",
      port: 587,
      auth: {
        user: "apikey",
        pass: sendgridApiKey,
      },
    });

    // Send email notification
    const mailOptions = {
      from: "ejogajohnson@gmail.com",
      to: user_email,
      subject: "Your Video Upload is Complete",
      html: `
        <h1>Video Upload Complete</h1>
        <p>Your video has been successfully uploaded and processed.</p>
        <p>View it here: <a href="${file_url}">${file_url}</a></p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", info);
    return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${(error as Error).message || "Unknown error"}` },
      { status: 500 }
    );
  }
}