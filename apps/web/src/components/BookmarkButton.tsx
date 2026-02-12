"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { addBookmark, removeBookmark, isBookmarked } from "@/lib/bookmarks";

interface BookmarkButtonProps {
  frbrUri: string;
  title: string;
  pasal: string;
}

export default function BookmarkButton({ frbrUri, title, pasal }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(frbrUri, pasal));
  }, [frbrUri, pasal]);

  function toggle() {
    if (saved) {
      removeBookmark(frbrUri, pasal);
      setSaved(false);
    } else {
      addBookmark(frbrUri, title, pasal);
      setSaved(true);
    }
  }

  return (
    <button
      onClick={toggle}
      className={`p-1 rounded transition-colors ${
        saved
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
      title={saved ? "Hapus bookmark" : "Simpan bookmark"}
    >
      <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
