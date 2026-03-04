/** Ensures React and JSX types resolve when @types/react is hoisted or missing in workspace. */
declare namespace React {
  type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactElement
    | JSX.Element
    | ReactNode[]
  interface ReactElement<
    P = unknown,
    T extends string | typeof Symbol.constructor = string
  > {
    type: T
    props: P
    key: string | number | null
  }
  interface ChangeEvent<T = unknown> {
    target: T
    currentTarget: T
  }
  interface FormEvent<T = unknown> {
    target: T
    currentTarget: T
    preventDefault(): void
  }
  interface MouseEvent<T = unknown> {
    target: T
    currentTarget: T
    preventDefault(): void
  }
  interface ErrorInfo {
    componentStack?: string
  }
  interface Component<P = {}, S = {}> {
    setState(state: Partial<S>): void
    props: P
  }
  const Component: { new (props: any): Component }
}

declare module 'react' {
  export type ReactNode = React.ReactNode
  export interface ReactElement<
    P = unknown,
    T extends string | typeof Symbol.constructor = string
  > {
    type: T
    props: P
    key: string | number | null
  }
  export const createElement: (type: any, props?: any, ...children: any[]) => any
  export const Fragment: unknown
  export const useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
  export const useState: <T>(initial: T) => [T, (v: T | ((prev: T) => T)) => void]
  export const useCallback: <T extends (...args: any[]) => any>(fn: T, deps: unknown[]) => T
  export const useMemo: <T>(fn: () => T, deps: unknown[]) => T
  export const useRef: <T>(initial: T | null) => { current: T | null }
  export const lazy: <T extends React.ComponentType<any>>(fn: () => Promise<{ default: T }>) => T
  export const Suspense: React.ComponentType<{ children?: React.ReactNode; fallback?: React.ReactNode }>
  export interface ComponentType<P = {}> {
    (props: P): React.ReactElement | null
  }
  export interface ChangeEvent<T = unknown> {
    target: T
    currentTarget: T
  }
  export interface FormEvent<T = unknown> {
    target: T
    currentTarget: T
    preventDefault(): void
  }
  export interface MouseEvent<T = unknown> {
    target: T
    currentTarget: T
    preventDefault(): void
  }
  export interface ErrorInfo {
    componentStack?: string
  }
  export var Component: new <P = {}, S = {}>(props: P) => {
    setState(state: Partial<S>): void
    props: P
    state: S
  }
  export default unknown
}

declare module 'react/jsx-runtime' {
  export const jsx: (type: any, props: any, key?: string | number) => any
  export const jsxs: (type: any, props: any, key?: string | number) => any
  export const Fragment: unknown
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>
  }
  interface Element extends React.ReactElement<unknown, string> {}
}
