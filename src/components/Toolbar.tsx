import { useRef } from "react";
import {
  Pencil,
  MousePointer2,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  ImagePlus,
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
  "#171717", // Primary black
  "#e11d48", // Crimson red
  "#16a34a", // Forest green
  "#2563eb", // Deep blue
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#ffffff", // Clean white
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
    "p-2 rounded-lg transition-colors outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 ";
  if (active) {
    classes +=
      "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ";
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
  return <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-1" />;
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
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 select-none flex-shrink-0 z-10">
      {/* Drawing tools */}
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

      <Separator />

      {/* Insert Image */}
      <ToolButton
        icon={<ImagePlus size={iconSize} />}
        onClick={onInsertImage}
        title="Insert image"
      />

      <Separator />

      {/* Color swatches */}
      <div className="flex items-center gap-1.5 px-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            className={`w-4 h-4 rounded-full border transition-all ${
              color === c
                ? "border-neutral-900 dark:border-neutral-100 scale-125 shadow-xs"
                : "border-neutral-300 dark:border-neutral-700 hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        {/* Custom Color Picker Button */}
        <div className="relative flex items-center">
          <button
            onClick={() => colorInputRef.current?.click()}
            title={isCustomColor ? `Custom color: ${color}` : "Choose custom color"}
            className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center overflow-hidden ${
              isCustomColor
                ? "border-neutral-900 dark:border-neutral-100 scale-125 shadow-xs"
                : "border-neutral-300 dark:border-neutral-700 hover:scale-110"
            }`}
            style={{
              background: isCustomColor
                ? color
                : "conic-gradient(from 180deg at 50% 50%, #ff0000 0deg, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)",
            }}
          >
            {isCustomColor && (
              <div className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-xs" />
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

      {/* Stroke size slider */}
      <div className="flex items-center gap-2 px-1">
        <input
          type="range"
          min={1}
          max={64}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-20 accent-neutral-800 dark:accent-neutral-200"
          title={`Brush size: ${strokeWidth}px ([ and ] or Alt+Shift+Wheel)`}
        />
        <span className="text-[11px] font-mono tabular-nums text-neutral-400 dark:text-neutral-500 w-4 text-right">
          {strokeWidth}
        </span>
      </div>

      <Separator />

      {/* Undo / Redo / Clear */}
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
        title="Clear canvas"
        danger
      />
    </div>
  );
}
