"use client";

const ROWS: [string[], string][] = [
  [["Space", "K"], "Play or pause"],
  [["←", "→"], "Back or forward 5 seconds"],
  [["J", "L"], "Back or forward 10 seconds"],
  [[",", "."], "Back or forward one frame"],
  [["I", "O"], "Set clip start / end"],
  [["Shift", "←/→"], "Previous or next chance"],
  [["Home", "End"], "Start or end of match"],
  [["?"], "Show this list"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="card fade-up w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Same keys as YouTube where one exists.</p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {ROWS.map(([keys, label]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-2 pr-3 whitespace-nowrap">
                  {keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span className="mx-1 text-faint">/</span>}
                      <span className="kbd">{k}</span>
                    </span>
                  ))}
                </td>
                <td className="py-2 text-muted">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Click any player on the pitch to follow him. Drag the blue dot to scrub.</p>
      </div>
    </div>
  );
}
