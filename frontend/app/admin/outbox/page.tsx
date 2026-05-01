"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Inbox, Phone, MessageSquare, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api";
import { dateTime, relTime } from "@/lib/format";

interface OutboxMessage {
  channel: string;
  to: string;
  body: string;
  sent_at: string;
}

export default function OutboxPage() {
  const [messages, setMessages] = useState<OutboxMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const m = await adminApi.outbox();
      // Newest first
      setMessages([...m].reverse());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500">
            Notification log
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
            Outbox
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Every SMS & WhatsApp message Tukole has sent. If
            MOCK_NOTIFICATIONS is on, messages are logged here without
            actually being sent.
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox className="w-10 h-10 mx-auto text-ink-500" />
          <div className="font-display text-xl text-ink-900 mt-3">
            Nothing sent yet
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Messages will appear here as they're queued or sent.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((m, i) => (
            <motion.div
              key={`${m.sent_at}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    m.channel === "whatsapp"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-coral-100 text-coral-700"
                  }`}
                >
                  {m.channel === "whatsapp" ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs uppercase tracking-wider font-medium text-ink-700">
                      {m.channel}
                    </span>
                    <span className="text-sm font-mono text-ink-900">{m.to}</span>
                  </div>
                  <pre className="text-sm text-ink-700 mt-1 font-sans whitespace-pre-wrap break-words leading-relaxed">
                    {m.body}
                  </pre>
                  <div className="text-[11px] text-ink-500 mt-2">
                    {dateTime(m.sent_at)} · {relTime(m.sent_at)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
