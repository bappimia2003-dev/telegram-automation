export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function log(tag: string, message: string, ...optionalParams: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`, ...optionalParams);
}

export function errLog(tag: string, message: string, ...optionalParams: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${tag}] ❌ ${message}`, ...optionalParams);
}
