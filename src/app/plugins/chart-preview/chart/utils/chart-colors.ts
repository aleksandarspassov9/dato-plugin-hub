import { Palette } from "../../chart-types.enum";

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const documentStyle = getComputedStyle(document.documentElement);
  const leaf500 = '#82C2A5';
  const leaf400 = '#9BCEB7';
  const leaf200 = '#82c2a5';
  const sky700 = '#507187';
  const sky600 = '#6B97B4';
  const sky400 = '#9ECAE7';
  const sky50 = '#F3F8FC';
  const honey500 = '#FFA21F';
  const midnight300 = '#667F8B';
  const midnight400 = '#335565';
  const white = '#ffff';

  const get = (name: string, fallback: string) =>
    (style.getPropertyValue(name) || fallback).trim();

  return {
    text: white,
    grid: midnight400,
    series: [
      leaf500,
      leaf400,
      leaf200,
      sky700,
      sky600,
      sky400
    ],
    barLineA: honey500,
    barLineB: midnight300,
  };
}
