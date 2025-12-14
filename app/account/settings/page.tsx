"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  Trash2,
  User,
  Globe,
  FileText,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  profile_image_url: string | null;
  bio: string | null;
  website: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Failed to fetch profile");
        }
        const data = await res.json();
        setUser(data);
        setName(data.name || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          bio: bio.trim() || null,
          website: website.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      const updated = await res.json();
      setUser(updated);
      setSuccess("Profile updated successfully");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/settings/photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload photo");
      }

      const updated = await res.json();
      setUser(updated);
      setSuccess("Photo updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle photo delete
  const handleDeletePhoto = async () => {
    if (!user?.profile_image_url) return;

    if (!confirm("Are you sure you want to remove your profile photo?")) {
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/photo", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove photo");
      }

      const updated = await res.json();
      setUser(updated);
      setSuccess("Photo removed successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load profile</p>
          <Link href="/account" className="text-primary hover:underline mt-2 inline-block">
            Back to account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/account"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Profile Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile information
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Profile Photo Section */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Profile Photo</h2>

        <div className="flex items-center gap-6">
          {/* Current Photo */}
          <div className="relative">
            {user.profile_image_url ? (
              <Image
                src={user.profile_image_url}
                alt={user.name || "Profile"}
                width={96}
                height={96}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-semibold text-primary">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-3">
              Upload a photo to personalize your profile. Recommended size: 200x200 pixels.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                Upload Photo
              </button>
              {user.profile_image_url && (
                <button
                  onClick={handleDeletePhoto}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors text-sm disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Info Form */}
      <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Profile Information</h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="flex items-center gap-2 text-sm font-medium mb-1.5"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is how your name will appear on your profile
            </p>
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="bio"
              className="flex items-center gap-2 text-sm font-medium mb-1.5"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {bio.length}/500 characters
            </p>
          </div>

          {/* Website */}
          <div>
            <label
              htmlFor="website"
              className="flex items-center gap-2 text-sm font-medium mb-1.5"
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              Website
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your personal website or portfolio
            </p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1.5 text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 pt-6 border-t flex items-center justify-end gap-3">
          <Link
            href="/account"
            className="px-4 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
