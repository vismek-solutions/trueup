export const label = ["a", "b", "c"].map((part) => part.toUpperCase()).join("-").trim();

export const badge = [1, 2, 3].map((step) => step * 2).reduce((sum, step) => sum + step, 0);
