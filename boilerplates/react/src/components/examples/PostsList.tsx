import { Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useCreatePost, useDeletePost, usePosts } from "@/hooks/usePosts";
import { cn } from "@/lib/utils";

export function PostsList() {
  const titleId = useId();
  const bodyId = useId();
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostBody, setNewPostBody] = useState("");

  const { data: posts, isLoading, error, refetch } = usePosts();
  const createPostMutation = useCreatePost();
  const deletePostMutation = useDeletePost();

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPostTitle.trim() || !newPostBody.trim()) return;

    try {
      await createPostMutation.mutateAsync({
        title: newPostTitle,
        body: newPostBody,
        userId: 1,
      });

      setNewPostTitle("");
      setNewPostBody("");
    } catch (error) {
      console.error("Failed to create post:", error);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await deletePostMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete post:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h3 className="font-medium text-red-800">Error loading posts</h3>
        <p className="mt-1 text-sm text-red-700">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 rounded-md bg-red-100 px-3 py-1 text-sm text-red-800 hover:bg-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Post Form */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Create New Post</h3>
        <form onSubmit={handleCreatePost} className="space-y-4">
          <div>
            <label htmlFor={titleId} className="block text-sm font-medium mb-1">
              Title
            </label>
            <input
              id={titleId}
              type="text"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter post title..."
              required
            />
          </div>

          <div>
            <label htmlFor={bodyId} className="block text-sm font-medium mb-1">
              Content
            </label>
            <textarea
              id={bodyId}
              value={newPostBody}
              onChange={(e) => setNewPostBody(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter post content..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={createPostMutation.isPending}
            className={cn(
              "inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
              createPostMutation.isPending && "cursor-not-allowed"
            )}
          >
            {createPostMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{createPostMutation.isPending ? "Creating..." : "Create Post"}</span>
          </button>
        </form>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Posts ({posts?.length || 0})</h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>

        {posts && posts.length > 0 ? (
          <div className="grid gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-card-foreground">{post.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.body}</p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>Post #{post.id}</span>
                      <span>User {post.userId}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      type="button"
                      onClick={() => {
                        // Placeholder for edit functionality
                        alert("Edit functionality would be implemented here");
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Edit post"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletePostMutation.isPending}
                      className="p-1 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                      title="Delete post"
                    >
                      {deletePostMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No posts found. Create your first post above!</p>
          </div>
        )}
      </div>
    </div>
  );
}
