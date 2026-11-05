import { useRef } from "react";
import {
  Pencil,
  MousePointer2,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  ImagePlus,
  Pipette,
} from "lucide-react";

interface ToolbarProps {
  tool: string;
  setTool: (t: string) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onInsertImage: () => void;
}

const PRESET_COLORS = [
  "#171717", // Ink black
  "#e11d48", // Crimson
  "#2563eb", // Cobalt blue
  "#16a34a", // Forest green
  "#d97706", // Ochre
  "#7c3aed", // Violet
  "#ffffff", // White
];

const STROKE_PRESETS = [
  { size: 2, dotClass: "w-1.5 h-1.5", label: "Fine (2px)" },
  { size: 4, dotClass: "w-2.5 h-2.5", label: "Medium (4px)" },
  { size: 10, dotClass: "w-3.5 h-3.5", label: "Bold (10px)" },
];

function ToolButton({
  icon,
  active,
  onClick,
  title,
  danger,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  let classes =
    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 ";
  if (active) {
    classes +=
      "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs ";
  } else if (danger) {
    classes +=
      "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-red-600 dark:hover:text-red-400 ";
  } else {
    classes +=
      "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 ";
  }
  return (
    <button onClick={onClick} title={title} className={classes}>
      {icon}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-1.5" />;
}

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  onClear,
  onInsertImage,
}: ToolbarProps) {
  const iconSize = 16;
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isCustomColor = !PRESET_COLORS.includes(color);

  return (
    <div className="flex items-center justify-center gap-0.5 px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 select-none flex-shrink-0 z-10 overflow-x-auto">
      {/* Primary Drawing Tools */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/70 dark:border-neutral-700/60">
        <ToolButton
          icon={<Pencil size={iconSize} />}
          active={tool === "pen"}
          onClick={() => setTool("pen")}
          title="Pen (P)"
        />
        <ToolButton
          icon={<MousePointer2 size={iconSize} />}
          active={tool === "select"}
          onClick={() => setTool("select")}
          title="Select (V)"
        />
        <ToolButton
          icon={<Eraser size={iconSize} />}
          active={tool === "eraser"}
          onClick={() => setTool("eraser")}
          title="Eraser (E)"
        />
      </div>

      <Separator />

      {/* Touch-Friendly Color Swatches */}
      <div className="flex items-center gap-1 px-0.5">
        {PRESET_COLORS.map((c) => {
          const active = color === c;
          return (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? "bg-neutral-200/80 dark:bg-neutral-800 ring-1 ring-neutral-900 dark:ring-neutral-100"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <span
                className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 block"
                style={{ backgroundColor: c }}
              />
            </button>
          );
        })}

        {/* Custom Color Swatch (Monochrome Pipette, Zero Rainbow Gradient) */}
        <div className="relative flex items-center">
          <button
            onClick={() => colorInputRef.current?.click()}
            title={isCustomColor ? `Custom: ${color}` : "Custom color"}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
              isCustomColor
                ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                : "border-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {isCustomColor ? (
              <span
                className="w-4 h-4 rounded-full border border-neutral-400 block"
                style={{ backgroundColor: color }}
              />
            ) : (
              <Pipette size={14} />
            )}
          </button>

          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="sr-only"
          />
        </div>
      </div>

      <Separator />

      {/* Quick Stroke Thickness Presets + Fine Slider */}
      <div className="flex items-center gap-1.5 px-0.5">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/70 dark:border-neutral-700/60">
          {STROKE_PRESETS.map((preset) => {
            const active = strokeWidth === preset.size;
            return (
              <button
                key={preset.size}
                type="button"
                onClick={() => setStrokeWidth(preset.size)}
                title={preset.label}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  active
                    ? "bg-white dark:bg-neutral-900 shadow-2xs"
                    : "hover:bg-white/60 dark:hover:bg-neutral-900/50 opacity-60 hover:opacity-100"
                }`}
              >
                <span
                  className={`${preset.dotClass} rounded-full bg-neutral-900 dark:bg-neutral-100 block`}
                />
              </button>
            );
          })}
        </div>

        <input
          type="range"
          min={1}
          max={64}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-20 accent-neutral-800 dark:accent-neutral-200"
          title={`Stroke width: ${strokeWidth}px`}
        />
        <span className="text-[11px] font-mono tabular-nums text-neutral-500 w-5 text-right">
          {strokeWidth}
        </span>
      </div>

      <Separator />

      {/* Insert Image & History */}
      <div className="flex items-center gap-0.5">
        <ToolButton
          icon={<ImagePlus size={iconSize} />}
          onClick={onInsertImage}
          title="Insert Image"
        />
        <ToolButton
          icon={<Undo2 size={iconSize} />}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
        />
        <ToolButton
          icon={<Redo2 size={iconSize} />}
          onClick={onRedo}
          title="Redo (Ctrl+Shift+Z)"
        />
        <ToolButton
          icon={<Trash2 size={iconSize} />}
          onClick={onClear}
          title="Clear All"
          danger
        />
      </div>
    </div>
  );
}
