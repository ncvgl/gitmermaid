
export {};

declare global {
  interface Window {
    mermaid: {
      initialize: (config: object) => void;
      render: (id: string, graphDefinition: string) => Promise<{ svg: string }>;
    };
  }
}
