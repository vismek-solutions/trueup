export const route = async (): Promise<string> => {
  const screen = await import("../view/camera.ts");

  return screen.Camera();
};
