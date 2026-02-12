"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Trash2, AtSign } from "lucide-react";
import { subscribeComments, addComment, deleteComment } from "@/lib/firestore";
import { PROFESSIONALS, INSPECTORS, SPECIALISTS } from "@/lib/constants";
import type { Comment } from "@/types/project";

// Build a unified list of all mentionable people
const ALL_PEOPLE = (() => {
  const map = new Map<string, string>();
  PROFESSIONALS.forEach((p) => map.set(p.name, p.role));
  INSPECTORS.forEach((name) => {
    if (!map.has(name)) map.set(name, "Inspector Técnico");
  });
  SPECIALISTS.forEach((s) => {
    if (!map.has(s.name)) map.set(s.name, s.discipline);
  });
  return Array.from(map.entries()).map(([name, role]) => ({ name, role }));
})();

interface CommentsSectionProps {
  projectId: string;
  userEmail: string;
}

export default function CommentsSection({
  projectId,
  userEmail,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to comments
  useEffect(() => {
    const unsub = subscribeComments(projectId, setComments);
    return () => unsub();
  }, [projectId]);

  // Filter mentionable people
  const filteredPeople = mentionQuery
    ? ALL_PEOPLE.filter(
        (p) =>
          p.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
          p.role.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : ALL_PEOPLE.slice(0, 5);

  const insertMention = useCallback(
    (personName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBefore = draft.slice(0, cursorPos);
      const textAfter = draft.slice(cursorPos);

      // Find the @ that started this mention
      const atIndex = textBefore.lastIndexOf("@");
      if (atIndex === -1) return;

      const newText =
        textBefore.slice(0, atIndex) + `@${personName}` + " " + textAfter;
      setDraft(newText);
      setShowMentions(false);
      setMentionQuery("");

      // Restore focus
      setTimeout(() => {
        textarea.focus();
        const newPos = atIndex + personName.length + 2;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [draft]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);

    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);

    // Check if we're in a mention context
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex !== -1) {
      const afterAt = textBefore.slice(atIndex + 1);
      // Only show mentions if there's no space after @ or if we're still typing
      if (!afterAt.includes("\n")) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filteredPeople.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredPeople.length - 1
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredPeople[mentionIndex].name);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    // Extract mentions
    const mentionRegex = /@([^@\n]+?)(?=\s|$)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(trimmed)) !== null) {
      const name = match[1].trim();
      if (ALL_PEOPLE.some((p) => p.name === name)) {
        mentions.push(name);
      }
    }

    await addComment(projectId, {
      authorEmail: userEmail,
      content: trimmed,
      mentions,
      createdAt: new Date().toISOString(),
    });

    setDraft("");
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(projectId, commentId);
  };

  // Render comment content with highlighted mentions
  const renderContent = (content: string) => {
    const parts = content.split(/(@[^@\n]+?)(?=\s|@|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1).trim();
        const isPerson = ALL_PEOPLE.some((p) => p.name === name);
        if (isPerson) {
          return (
            <span
              key={i}
              className="inline-flex items-center bg-[#00A499]/10 text-[#00A499] font-semibold px-1 rounded text-xs"
            >
              @{name}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-[#00A499]" />
        <h2 className="text-lg font-bold text-gray-900">Comentarios</h2>
        {comments.length > 0 && (
          <span className="text-xs font-bold bg-[#00A499]/10 text-[#00A499] px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment input */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comentario... usa @ para mencionar"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#00A499] outline-none resize-none h-20"
            />

            {/* Mention autocomplete dropdown */}
            {showMentions && filteredPeople.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                {filteredPeople.map((person, idx) => (
                  <button
                    key={person.name}
                    onClick={() => insertMention(person.name)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${
                      idx === mentionIndex
                        ? "bg-[#00A499]/10 text-[#00A499]"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#00A499]/15 flex items-center justify-center text-[10px] font-bold text-[#00A499] flex-shrink-0">
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{person.name}</p>
                      <p className="text-xs text-gray-500">{person.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                if (textareaRef.current) {
                  const pos = textareaRef.current.selectionStart;
                  const before = draft.slice(0, pos);
                  const after = draft.slice(pos);
                  setDraft(before + "@" + after);
                  setShowMentions(true);
                  setMentionQuery("");
                  setTimeout(() => {
                    textareaRef.current?.focus();
                    textareaRef.current?.setSelectionRange(pos + 1, pos + 1);
                  }, 0);
                }
              }}
              className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-[#00A499] transition"
              title="Mencionar colaborador"
            >
              <AtSign className="w-4 h-4" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!draft.trim()}
              className={`p-2 rounded-lg transition ${
                draft.trim()
                  ? "bg-[#00A499] text-white hover:bg-[#00A499]/90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              title="Enviar comentario"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin comentarios aún</p>
          <p className="text-xs mt-1">
            Usa <span className="font-semibold">@</span> para mencionar a un
            colaborador
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              className="group bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {c.authorEmail}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {renderContent(c.content)}
                  </p>
                  {c.mentions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.mentions.map((name) => (
                        <span
                          key={name}
                          className="text-[10px] bg-[#00A499]/10 text-[#00A499] px-1.5 py-0.5 rounded-full font-medium"
                        >
                          @{name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition text-gray-400 hover:text-red-500 flex-shrink-0"
                  title="Eliminar comentario"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
