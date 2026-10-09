import type { ComponentProps, ReactNode } from "react";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: ReactNode;
};

export function Field({ label, name, errors, hint, ...input }: FieldProps) {
  const id = `felt-${name}`;
  const errorId = `${id}-feil`;
  const hintId = `${id}-hint`;
  const describedBy = [errors?.length ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        {...input}
      />
      {hint && !errors?.length && (
        <p id={hintId} className="text-sm text-zinc-500">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <ul id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type RadioGroupProps = {
  legend: string;
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  errors?: string[];
  /** Stabler alternativene vannrett (korte valg) eller loddrett (valg med forklaring). */
  layout?: "row" | "column";
};

export function RadioGroup({ legend, name, options, defaultValue, errors, layout = "row" }: RadioGroupProps) {
  const errorId = `felt-${name}-feil`;

  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-invalid={errors?.length ? true : undefined}
      aria-describedby={errors?.length ? errorId : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className={layout === "row" ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-zinc-300 px-3 py-2 has-checked:border-zinc-900 has-checked:bg-zinc-50 has-focus-visible:ring-2 has-focus-visible:ring-zinc-900/10 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
              required
              className="mt-1 accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.hint && <span className="text-sm text-zinc-500">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {errors?.length ? (
        <ul id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

export function FormMessage({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {children}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "Vent litt …" : children}
    </button>
  );
}

export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="text-zinc-600 dark:text-zinc-400">{intro}</p>}
      </div>
      {children}
    </main>
  );
}
