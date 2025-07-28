import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import type { Metadata, NextPage } from "next";

// Define the props type for the dynamic route
type EmbedPageProps = {
  params: Promise<{ id: string }>;
};

// SEO metadata
export async function generateMetadata({ params }: EmbedPageProps): Promise<Metadata> {
  const { id } = await params; // Await params to access id

  const { data: video } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .single();

  return {
    title: video ? video.title : "Video not found",
  };
}

// Main page component
const EmbedPage: NextPage<EmbedPageProps> = async ({ params }) => {
  const { id } = await params; // Await params to access id

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !video) {
    notFound();
    return null;
  }

  if (video.visibility === "private") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">This video is private.</p>
      </div>
    );
  }

  // Generate a signed URL (expires in 1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("videos")
    .createSignedUrl(video.file_path, 60 * 60); // file_path is the path inside bucket

  if (signedUrlError || !signedUrlData?.signedUrl) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black">
      <video
        controls
        className="w-full max-w-4xl rounded-lg shadow-lg"
        src={signedUrlData.signedUrl}
      />
      <p className="text-gray-300 mt-2">{video.title}</p>
    </div>
  );
};

export default EmbedPage;