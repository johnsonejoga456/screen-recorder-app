import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";

interface EmbedPageParams {
  params: { id: string };
}

export default async function EmbedPage({ params }: EmbedPageParams) {
  const { id } = params;

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !video) {
    notFound();
    return null; // Ensure the function returns something
  }

  if (video.visibility === "private") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">This video is private.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black">
      <video
        controls
        className="w-full max-w-4xl rounded-lg shadow-lg"
        src={video.file_url}
      />
      <p className="text-gray-300 mt-2">{video.title}</p>
    </div>
  );
}
