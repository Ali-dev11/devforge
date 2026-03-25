export function banner(message: string): void {
  console.log(`\n${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function step(message: string): void {
  console.log(`- ${message}`);
}

export function warn(message: string): void {
  console.warn(`Warning: ${message}`);
}

export function success(message: string): void {
  console.log(message);
}
