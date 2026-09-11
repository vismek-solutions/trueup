export const slug = (text: string): string => text.trim().toLowerCase().split(" ").join("-");
