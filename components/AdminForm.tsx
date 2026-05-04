export default function AdminForm({
  action
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-4 border border-ink p-6">
      <h2 className="font-display text-2xl font-bold">Add candidate</h2>
      <Field label="Name" name="name" required />
      <Field label="Description" name="description" />
      <Field label="Image URL" name="image_url" placeholder="https://..." />
      <Field label="Display order" name="display_order" type="number" defaultValue="0" />
      <button
        type="submit"
        className="bg-ink text-paper py-3 px-8 font-mono uppercase tracking-widest text-sm hover:bg-accent transition"
      >
        Add →
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
  defaultValue
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full mt-1 border-b-2 border-ink/30 bg-transparent py-2 focus:outline-none focus:border-ink"
      />
    </label>
  );
}
