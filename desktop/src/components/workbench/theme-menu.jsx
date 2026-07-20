import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sun } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip } from "../ui/tooltip";

const storageKey = "project-os-desktop-theme";

const themePresets = [
  { id: "mint", label: "Mint", h: 160, s: "80%", l: "47%" },
  { id: "blue", label: "Blue", h: 218, s: "88%", l: "62%" },
  { id: "violet", label: "Violet", h: 262, s: "84%", l: "66%" },
  { id: "amber", label: "Amber", h: 42, s: "92%", l: "56%" },
  { id: "rose", label: "Rose", h: 348, s: "84%", l: "62%" },
];

const defaultTheme = {
  mode: "dark",
  accent: themePresets[0],
  accents: [],
};

function normalizeTheme(theme) {
  return {
    ...defaultTheme,
    ...theme,
    accent: theme?.accent || defaultTheme.accent,
    accents: Array.isArray(theme?.accents) ? theme.accents : [],
  };
}

function readStoredTheme() {
  try {
    return normalizeTheme(JSON.parse(window.localStorage.getItem(storageKey)) || defaultTheme);
  } catch {
    return defaultTheme;
  }
}

function hexToAccent(hex) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((part) => `${part}${part}`).join("")
    : clean;
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    if (max === green) hue = (blue - red) / delta + 2;
    if (max === blue) hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  return {
    id: `custom-${Date.now()}`,
    label: hex.toUpperCase(),
    h: hue,
    s: `${Math.round(saturation * 100)}%`,
    l: `${Math.round(lightness * 100)}%`,
  };
}

async function loadDesktopTheme() {
  if (!window.__TAURI_INTERNALS__) {
    return readStoredTheme();
  }
  return invoke("get_desktop_theme");
}

async function saveDesktopTheme(theme) {
  if (!window.__TAURI_INTERNALS__) {
    window.localStorage.setItem(storageKey, JSON.stringify(theme));
    return theme;
  }
  return invoke("save_desktop_theme", { input: theme });
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme.mode === "light");
  root.classList.toggle("theme-dark", theme.mode !== "light");
  root.style.setProperty("--desktop-theme-h", String(theme.accent.h));
  root.style.setProperty("--desktop-theme-s", theme.accent.s);
  root.style.setProperty("--desktop-theme-l", theme.accent.l);
}

function previewAccent(hex) {
  applyTheme({
    mode: document.documentElement.classList.contains("theme-light") ? "light" : "dark",
    accent: hexToAccent(hex),
    accents: [],
  });
}

export function ThemeMenu() {
  const [theme, setTheme] = useState(defaultTheme);
  const [customColor, setCustomColor] = useState("#18d69b");

  useEffect(() => {
    let cancelled = false;
    loadDesktopTheme()
      .then((storedTheme) => {
        if (cancelled) return;
        const nextTheme = normalizeTheme(storedTheme);
        setTheme(nextTheme);
        applyTheme(nextTheme);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackTheme = readStoredTheme();
        const nextTheme = normalizeTheme(fallbackTheme);
        setTheme(nextTheme);
        applyTheme(nextTheme);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateTheme = async (nextTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);
    setTheme(normalizedTheme);
    applyTheme(normalizedTheme);
    try {
      const savedTheme = normalizeTheme(await saveDesktopTheme(normalizedTheme));
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizedTheme));
    }
  };

  const previewCustomColor = (hex) => {
    setCustomColor(hex);
    previewAccent(hex);
  };

  const addCustomColor = () => {
    const accent = hexToAccent(customColor);
    updateTheme({
      ...theme,
      accent,
      accents: [...theme.accents, accent],
    });
  };

  const removeCustomColor = (accentId) => {
    const accents = theme.accents.filter((accent) => accent.id !== accentId);
    const accent = theme.accent.id === accentId ? themePresets[0] : theme.accent;
    updateTheme({ ...theme, accent, accents });
  };

  const allAccents = [...themePresets, ...theme.accents];

  return (
    <DropdownMenu>
      <Tooltip content="主题">
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon" type="button" aria-label="主题">
            <Sun className="buttonIcon" strokeWidth={2.25} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="themeMenuContent">
        <div className="themeMenuGroup">
          <div className="themeMenuLabel">明暗</div>
          <div className="themeModeGrid">
            {["dark", "light"].map((mode) => (
              <DropdownMenuItem
                className={`themeModeItem${theme.mode === mode ? " active" : ""}`}
                key={mode}
                onSelect={() => updateTheme({ ...theme, mode })}
              >
                {mode === "dark" ? "深色" : "浅色"}
              </DropdownMenuItem>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="themeMenuGroup">
          <div className="themeMenuLabel">主题色</div>
          <div className="themeSwatches">
            {allAccents.map((preset) => (
              <div className="themeSwatchWrap" key={preset.id}>
                <DropdownMenuItem
                  aria-label={preset.label}
                  className={`themeSwatch${theme.accent.id === preset.id ? " active" : ""}`}
                  onSelect={() => updateTheme({ ...theme, accent: preset })}
                  style={{ "--swatch": `hsl(${preset.h} ${preset.s} ${preset.l})` }}
                />
                {preset.id.startsWith("custom-") ? (
                  <button
                    aria-label={`删除 ${preset.label}`}
                    className="themeSwatchRemove"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeCustomColor(preset.id);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="themeCustomRow">
            <input
              aria-label="自定义主题色"
              className="themeColorInput"
              onChange={(event) => previewCustomColor(event.target.value)}
              type="color"
              value={customColor}
            />
            <Button size="sm" type="button" variant="subtle" onClick={addCustomColor}>
              添加
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
