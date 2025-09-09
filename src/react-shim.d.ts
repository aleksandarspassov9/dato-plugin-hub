// minimal shim so datocms-plugin-sdk type defs compile without @types/react
declare namespace React {
  type ReactNode = any;
  interface CSSProperties { [key: string]: any }
}
