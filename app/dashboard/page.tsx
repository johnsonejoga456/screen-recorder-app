"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import useAuth from "@/hooks/useAuth";
import { useState } from "react";
import { Trash, Eye, Pencil, Link2 } from "lucide-react";

type Video = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  file_url: string;
  visibility: "public" | "private" | "unlisted";
  created_at: string;
  updated_at: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Video[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (video: Video) => {
      const fileName = video.file_url.split("/").pop() ?? "";
      await supabase.storage.from("videos").remove([fileName]);
      const { error } = await supabase.from("videos").delete().eq("id", video.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("videos").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setEditingId(null);
      setNewTitle("");
    },
  });

  const updateVisibility = useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: "public" | "private" | "unlisted" }) => {
      const { error } = await supabase.from("videos").update({ visibility }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const handleGenerateLink = async (video: Video) => {
    if (video.visibility === "private") {
      alert("This video is private. Make it public or unlisted to share.");
      return;
    }

    let shareUrl = video.file_url;

    if (video.visibility === "unlisted") {
      const fileName = video.file_url.split("/").pop() ?? "";
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(fileName, 60 * 60); // 1 hour
      if (error) {
        alert("Failed to create signed URL: " + error.message);
        return;
      }
      shareUrl = data?.signedUrl;
    }

    await navigator.clipboard.writeText(shareUrl);
    alert("Share link copied to clipboard!");
  };

  const handleCopyEmbedCode = async (video: Video) => {
    const embed = `<iframe src="${process.env.NEXT_PUBLIC_SITE_URL}/embed/${video.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
    await navigator.clipboard.writeText(embed);
    alert("Embed code copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading your videos...</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Uploaded Videos</h1>
      {videos.length === 0 ? (
        <p className="text-gray-600">You have not uploaded any videos yet.</p>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800"
            >
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                {editingId === video.id ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                    <button
                      onClick={() => renameMutation.mutate({ id: video.id, title: newTitle })}
                      className="text-sm px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {video.title}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(video.created_at).toLocaleString()}
                    </span>
                  </div>
                )}

                <select
                  value={video.visibility}
                  onChange={(e) =>
                    updateVisibility.mutate({
                      id: video.id,
                      visibility: e.target.value as "public" | "private" | "unlisted",
                    })
                  }
                  className="mt-2 md:mt-0 border px-2 py-1 rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 mt-2 md:mt-0">
                <button
                  onClick={() => window.open(video.file_url, "_blank")}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="View"
                >
                  <Eye className="w-5 h-5 text-blue-600" />
                </button>
                <button
                  onClick={() => {
                    setEditingId(video.id);
                    setNewTitle(video.title);
                  }}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Rename"
                >
                  <Pencil className="w-5 h-5 text-yellow-600" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(video)}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Delete"
                >
                  <Trash className="w-5 h-5 text-red-600" />
                </button>
                <button
                  onClick={() => handleGenerateLink(video)}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Copy Share Link"
                >
                  <Link2 className="w-5 h-5 text-purple-600" />
                </button>
                <button
                  onClick={() => handleCopyEmbedCode(video)}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Copy Embed Code"
                >
                  📋
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
