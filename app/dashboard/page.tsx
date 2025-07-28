"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import useAuth from "@/hooks/useAuth";
import { useState } from "react";
import { Trash, Eye, Pencil, Link2, Twitter, Facebook, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Video = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  file_url: string;
  visibility: "public" | "private" | "unlisted";
  created_at: string;
  updated_at: string;
  processing_status: string;
  views?: number;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [urlExpiration, setUrlExpiration] = useState("24");

  const { data: videos = [], isLoading, error } = useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: async () => {
      if (!user) {
        console.log("No user found, returning empty array");
        return [];
      }
      console.log("Fetching videos for user_id:", user.id);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Query error:", error.message);
        throw error;
      }
      console.log("Fetched videos:", data);
      return data as Video[];
    },
    enabled: !!user && !authLoading,
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
      const expiration = parseInt(urlExpiration) * 60 * 60;
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(fileName, expiration);
      if (error) {
        alert("Failed to create signed URL: " + error.message);
        return;
      }
      shareUrl = data?.signedUrl;
    }

    const embed = `<iframe src="${process.env.NEXT_PUBLIC_SITE_URL}/embed/${video.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;

    setSelectedVideo(video);
    setShareUrl(shareUrl);
    setEmbedCode(embed);
    setShareModalOpen(true);
  };

  const handleCopy = async (text: string, type: "link" | "embed") => {
    await navigator.clipboard.writeText(text);
    alert(`${type === "link" ? "Share link" : "Embed code"} copied to clipboard!`);
  };

  const handleSocialShare = (platform: "twitter" | "facebook") => {
    if (!shareUrl) return;
    const encodedUrl = encodeURIComponent(shareUrl);
    const title = encodeURIComponent(selectedVideo?.title || "Check out my video!");
    let shareLink = "";
    if (platform === "twitter") {
      shareLink = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}`;
    } else if (platform === "facebook") {
      shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    }
    window.open(shareLink, "_blank");
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading your videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-2xl font-bold">Your Uploaded Videos</CardTitle>
          <Link href="/record">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Video className="mr-2 w-4 h-4" /> Record a Video
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-gray-600">
              You have not uploaded any videos yet.{" "}
              <Link href="/record" className="text-blue-600 hover:underline">
                Record a video
              </Link>.
            </p>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                    <video
                      src={video.file_url}
                      className="w-24 h-16 object-cover rounded mr-4"
                      muted
                    />
                    {editingId === video.id ? (
                      <div className="flex space-x-2">
                        <Input
                          type="text"
                          className="border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                          value={newTitle}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
                        />
                        <Button
                          onClick={() => renameMutation.mutate({ id: video.id, title: newTitle })}
                          className="text-sm px-3 py-1 bg-green-600 text-white rounded"
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {video.title}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(video.created_at).toLocaleString()}
                          {video.processing_status && ` | Status: ${video.processing_status}`}
                          {video.views != null && ` | Views: ${video.views}`}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(video.file_url, "_blank")}
                      title="View"
                    >
                      <Eye className="w-5 h-5 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(video.id);
                        setNewTitle(video.title);
                      }}
                      title="Rename"
                    >
                      <Pencil className="w-5 h-5 text-yellow-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(video)}
                      title="Delete"
                    >
                      <Trash className="w-5 h-5 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGenerateLink(video)}
                      title="Share"
                    >
                      <Link2 className="w-5 h-5 text-purple-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Video: {selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Share Link</Label>
              <Input value={shareUrl} readOnly className="mt-1" />
              <div className="flex space-x-2 mt-2">
                <Button onClick={() => handleCopy(shareUrl, "link")}>
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(shareUrl, "_blank")}
                >
                  Preview Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialShare("twitter")}
                >
                  <Twitter className="w-4 h-4 mr-2" /> Twitter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialShare("facebook")}
                >
                  <Facebook className="w-4 h-4 mr-2" /> Facebook
                </Button>
              </div>
            </div>
            <div>
              <Label>Embed Code</Label>
              <Input value={embedCode} readOnly className="mt-1" />
              <Button
                className="mt-2"
                onClick={() => handleCopy(embedCode, "embed")}
              >
                Copy Embed Code
              </Button>
            </div>
            {selectedVideo?.visibility === "unlisted" && (
              <div>
                <Label>Link Expiration (hours)</Label>
                <Input
                  type="number"
                  value={urlExpiration}
                  onChange={(e) => setUrlExpiration(e.target.value)}
                  min="1"
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}