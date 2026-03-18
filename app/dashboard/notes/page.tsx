"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, X, Loader2, Trash2, StickyNote, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  filename: string;
  created_at: string;
}

export default function NotesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch notes on mount
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const mdFiles = Array.from(files).filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".txt") || f.name.endsWith(".markdown")
    );

    if (!mdFiles.length) {
      toast.error("No .md or .txt files found");
      return;
    }

    if (mdFiles.length > 50) {
      toast.error("Maximum 50 files per upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      mdFiles.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/notes", { method: "POST", body: formData });
      const data = await res.json();

      if (data.inserted?.length) {
        toast.success(`Uploaded ${data.inserted.length} note${data.inserted.length > 1 ? "s" : ""}`);
      }
      if (data.errors?.length) {
        data.errors.forEach((e: string) => toast.error(e));
      }

      fetchNotes();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const deleteNote = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  return (
    <div className="p-6 max-w-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          My Notes
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Upload your markdown notes. They&apos;ll be searched in real time during meetings to suggest talking points.
        </p>
      </div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
            dragging
              ? "border-indigo-400 bg-indigo-50/50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-slate-600 text-sm font-medium">Uploading notes...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Upload className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-slate-700 text-sm font-semibold">
                  Drop markdown files here, or click to browse
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Accepts .md, .txt, .markdown files (max 500KB each, 50 files)
                </p>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".md,.txt,.markdown"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Folder upload button */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Upload entire folder
          </button>
          <input
            ref={folderRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is not in standard types
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </motion.div>

      {/* Notes list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
      >
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
            <StickyNote className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-semibold text-slate-800 text-sm">
            Uploaded Notes ({notes.length})
          </h2>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No notes uploaded yet</p>
              <p className="text-slate-400 text-xs mt-1">
                Upload your markdown notes to get AI-powered talking points during meetings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {notes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{note.filename}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                      disabled={deletingId === note.id}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                      title="Delete note"
                    >
                      {deletingId === note.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
