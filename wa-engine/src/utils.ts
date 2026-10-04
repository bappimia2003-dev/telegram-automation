const inMemoryLogs: string[] = [];

export function getInMemoryLogs(): string[] {
  return inMemoryLogs;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function log(tag: string, message: string, ...optionalParams: any[]) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${tag}] ${message} ${optionalParams.length ? JSON.stringify(optionalParams) : ''}`.trim();
  console.log(entry);
  inMemoryLogs.push(entry);
  if (inMemoryLogs.length > 500) inMemoryLogs.shift();
}

export function errLog(tag: string, message: string, ...optionalParams: any[]) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${tag}] ❌ ${message} ${optionalParams.length ? JSON.stringify(optionalParams) : ''}`.trim();
  console.error(entry);
  inMemoryLogs.push(entry);
  if (inMemoryLogs.length > 500) inMemoryLogs.shift();
}
