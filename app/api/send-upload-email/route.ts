import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { userEmail, fileName } = await req.json();

    if (!userEmail || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: "Screen Recorder App <noreply@yourdomain.com>",
      to: userEmail,
      subject: "Your video has been uploaded!",
      html: `
        <div style="font-family:sans-serif;line-height:1.5">
          <h2>Upload Successful</h2>
          <p>Hi there,</p>
          <p>Your video <strong>${fileName}</strong> has been uploaded successfully to your library.</p>
          <p>You can now view, manage, and share your video from your dashboard.</p>
          <p>Thank you for using Screen Recorder App!</p>
        </div>
      `,
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Email sent successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}