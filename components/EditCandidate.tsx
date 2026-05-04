"use client";

import { useState } from "react";
import type { Candidate } from "@/lib/supabase";

export default function EditCandidate({
  candidate,
  updateAction,
  deleteAction
}: {
  candidate: Candidate;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {candidate.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.image_url}
              alt={candidate.name}
              className="w-12 h-12 object-cover border border-ink/10 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 bg-ink/5 border border-ink/10 flex items-center justify-center font-display text-xl flex-shrink-0">
              {candidate.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-xl font-bold truncate">{candidate.name}</p>
            {candidate.description && (
              <p className="text-sm text-muted truncate">{candidate.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-xs uppercase tracking-widest hover:underline"
          >
            Edit
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={candidate.id} />
            <button
              type="submit"
              className="font-mono text-xs uppercase tracking-widest text-accent hover:underline"
              onClick={(e) => {
                if (!confirm(`Delete "${candidate.name}"? Their votes will block this if any exist.`)) {
                  e.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={updateAction} className="space-y-3 bg-ink/5 p-4 -mx-2 border border-ink/10">
      <input type="hidden" name="id" value={candidate.id} />
      <Field label="Name" name="name" defaultValue={candidate.name} required />
      <Field label="Description" name="description" defaultValue={candidate.description ?? ""} />
      <Field label="Image URL" name="image_url" defaultValue={candidate.image_url ?? ""} />
      <Field
        label="Display order"
        name="display_order"
        type="number"
        defaultValue={String(candidate.display_order ?? 0)}
      />
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="bg-ink text-paper py-2 px-6 font-mono text-xs uppercase tracking-widest hover:bg-accent transition"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="border border-ink py-2 px-6 font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  defaultValue
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full mt-1 border-b-2 border-ink/30 bg-transparent py-1 focus:outline-none focus:border-ink"
      />
    </label>
  );
}