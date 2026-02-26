"use client";

import { useState } from "react";
import { Button, Group } from "@mantine/core";
import type { UniverseModelV1 } from "@/types/universeModel";
import { UniverseModelBoard } from "@/components/UniverseModelBoard";

export type UniverseModelVizMode = "mesh" | "flow" | "hud";

type UniverseModelVizProps = {
  model: UniverseModelV1 | null;
  height?: number;
  className?: string;
  storageKey?: string;
  onClick?: () => void;
  showControls?: boolean;
  mode?: UniverseModelVizMode;
  onModeChange?: (mode: UniverseModelVizMode) => void;
};

const DEFAULT_KEY = "gua.modelVizMode.v1";

export function UniverseModelViz({
  model,
  height = 180,
  className,
  storageKey = DEFAULT_KEY,
  onClick,
  showControls = false,
  mode,
  onModeChange,
}: UniverseModelVizProps) {
  const [uncontrolledMode, setUncontrolledMode] = useState<UniverseModelVizMode>("mesh");

  const activeMode = mode ?? uncontrolledMode;

  const setModePersist = (next: UniverseModelVizMode) => {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      void 0;
    }
    if (onModeChange) onModeChange(next);
    else setUncontrolledMode(next);
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      <UniverseModelBoard model={model} mode={activeMode} background={false} height={height} onClick={onClick} />
      {showControls ? (
        <Group
          gap={6}
          justify="flex-end"
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            padding: 6,
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.55)",
            border: "1px solid rgba(27, 31, 36, 0.12)",
            boxShadow: "0 10px 26px rgba(20, 24, 28, 0.10)",
            backdropFilter: "blur(8px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="xs"
            radius="xl"
            variant={activeMode === "mesh" ? "filled" : "default"}
            onClick={() => setModePersist("mesh")}
          >
            星图
          </Button>
          <Button
            size="xs"
            radius="xl"
            variant={activeMode === "flow" ? "filled" : "default"}
            onClick={() => setModePersist("flow")}
          >
            流场
          </Button>
          <Button
            size="xs"
            radius="xl"
            variant={activeMode === "hud" ? "filled" : "default"}
            onClick={() => setModePersist("hud")}
          >
            仪表
          </Button>
        </Group>
      ) : null}
    </div>
  );
}
