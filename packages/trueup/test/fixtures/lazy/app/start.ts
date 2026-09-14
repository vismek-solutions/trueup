export const start = async (name: string): Promise<string> => {
  const engine = await import("../engine/run.ts");
  const chosen = await import(`../engine/${name}.ts`);

  return engine.run() + String(chosen);
};
