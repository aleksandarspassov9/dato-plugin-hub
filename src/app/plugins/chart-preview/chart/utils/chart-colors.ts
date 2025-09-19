import { Palette } from "../../chart-types.enum";

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const documentStyle = getComputedStyle(document.documentElement);
  const leaf500 = documentStyle.getPropertyValue('--color-leaf-500');
  const leaf400 = documentStyle.getPropertyValue('--color-leaf-400');
  const leaf200 = documentStyle.getPropertyValue('--color-leaf-200');
  const sky700 = documentStyle.getPropertyValue('--color-sky-700');
  const sky600 = documentStyle.getPropertyValue('--color-sky-600');
  const sky400 = documentStyle.getPropertyValue('--color-sky-400');
  const sky50 = documentStyle.getPropertyValue('--color-sky-500');
  const honey500 = documentStyle.getPropertyValue('--color-honey-500');
  const midnight300 = documentStyle.getPropertyValue('--color-midnight-300');
  const midnight400 = documentStyle.getPropertyValue('--color-midnight-400');
  const white = documentStyle.getPropertyValue('--color-white');

  const get = (name: string, fallback: string) =>
    (style.getPropertyValue(name) || fallback).trim();

  return {
    text: get('--color-white', white),
    grid: get('--color-midnight-400', midnight400),
    series: [
      get('--color-leaf-500', leaf500),
      get('--color-leaf-400', leaf400),
      get('--color-leaf-200', leaf200),
      get('--color-sky-700',  sky700),
      get('--color-sky-600',  sky600),
      get('--color-sky-400',  sky400),
      get('--color-sky-50',   sky50),
    ],
    barLineA: get('--color-honey-500', honey500),
    barLineB: get('--color-midnight-300', midnight300),
  };
}
