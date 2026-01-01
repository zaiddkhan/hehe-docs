"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CRDTDocument, generatePositionBetween } from "./crdt";
import { WSMessage, InsertMessage, DeleteMessage } from "./types";

const COLORS = [
  "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3",
  "#00BCD4", "#009688", "#4CAF50", "#FF9800", "#FF5722",
];

export default function Editor() {
  const [connected, setConnected] = useState(false);
  const [siteId, setSiteId] = useState<string>("");
  const [userColor, setUserColor] = useState<string>("#2196F3");
  const [isClient, setIsClient] = useState(false);

  // Generate random values only on client
  useEffect(() => {
    setSiteId(Math.random().toString(36).substring(2, 10));
    setUserColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setIsClient(true);
  }, []);

  const docRef = useRef<CRDTDocument | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isRemoteUpdate = useRef(false);

  // Initialize document when siteId is ready
  useEffect(() => {
    if (siteId && !docRef.current) {
      docRef.current = new CRDTDocument(siteId);
    }
  }, [siteId]);

  const syncEditorContent = useCallback((insertedBefore: number = 0, deletedBefore: number = 0) => {
    const editor = editorRef.current;
    const doc = docRef.current;
    if (!editor || !doc) return;

    const cursorPos = editor.selectionStart;
    const content = doc.toString();

    isRemoteUpdate.current = true;
    editor.value = content;
    isRemoteUpdate.current = false;

    const newCursorPos = Math.max(0, cursorPos + insertedBefore - deletedBefore);
    editor.setSelectionRange(newCursorPos, newCursorPos);
  }, []);

  const sendMessage = useCallback((msg: InsertMessage | DeleteMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!siteId) return;

    const ws = new WebSocket("wss://hehe-docs.onrender.com/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const doc = docRef.current;
      const editor = editorRef.current;
      if (!doc) return;

      const msg: WSMessage = JSON.parse(event.data);
      const cursorPos = editor?.selectionStart ?? 0;

      if (msg.type === "snapshot") {
        doc.loadSnapshot(msg.chars);
        if (editor) {
          editor.value = doc.toString();
        }
      } else if (msg.type === "insert") {
        const char = {
          id: {
            path: msg.left?.path ?? [],
            site: msg.site,
            counter: msg.counter,
          },
          value: msg.value,
          tombstone: false,
        };
        if (doc.applyRemoteInsert(char)) {
          const insertPos = doc.getVisibleIndexOf(char.id);
          const insertedBefore = insertPos < cursorPos ? 1 : 0;
          syncEditorContent(insertedBefore, 0);
        }
      } else if (msg.type === "delete") {
        const deletePos = doc.getVisibleIndexOf(msg.id);
        if (doc.applyRemoteDelete(msg.id)) {
          const deletedBefore = deletePos < cursorPos ? 1 : 0;
          syncEditorContent(0, deletedBefore);
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [siteId, syncEditorContent]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (isRemoteUpdate.current) return;

      const doc = docRef.current;
      if (!doc) return;

      const newText = e.target.value;
      const oldText = doc.toString();

      let prefixLen = 0;
      const minLen = Math.min(oldText.length, newText.length);
      while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
        prefixLen++;
      }

      let oldSuffixLen = 0;
      let newSuffixLen = 0;
      while (
        oldSuffixLen < oldText.length - prefixLen &&
        newSuffixLen < newText.length - prefixLen &&
        oldText[oldText.length - 1 - oldSuffixLen] ===
          newText[newText.length - 1 - newSuffixLen]
      ) {
        oldSuffixLen++;
        newSuffixLen++;
      }

      const deletedCount = oldText.length - prefixLen - oldSuffixLen;
      const insertedChars = newText.substring(
        prefixLen,
        newText.length - newSuffixLen
      );

      for (let i = deletedCount - 1; i >= 0; i--) {
        const deleteIndex = prefixLen + i;
        const charToDelete = doc.getCharAtVisibleIndex(deleteIndex);
        if (charToDelete) {
          const counter = doc.tick();
          doc.delete(charToDelete.id);

          const msg: DeleteMessage = {
            type: "delete",
            id: charToDelete.id,
            site: siteId,
            counter,
          };
          sendMessage(msg);
        }
      }

      for (let i = 0; i < insertedChars.length; i++) {
        const insertIndex = prefixLen + i;
        const left = doc.getLeftNeighbor(insertIndex);
        const right = doc.getRightNeighbor(insertIndex);
        const counter = doc.tick();

        const position = generatePositionBetween(left, right, siteId, counter);

        const char = {
          id: position,
          value: insertedChars[i],
          tombstone: false,
        };

        doc.insert(char);

        const msg: InsertMessage = {
          type: "insert",
          value: insertedChars[i],
          left: position,
          right,
          site: siteId,
          counter,
        };
        sendMessage(msg);
      }
    },
    [siteId, sendMessage]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl relative">
        <div
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full shadow-md z-10"
          style={{ backgroundColor: userColor }}
        />
        <textarea
          ref={editorRef}
          onChange={handleChange}
          autoFocus
          className="w-full bg-white rounded-2xl min-h-[700px] p-12 focus:outline-none text-gray-800 text-lg leading-relaxed resize-none transition-shadow duration-300"
          style={{
            fontFamily: "'Georgia', serif",
            caretColor: userColor,
            boxShadow: `
              0 1px 1px rgba(0,0,0,0.02),
              0 2px 2px rgba(0,0,0,0.02),
              0 4px 4px rgba(0,0,0,0.02),
              0 8px 8px rgba(0,0,0,0.02),
              0 16px 16px rgba(0,0,0,0.03),
              0 32px 32px rgba(0,0,0,0.03)
            `,
          }}
        />
      </div>
    </div>
  );
}
