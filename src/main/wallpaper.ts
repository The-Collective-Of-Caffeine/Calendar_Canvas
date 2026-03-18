import path from "path";
import { promises as fs } from "fs";
import { Resvg } from "@resvg/resvg-js";
import type { CalendarConfig } from "../shared/types";
export { renderWallpaper } from "../shared/wallpaper";

const nativeImport = new Function(
  "specifier",
  "return import(specifier);"
) as (specifier: string) => Promise<{
  setWallpaper: (imagePath: string) => Promise<void>;
}>;

export async function applyWallpaper(
  config: CalendarConfig,
  svg: string
): Promise<string> {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: config.wallpaper.resolutionWidth
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Aptos"
    }
  });
  const png = resvg.render().asPng();
  const outputPath = config.wallpaper.outputPath;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, png);

  const wallpaperModule = await nativeImport("wallpaper");

  await wallpaperModule.setWallpaper(outputPath);

  return outputPath;
}
