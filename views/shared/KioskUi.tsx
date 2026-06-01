import type { ReactNode } from "react";
import Link from "next/link";

type StatusCardProps = {
  title: string;
  value: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
};

type PrimaryButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "danger";
  onClick: () => void;
};

type ErrorNoticeProps = {
  title: string;
  message: string;
  actionItems?: string[];
  tone?: "danger" | "warning";
};

const BUTTON_BASE_CLASS =
  "w-full rounded-full px-8 py-5 text-2xl transition disabled:cursor-not-allowed disabled:opacity-40 sm:py-6 sm:text-3xl";

const BUTTON_TONE_CLASSES = {
  primary:
    "glow-btn border border-orange-200/35 bg-linear-to-b from-orange-500 to-orange-600 font-semibold text-orange-50 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/45",
  neutral:
    "border border-orange-200/40 bg-transparent font-medium text-orange-100 hover:border-orange-100 hover:bg-orange-300/10",
  danger:
    "border border-rose-300/45 bg-rose-500/15 font-medium text-rose-100 hover:bg-rose-500/25",
} as const;

const ERROR_NOTICE_TONE_CLASSES = {
  danger:
    "border-rose-300/40 bg-rose-400/12 text-rose-100 shadow-[0_16px_32px_rgba(80,0,20,0.22)]",
  warning:
    "border-amber-200/40 bg-amber-300/12 text-amber-100 shadow-[0_16px_32px_rgba(90,45,0,0.2)]",
} as const;

function splitNoticeMessage(message: string) {
  const parts = message
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((part) => part.trim())
    .filter(Boolean);

  return parts?.length ? parts : [message];
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  tone = "neutral",
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE_CLASS} ${BUTTON_TONE_CLASSES[tone]}`}
    >
      {children}
    </button>
  );
}

export function StatusCard({ title, value, detail, children }: StatusCardProps) {
  return (
    <div className="rounded-3xl border border-orange-100/20 bg-black/18 p-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/70">
        {title}
      </p>
      <div className="mt-2 text-2xl font-semibold text-orange-50">{value}</div>
      {detail && <div className="mt-1 text-sm text-orange-100/65">{detail}</div>}
      {children}
    </div>
  );
}

export function ErrorNotice({
  actionItems,
  message,
  title,
  tone = "danger",
}: ErrorNoticeProps) {
  const [summary, ...derivedActionItems] = splitNoticeMessage(message);
  const renderedActionItems = actionItems ?? derivedActionItems;

  return (
    <section
      className={`w-full rounded-3xl border p-4 text-left ${ERROR_NOTICE_TONE_CLASSES[tone]}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/65">
            Diagnostic
          </p>
          <h2 className="mt-1 text-lg font-semibold text-current">{title}</h2>
          <p className="mt-2 break-words text-sm leading-6 text-current/80">
            {summary}
          </p>

          {renderedActionItems.length > 0 && (
            <div className="mt-3 rounded-2xl border border-current/15 bg-black/18 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-current/55">
                Next Steps
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-current/78">
                {renderedActionItems.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex gap-2">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current/65" />
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function getReadableErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export function RealtimeBadge({ status }: { status: string }) {
  return (
    <div className="mb-2 rounded-full border border-orange-200/30 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-100/75">
      Realtime {status}
    </div>
  );
}

export function PillLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-orange-200/35 px-5 py-2 text-sm font-semibold text-orange-100 transition hover:border-orange-100 hover:bg-orange-300/10"
    >
      {children}
    </Link>
  );
}
