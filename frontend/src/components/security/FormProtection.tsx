import { useRef, type ReactNode } from "react";

interface FormProtectionProps {
  children: ReactNode;
  /** Called when form is submitted — returns false if honeypot triggered */
  onValidSubmit: () => void;
}

/**
 * Anti-bot wrapper: includes a honeypot hidden field.
 * If a bot fills the hidden field, submission is silently rejected.
 */
export function FormProtection({ children, onValidSubmit }: FormProtectionProps) {
  const honeypotRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot check — hidden field should be empty
    if (honeypotRef.current && honeypotRef.current.value) {
      console.warn("[Security] Bot detected via honeypot.");
      return;
    }
    onValidSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Honeypot field — invisible to humans, filled by bots */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          opacity: 0,
          height: 0,
          overflow: "hidden",
          tabIndex: -1,
        }}
      >
        <label htmlFor="zfy_website">Ne pas remplir</label>
        <input
          ref={honeypotRef}
          type="text"
          id="zfy_website"
          name="zfy_website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {children}
    </form>
  );
}

/**
 * Standalone honeypot check for forms that can't use FormProtection wrapper.
 * Add a hidden input with name="zfy_hp" and check its value before processing.
 */
export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        opacity: 0,
        height: 0,
        overflow: "hidden",
      }}
    >
      <label htmlFor="zfy_hp">Ne pas remplir</label>
      <input
        type="text"
        id="zfy_hp"
        name="zfy_hp"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}

/** Returns true if the honeypot field was filled (= bot detected) */
export function isHoneypotTriggered(formElement: HTMLFormElement): boolean {
  const hp = formElement.querySelector<HTMLInputElement>('[name="zfy_hp"]');
  return !!hp?.value;
}
